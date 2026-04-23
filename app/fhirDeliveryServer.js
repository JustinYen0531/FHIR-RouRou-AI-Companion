const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildSessionExportBundle, buildPatientResourceOnly } = require('./fhirBundleBuilder');
const { AICompanionEngine } = require('./aiCompanionEngine');
const { createSessionPersistence, DEFAULT_SESSION_STORE_PATH, listSessionSummaries } = require('./sessionPersistence');
const {
  DEFAULT_GROQ_BASE_URL,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_GOOGLE_BASE_URL,
  DEFAULT_GOOGLE_MODEL,
  inferProvider
} = require('./llmChatClient');

const APP_DIR = __dirname;
const PROJECT_ROOT = path.join(APP_DIR, '..');
const DEFAULT_PUBLIC_FHIR_BASE_URL = 'https://r4.smarthealthit.org';
const LEGACY_HAPI_FHIR_BASE_URL = 'https://hapi.fhir.org/baseR4';
const PUBLIC_DEMO_FHIR_TARGETS = [DEFAULT_PUBLIC_FHIR_BASE_URL, LEGACY_HAPI_FHIR_BASE_URL];
const DELIVERY_DEBUG_LOG_PATH = path.join(APP_DIR, '..', '.logs', 'fhir-delivery-debug.ndjson');
const LOCAL_ENV_PATH = path.join(PROJECT_ROOT, '.env.local');
const STATIC_FILES = {
  '/': { filePath: path.join(APP_DIR, 'index.html'), contentType: 'text/html; charset=utf-8' },
  '/index.html': { filePath: path.join(APP_DIR, 'index.html'), contentType: 'text/html; charset=utf-8' },
  '/app.js': { filePath: path.join(APP_DIR, 'app.js'), contentType: 'application/javascript; charset=utf-8' },
  '/knowYouMemory.js': { filePath: path.join(APP_DIR, 'knowYouMemory.js'), contentType: 'application/javascript; charset=utf-8' },
  '/microInterventionRules.js': { filePath: path.join(APP_DIR, 'microInterventionRules.js'), contentType: 'application/javascript; charset=utf-8' },
  '/style.css': { filePath: path.join(APP_DIR, 'style.css'), contentType: 'text/css; charset=utf-8' }
};

function stripWrappingQuotes(value) {
  const text = String(value || '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function loadLocalEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const preferLocalKeys = new Set([
    'LLM_PROVIDER',
    'LLM_MODEL',
    'GROQ_API_KEY',
    'GROQ_API_BASE_URL',
    'OPENROUTER_API_KEY',
    'OPENROUTER_API_BASE_URL',
    'GOOGLE_API_KEY',
    'GOOGLE_API_BASE_URL',
    'FHIR_SERVER_URL',
    'AI_COMPANION_SESSION_STORE'
  ]);

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key) continue;
    const shouldPreferLocal = preferLocalKeys.has(key);
    if (!shouldPreferLocal && Object.prototype.hasOwnProperty.call(process.env, key)) continue;

    const value = stripWrappingQuotes(line.slice(separatorIndex + 1));
    process.env[key] = value;
  }
}

loadLocalEnvFile(LOCAL_ENV_PATH);

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS'
  });
  res.end(JSON.stringify(body, null, 2));
}

function sendStaticFile(res, pathname) {
  const decodedPathname = (() => {
    try {
      return decodeURIComponent(pathname);
    } catch (error) {
      return pathname;
    }
  })();

  const match = STATIC_FILES[decodedPathname] || STATIC_FILES[pathname];
  if (!match) {
    if (decodedPathname.startsWith('/docs/')) {
      const relativePath = decodedPathname.replace(/^\/+/, '');
      const safePath = path.normalize(path.join(APP_DIR, '..', relativePath));
      const docsRoot = path.join(APP_DIR, '..', 'docs');
      if (!safePath.startsWith(docsRoot) || !fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
        return false;
      }
      const ext = path.extname(safePath).toLowerCase();
      const contentType = ext === '.md'
        ? 'text/markdown; charset=utf-8'
        : 'text/plain; charset=utf-8';
      const content = fs.readFileSync(safePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return true;
    }
    return false;
  }

  const content = fs.readFileSync(match.filePath);
  res.writeHead(200, { 'Content-Type': match.contentType });
  res.end(content);
  return true;
}

function normalizeFhirTarget(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function shouldUseUniqueDemoKeys(fhirBaseUrl) {
  const normalized = normalizeFhirTarget(fhirBaseUrl);
  return PUBLIC_DEMO_FHIR_TARGETS.some((target) => normalizeFhirTarget(target) === normalized);
}

function createDemoDeliverySuffix() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function resolveDeliverySuffix(payload) {
  const suffix = String(payload?.__deliverySuffix || '').trim();
  return suffix || createDemoDeliverySuffix();
}

function preparePayloadForDeliveryTarget(payload, fhirBaseUrl) {
  if (!shouldUseUniqueDemoKeys(fhirBaseUrl)) {
    return payload;
  }

  const cloned = JSON.parse(JSON.stringify(payload || {}));
  const suffix = resolveDeliverySuffix(cloned);
  cloned.__deliverySuffix = suffix;

  if (cloned.patient && cloned.patient.key) {
    cloned.patient.key = cloned.patient.key.endsWith(`-${suffix}`) ? cloned.patient.key : `${cloned.patient.key}-${suffix}`;
  }

  if (cloned.session && cloned.session.encounterKey) {
    cloned.session.encounterKey = cloned.session.encounterKey.endsWith(`-${suffix}`) ? cloned.session.encounterKey : `${cloned.session.encounterKey}-${suffix}`;
  }

  return cloned;
}

function appendDeliveryDebugLog(entry) {
  try {
    const logDir = path.dirname(DELIVERY_DEBUG_LOG_PATH);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(DELIVERY_DEBUG_LOG_PATH, JSON.stringify({
      loggedAt: new Date().toISOString(),
      ...entry
    }) + '\n');
  } catch (error) {
    console.error('Unable to write FHIR delivery debug log:', error.message);
  }
}

function buildCreatedResourceMap(transactionBody) {
  const entries = Array.isArray(transactionBody?.entry) ? transactionBody.entry : [];
  return entries.reduce((acc, entry) => {
    const location = String(entry?.response?.location || '').trim();
    if (!location) return acc;
    const canonicalPath = location.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').replace(/\/_history\/[^/]+$/i, '');
    const [resourceType = '', resourceId = ''] = canonicalPath.split('/');
    if (resourceType && resourceId && !acc[resourceType]) {
      acc[resourceType] = `${resourceType}/${resourceId}`;
    }
    return acc;
  }, {});
}

function summarizeQuickCheck(bundleResult, options = {}) {
  const blockingReasons = Array.isArray(bundleResult?.blocking_reasons)
    ? bundleResult.blocking_reasons.filter(Boolean)
    : [];
  const validationErrors = Array.isArray(bundleResult?.validation_errors)
    ? bundleResult.validation_errors.filter(Boolean)
    : [];
  const validationIssues = Array.isArray(bundleResult?.validation_report?.issues)
    ? bundleResult.validation_report.issues
    : [];
  const issueMessages = validationIssues
    .map((issue) => issue?.message || issue?.code || '')
    .filter(Boolean);

  const canDeliver = Boolean(bundleResult?.bundle_json) && (!bundleResult?.validation_report || bundleResult.validation_report.valid);
  const mode = options.fhirBaseUrl ? 'transaction' : 'dry_run';
  const reasons = blockingReasons.length
    ? blockingReasons
    : (validationErrors.length ? validationErrors : issueMessages).slice(0, 5);

  return {
    can_deliver: canDeliver,
    mode,
    mode_label: mode === 'transaction' ? '會送到 FHIR 伺服器' : '只做 dry-run 檢查',
    target: options.fhirBaseUrl || '',
    target_label: options.fhirBaseUrl || '未設定 FHIR_SERVER_URL（目前為 dry-run）',
    reason_count: reasons.length,
    reasons,
    validation: {
      issue_count: Number(bundleResult?.validation_report?.issue_count || 0),
      errors: Number(bundleResult?.validation_report?.errors || 0),
      warnings: Number(bundleResult?.validation_report?.warnings || 0)
    },
    summary: canDeliver
      ? (mode === 'transaction' ? '可送出，按下同意送出即可上傳。' : '可送出（dry-run），欄位與驗證已通過。')
      : '目前不可送出，請先修正阻擋原因。',
    next_action: canDeliver
      ? '可直接按「同意送出」。'
      : (reasons[0] || '請先補齊必要欄位後再檢查一次。')
  };
}

function normalizeResourcePath(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+/, '')
    .replace(/\/_history\/[^/]+$/i, '');
}

async function readFetchResponse(fetchResponse) {
  const text = await fetchResponse.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (error) {
    parsed = { raw: text };
  }
  return parsed;
}

async function sendFhirTransactionAttempt(fetchImpl, fhirBaseUrl, bundleJson) {
  const normalizedBaseUrl = normalizeFhirTarget(fhirBaseUrl);
  try {
    const transactionResponse = await fetchImpl(normalizedBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json'
      },
      body: JSON.stringify(bundleJson)
    });
    const parsed = await readFetchResponse(transactionResponse);
    return {
      fhirBaseUrl: normalizedBaseUrl,
      status: transactionResponse.status,
      ok: transactionResponse.ok,
      body: parsed,
      error: ''
    };
  } catch (error) {
    return {
      fhirBaseUrl: normalizedBaseUrl,
      status: 0,
      ok: false,
      body: null,
      error: error.message || 'FHIR transaction request failed.'
    };
  }
}

function shouldRetryOnPublicDemoFallback(primaryAttempt, primaryFhirBaseUrl, fallbackFhirBaseUrl) {
  const primary = normalizeFhirTarget(primaryFhirBaseUrl);
  const fallback = normalizeFhirTarget(fallbackFhirBaseUrl);
  if (!fallback || primary === fallback) return false;
  if (!shouldUseUniqueDemoKeys(primary) || !shouldUseUniqueDemoKeys(fallback)) return false;
  return !primaryAttempt.ok && (primaryAttempt.status === 0 || primaryAttempt.status === 429 || primaryAttempt.status >= 500);
}

function buildTransactionResponsePayload(finalAttempt, primaryAttempt, fallbackUsed) {
  const payload = {
    status: finalAttempt.status,
    ok: finalAttempt.ok,
    body: finalAttempt.body,
    attempted_url: finalAttempt.fhirBaseUrl
  };
  if (finalAttempt.error) {
    payload.error = finalAttempt.error;
  }
  if (fallbackUsed) {
    payload.fallback_used = true;
    payload.primary_response = {
      status: primaryAttempt.status,
      ok: primaryAttempt.ok,
      body: primaryAttempt.body,
      attempted_url: primaryAttempt.fhirBaseUrl
    };
    if (primaryAttempt.error) {
      payload.primary_response.error = primaryAttempt.error;
    }
  }
  return payload;
}

async function processDeliveryCheckPayload(payload, options = {}) {
  const deliveryPayload = preparePayloadForDeliveryTarget(payload, options.fhirBaseUrl);
  const bundleResult = buildSessionExportBundle(deliveryPayload);
  const quickCheck = summarizeQuickCheck(bundleResult, options);

  appendDeliveryDebugLog({
    phase: 'quick_check',
    deliveryStatus: quickCheck.can_deliver ? 'ready' : 'blocked',
    fhirBaseUrl: options.fhirBaseUrl || '',
    patientKey: deliveryPayload?.patient?.key || '',
    encounterKey: deliveryPayload?.session?.encounterKey || '',
    reasons: quickCheck.reasons || [],
    validation: quickCheck.validation || {}
  });

  return {
    statusCode: 200,
    body: {
      ok: true,
      quick_check: quickCheck
    }
  };
}

async function processExportPayload(payload, options = {}) {
  const deliveryPayload = preparePayloadForDeliveryTarget(payload, options.fhirBaseUrl);
  const bundleResult = buildSessionExportBundle(deliveryPayload);
  const response = {
    delivery_status: 'blocked',
    mode: options.fhirBaseUrl ? 'transaction' : 'dry_run',
    fhir_base_url: options.fhirBaseUrl || '',
    bundle_result: bundleResult,
    transaction_response: null
  };

  if (!bundleResult.bundle_json) {
    appendDeliveryDebugLog({
      phase: 'bundle_missing',
      deliveryStatus: 'blocked',
      fhirBaseUrl: options.fhirBaseUrl || '',
      patientKey: deliveryPayload?.patient?.key || '',
      encounterKey: deliveryPayload?.session?.encounterKey || '',
      blockingReasons: bundleResult.blocking_reasons || []
    });
    return {
      statusCode: 422,
      body: Object.assign(response, {
        delivery_status: 'blocked'
      })
    };
  }

  if (bundleResult.validation_report && !bundleResult.validation_report.valid) {
    appendDeliveryDebugLog({
      phase: 'validation_failed',
      deliveryStatus: 'validation_failed',
      fhirBaseUrl: options.fhirBaseUrl || '',
      patientKey: deliveryPayload?.patient?.key || '',
      encounterKey: deliveryPayload?.session?.encounterKey || '',
      validationIssues: bundleResult.validation_report.issues || []
    });
    return {
      statusCode: 422,
      body: Object.assign(response, {
        delivery_status: 'validation_failed'
      })
    };
  }

  if (!options.fhirBaseUrl) {
    appendDeliveryDebugLog({
      phase: 'dry_run_ready',
      deliveryStatus: 'dry_run_ready',
      fhirBaseUrl: '',
      patientKey: deliveryPayload?.patient?.key || '',
      encounterKey: deliveryPayload?.session?.encounterKey || ''
    });
    return {
      statusCode: 200,
      body: Object.assign(response, {
        delivery_status: 'dry_run_ready'
      })
    };
  }

  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    appendDeliveryDebugLog({
      phase: 'server_misconfigured',
      deliveryStatus: 'server_misconfigured',
      fhirBaseUrl: options.fhirBaseUrl || '',
      patientKey: deliveryPayload?.patient?.key || '',
      encounterKey: deliveryPayload?.session?.encounterKey || ''
    });
    return {
      statusCode: 500,
      body: Object.assign(response, {
        delivery_status: 'server_misconfigured',
        transaction_response: {
          error: 'No fetch implementation is available for FHIR transaction delivery.'
        }
      })
    };
  }

  try {
    const primaryAttempt = await sendFhirTransactionAttempt(fetchImpl, options.fhirBaseUrl, bundleResult.bundle_json);
    const fallbackFhirBaseUrl = String(options.fallbackFhirBaseUrl || DEFAULT_PUBLIC_FHIR_BASE_URL).trim();
    const shouldUseFallback = shouldRetryOnPublicDemoFallback(primaryAttempt, options.fhirBaseUrl, fallbackFhirBaseUrl);
    const finalAttempt = shouldUseFallback
      ? await sendFhirTransactionAttempt(fetchImpl, fallbackFhirBaseUrl, bundleResult.bundle_json)
      : primaryAttempt;
    const fallbackUsed = shouldUseFallback && finalAttempt.ok;

    const result = {
      statusCode: finalAttempt.ok ? 200 : 502,
      body: Object.assign(response, {
        delivery_status: finalAttempt.ok ? 'delivered' : 'transaction_failed',
        fhir_base_url: finalAttempt.fhirBaseUrl,
        transaction_response: buildTransactionResponsePayload(finalAttempt, primaryAttempt, fallbackUsed)
      })
    };
    const createdResources = buildCreatedResourceMap(finalAttempt.body);
    appendDeliveryDebugLog({
      phase: 'transaction_response',
      deliveryStatus: result.body.delivery_status,
      fhirBaseUrl: finalAttempt.fhirBaseUrl || '',
      primaryFhirBaseUrl: primaryAttempt.fhirBaseUrl || '',
      fallbackUsed,
      patientKey: deliveryPayload?.patient?.key || '',
      encounterKey: deliveryPayload?.session?.encounterKey || '',
      httpStatus: finalAttempt.status,
      createdResources,
      diagnostics: Array.isArray(finalAttempt.body?.issue)
        ? finalAttempt.body.issue.map((issue) => issue?.diagnostics || issue?.details?.text || issue?.code || '').filter(Boolean)
        : []
    });
    return result;
  } catch (error) {
    appendDeliveryDebugLog({
      phase: 'transaction_exception',
      deliveryStatus: 'transaction_failed',
      fhirBaseUrl: options.fhirBaseUrl || '',
      patientKey: deliveryPayload?.patient?.key || '',
      encounterKey: deliveryPayload?.session?.encounterKey || '',
      error: error.message
    });
    return {
      statusCode: 502,
      body: Object.assign(response, {
        delivery_status: 'transaction_failed',
        transaction_response: {
          error: error.message
        }
      })
    };
  }
}

async function processResourceRefreshPayload(payload, options = {}) {
  const resourceType = String(payload?.resource_type || '').trim();
  const resourcePath = normalizeResourcePath(payload?.resource_path);
  const sessionExport = payload?.session_export && typeof payload.session_export === 'object'
    ? payload.session_export
    : {};
  const response = {
    refresh_status: 'blocked',
    resource_type: resourceType,
    resource_path: resourcePath,
    fhir_base_url: options.fhirBaseUrl || '',
    validation_errors: [],
    build_result: null,
    resource_result: null
  };

  if (resourceType !== 'Patient') {
    return {
      statusCode: 422,
      body: Object.assign(response, {
        validation_errors: ['Only Patient refresh is supported right now.']
      })
    };
  }

  if (!/^Patient\/[^/]+$/i.test(resourcePath)) {
    return {
      statusCode: 422,
      body: Object.assign(response, {
        validation_errors: ['resource_path must point to an existing Patient resource.']
      })
    };
  }

  if (!options.fhirBaseUrl) {
    return {
      statusCode: 422,
      body: Object.assign(response, {
        validation_errors: ['FHIR_SERVER_URL is not configured, so Patient refresh cannot be sent.']
      })
    };
  }

  const patientBuild = buildPatientResourceOnly(sessionExport);
  if (!patientBuild.valid || !patientBuild.resource_json) {
    return {
      statusCode: 422,
      body: Object.assign(response, {
        build_result: {
          valid: false,
          validation_errors: patientBuild.validation_errors || ['Unable to build Patient resource.'],
          resource_json: null
        },
        validation_errors: patientBuild.validation_errors || ['Unable to build Patient resource.']
      })
    };
  }

  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    return {
      statusCode: 500,
      body: Object.assign(response, {
        refresh_status: 'server_misconfigured',
        resource_result: {
          error: 'No fetch implementation is available for Patient refresh.'
        }
      })
    };
  }

  const normalizedBaseUrl = normalizeFhirTarget(options.fhirBaseUrl);
  const requestUrl = `${normalizedBaseUrl}/${resourcePath}`;
  const [, resourceId = ''] = resourcePath.split('/');
  const patientResource = JSON.parse(JSON.stringify(patientBuild.resource_json));
  patientResource.id = resourceId;
  response.build_result = {
    valid: true,
    validation_errors: [],
    resource_json: patientResource
  };

  try {
    const refreshResponse = await fetchImpl(requestUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/fhir+json'
      },
      body: JSON.stringify(patientResource)
    });
    const parsed = await readFetchResponse(refreshResponse);

    appendDeliveryDebugLog({
      phase: 'patient_refresh',
      deliveryStatus: refreshResponse.ok ? 'resource_refreshed' : 'resource_refresh_failed',
      fhirBaseUrl: normalizedBaseUrl,
      patientKey: patientResource.identifier?.[0]?.value || '',
      encounterKey: sessionExport?.session?.encounterKey || '',
      resourcePath,
      httpStatus: refreshResponse.status
    });

    return {
      statusCode: refreshResponse.ok ? 200 : 502,
        body: Object.assign(response, {
          refresh_status: refreshResponse.ok ? 'refreshed' : 'refresh_failed',
          resource_result: {
            status: refreshResponse.status,
            ok: refreshResponse.ok,
            body: parsed,
            submitted_resource: patientResource,
            label: resourcePath,
            path: resourcePath,
            url: requestUrl
          }
        })
    };
  } catch (error) {
    appendDeliveryDebugLog({
      phase: 'patient_refresh_failed',
      deliveryStatus: 'resource_refresh_failed',
      fhirBaseUrl: normalizedBaseUrl,
      patientKey: patientResource.identifier?.[0]?.value || '',
      encounterKey: sessionExport?.session?.encounterKey || '',
      resourcePath,
      error: error.message
    });
    return {
      statusCode: 502,
        body: Object.assign(response, {
          refresh_status: 'refresh_failed',
          resource_result: {
            error: error.message,
            submitted_resource: patientResource
          }
        })
      };
  }
}

async function processChatPayload(payload, options = {}) {
  const provider = inferProvider({
    provider: payload.api_provider || options.llmProvider || '',
    baseUrl: payload.api_base_url || options.googleBaseUrl || options.openrouterBaseUrl || options.groqBaseUrl || ''
  }) || (payload.api_provider || options.llmProvider || (options.googleApiKey || process.env.GOOGLE_API_KEY ? 'google' : options.openrouterApiKey || process.env.OPENROUTER_API_KEY ? 'openrouter' : 'groq'));
  const apiKey = (
    provider === 'google'
      ? (payload.api_key || options.googleApiKey || '')
      : provider === 'openrouter'
        ? (payload.api_key || options.openrouterApiKey || '')
        : (payload.api_key || options.groqApiKey || '')
  ).trim();
  const apiBaseUrl = (
    provider === 'google'
      ? (payload.api_base_url || options.googleBaseUrl || DEFAULT_GOOGLE_BASE_URL)
      : provider === 'openrouter'
        ? (payload.api_base_url || options.openrouterBaseUrl || DEFAULT_OPENROUTER_BASE_URL)
        : (payload.api_base_url || options.groqBaseUrl || DEFAULT_GROQ_BASE_URL)
  ).trim();
  const apiModel = String(payload.api_model || options.llmModel || (provider === 'google' ? DEFAULT_GOOGLE_MODEL : provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : '')).trim();
  const user = (payload.user || 'web-demo-user').trim();
  const message = (payload.message || '').trim();
  const hasRequestModelConfig = Boolean(payload.api_key || payload.api_provider || payload.api_base_url || payload.api_model);

  if (!message) {
    return {
      statusCode: 400,
      body: { error: 'Message is required.' }
    };
  }

  try {
    const engine = !hasRequestModelConfig && options.engine ? options.engine : new AICompanionEngine({
      provider,
      apiKey,
      baseUrl: apiBaseUrl,
      model: apiModel || undefined,
      fetchImpl: options.fetchImpl,
      sessions: options.sessions
    });
    const result = await engine.handleMessage(
      {
        message,
        inputs: payload.inputs || {},
        user,
        conversation_id: payload.conversation_id || '',
        force_new_session: Boolean(payload.force_new_session),
        force_memory_compression: Boolean(payload.force_memory_compression),
        therapeutic_profile: payload.therapeutic_profile || null,
        patient_profile: payload.patient_profile || null
      }
    );

    return {
      statusCode: 200,
      body: {
        ok: true,
        hidden: Boolean(payload.hide_response),
        conversation_id: result.conversation_id,
        answer: payload.hide_response ? '' : result.answer,
        message_id: result.message_id,
        metadata: Object.assign({}, result.metadata, {
          provider,
          model: apiModel || (provider === 'google' ? DEFAULT_GOOGLE_MODEL : provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : undefined)
        }),
        session_export: result.session_export || null
      }
    };
  } catch (error) {
    return {
      statusCode: error.status || 502,
      body: {
        error: error.message,
        code: error.code || 'ai_companion_proxy_error',
        status: error.status || 502,
        conversation_id: payload.conversation_id || ''
      }
    };
  }
}

async function processOutputPayload(payload, options = {}) {
  const provider = inferProvider({
    provider: payload.api_provider || options.llmProvider || '',
    baseUrl: payload.api_base_url || options.googleBaseUrl || options.openrouterBaseUrl || options.groqBaseUrl || ''
  }) || (payload.api_provider || options.llmProvider || (options.googleApiKey || process.env.GOOGLE_API_KEY ? 'google' : options.openrouterApiKey || process.env.OPENROUTER_API_KEY ? 'openrouter' : 'groq'));
  const apiKey = (
    provider === 'google'
      ? (payload.api_key || options.googleApiKey || '')
      : provider === 'openrouter'
        ? (payload.api_key || options.openrouterApiKey || '')
        : (payload.api_key || options.groqApiKey || '')
  ).trim();
  const apiBaseUrl = (
    provider === 'google'
      ? (payload.api_base_url || options.googleBaseUrl || DEFAULT_GOOGLE_BASE_URL)
      : provider === 'openrouter'
        ? (payload.api_base_url || options.openrouterBaseUrl || DEFAULT_OPENROUTER_BASE_URL)
        : (payload.api_base_url || options.groqBaseUrl || DEFAULT_GROQ_BASE_URL)
  ).trim();
  const apiModel = String(payload.api_model || options.llmModel || (provider === 'google' ? DEFAULT_GOOGLE_MODEL : provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : '')).trim();
  const user = (payload.user || 'web-demo-user').trim();
  const outputType = String(payload.output_type || '').trim();
  const hasRequestModelConfig = Boolean(payload.api_key || payload.api_provider || payload.api_base_url || payload.api_model);

  if (!outputType) {
    return {
      statusCode: 400,
      body: { error: 'output_type is required.' }
    };
  }

  try {
    const engine = !hasRequestModelConfig && options.engine ? options.engine : new AICompanionEngine({
      provider,
      apiKey,
      baseUrl: apiBaseUrl,
      model: apiModel || undefined,
      fetchImpl: options.fetchImpl,
      sessions: options.sessions
    });
    const result = await engine.generateOutput({
      conversation_id: payload.conversation_id || '',
      force_new_session: Boolean(payload.force_new_session),
      force_refresh: Boolean(payload.force_refresh),
      client_history: Array.isArray(payload.client_history) ? payload.client_history : [],
      therapeutic_profile: payload.therapeutic_profile || null,
      patient_profile: payload.patient_profile || null,
      user,
      output_type: outputType,
      instruction: payload.instruction || ''
    });

    return {
      statusCode: 200,
      body: Object.assign(
        {
          ok: true
        },
        result,
        {
          metadata: Object.assign({}, result.metadata, {
            provider,
            model: apiModel || (provider === 'google' ? DEFAULT_GOOGLE_MODEL : provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : undefined)
          })
        }
      )
    };
  } catch (error) {
    return {
      statusCode: error.status || 502,
      body: {
        error: error.message,
        code: error.code || 'ai_companion_output_error',
        status: error.status || 502,
        conversation_id: payload.conversation_id || '',
        output_type: outputType
      }
    };
  }
}

function createServer(options = {}) {
  const persistence = options.sessionPersistence || (
    options.sessions
      ? {
          filePath: options.sessionStorePath || 'memory://ai-companion-sessions',
          sessions: options.sessions,
          save() {}
        }
      : createSessionPersistence({
          filePath: options.sessionStorePath || process.env.AI_COMPANION_SESSION_STORE || DEFAULT_SESSION_STORE_PATH
        })
  );
  const activeFhirBaseUrl = String(options.fhirBaseUrl || '').trim();
  const sharedSessions = options.sessions || persistence.sessions || new Map();
  const sharedProvider = options.llmProvider || (options.googleApiKey || process.env.GOOGLE_API_KEY ? 'google' : options.openrouterApiKey || process.env.OPENROUTER_API_KEY ? 'openrouter' : 'groq');
  const sharedEngine = options.engine || new AICompanionEngine({
    provider: sharedProvider,
    apiKey:
      sharedProvider === 'google'
        ? (options.googleApiKey || '')
        : sharedProvider === 'openrouter'
          ? (options.openrouterApiKey || '')
          : (options.groqApiKey || ''),
    baseUrl:
      sharedProvider === 'google'
        ? (options.googleBaseUrl || DEFAULT_GOOGLE_BASE_URL)
        : sharedProvider === 'openrouter'
          ? (options.openrouterBaseUrl || DEFAULT_OPENROUTER_BASE_URL)
          : (options.groqBaseUrl || DEFAULT_GROQ_BASE_URL),
    model: options.llmModel || (sharedProvider === 'google' ? DEFAULT_GOOGLE_MODEL : sharedProvider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : undefined),
    fetchImpl: options.fetchImpl,
    sessions: sharedSessions,
    onSessionsChanged: (sessions) => persistence.save(sessions)
  });

  return http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && sendStaticFile(res, parsedUrl.pathname)) {
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/health') {
      const defaultApiBaseUrl =
        sharedProvider === 'google'
          ? (options.googleBaseUrl || DEFAULT_GOOGLE_BASE_URL)
          : sharedProvider === 'openrouter'
            ? (options.openrouterBaseUrl || DEFAULT_OPENROUTER_BASE_URL)
            : (options.groqBaseUrl || DEFAULT_GROQ_BASE_URL);
      const defaultModel =
        options.llmModel ||
        (sharedProvider === 'google'
          ? DEFAULT_GOOGLE_MODEL
          : sharedProvider === 'openrouter'
            ? DEFAULT_OPENROUTER_MODEL
            : '');
      sendJson(res, 200, {
        ok: true,
        ai_engine: 'node',
        provider: sharedProvider,
        default_api_base_url: defaultApiBaseUrl,
        default_model: defaultModel,
        fhir_delivery_mode: activeFhirBaseUrl ? 'transaction' : 'dry_run',
        fhir_server_url: activeFhirBaseUrl,
        groq_configured: Boolean(options.groqApiKey || process.env.GROQ_API_KEY),
        openrouter_configured: Boolean(options.openrouterApiKey || process.env.OPENROUTER_API_KEY),
        google_configured: Boolean(options.googleApiKey || process.env.GOOGLE_API_KEY)
      });
      return;
    }

    if (req.method === 'GET' && parsedUrl.pathname === '/api/chat/sessions') {
      const user = String(parsedUrl.searchParams.get('user') || '').trim();
      const limit = Number(parsedUrl.searchParams.get('limit') || 5);
      sendJson(res, 200, {
        ok: true,
        sessions: listSessionSummaries(sharedSessions, { user, limit })
      });
      return;
    }

    if ((req.method === 'GET' || req.method === 'DELETE') && parsedUrl.pathname === '/api/chat/session') {
      const sessionId = String(parsedUrl.searchParams.get('id') || '').trim();
      if (!sessionId) {
        sendJson(res, 400, { error: 'Session id is required.' });
        return;
      }

      if (req.method === 'DELETE') {
        if (!sharedSessions.has(sessionId)) {
          sendJson(res, 404, { error: 'Session not found.' });
          return;
        }

        sharedSessions.delete(sessionId);
        persistence.save(sharedSessions);
        sendJson(res, 200, {
          ok: true,
          deleted: true,
          session_id: sessionId
        });
        return;
      }

      const session = sharedSessions.get(sessionId);
      if (!session) {
        sendJson(res, 404, { error: 'Session not found.' });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        session: {
          id: session.id,
          user: session.user || 'web-demo-user',
          startedAt: session.startedAt || '',
          updatedAt: session.updatedAt || '',
          history: Array.isArray(session.history) ? session.history : [],
          state: session.state && typeof session.state === 'object' ? session.state : {},
          revision: Number.isFinite(Number(session.revision)) ? Number(session.revision) : 0,
          memory_snapshot: session.memory_snapshot && typeof session.memory_snapshot === 'object'
            ? session.memory_snapshot
            : {},
          output_cache: session.output_cache && typeof session.output_cache === 'object'
            ? session.output_cache
            : {}
        }
      });
      return;
    }

    if (!['POST', 'PATCH'].includes(req.method) || !['/api/fhir/bundle', '/api/fhir/check', '/api/fhir/resource-refresh', '/api/chat/message', '/api/chat/output', '/api/chat/session'].includes(parsedUrl.pathname)) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on('end', async () => {
      let payload;
      try {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch (error) {
        sendJson(res, 400, { error: 'Invalid JSON body' });
        return;
      }

      if (req.method === 'PATCH' && parsedUrl.pathname === '/api/chat/session') {
        const sessionId = String(parsedUrl.searchParams.get('id') || '').trim();
        if (!sessionId) {
          sendJson(res, 400, { error: 'Session id is required.' });
          return;
        }

        const session = sharedSessions.get(sessionId);
        if (!session) {
          sendJson(res, 404, { error: 'Session not found.' });
          return;
        }

        let updated = false;
        session.state = session.state && typeof session.state === 'object' ? session.state : {};

        if (payload.therapeutic_profile && typeof payload.therapeutic_profile === 'object') {
          session.state.therapeutic_profile = payload.therapeutic_profile;
          updated = true;
        }

        if (payload.patient_profile && typeof payload.patient_profile === 'object') {
          session.state.patient_profile = payload.patient_profile;
          updated = true;
        }

        if (updated) {
          session.updatedAt = new Date().toISOString();
          persistence.save(sharedSessions);
        }

        sendJson(res, 200, { ok: true, updated, session_id: sessionId });
        return;
      }

      const result =
        parsedUrl.pathname === '/api/chat/message'
          ? await processChatPayload(payload, Object.assign({}, options, { engine: sharedEngine, sessions: sharedSessions }))
          : parsedUrl.pathname === '/api/chat/output'
            ? await processOutputPayload(payload, Object.assign({}, options, { engine: sharedEngine, sessions: sharedSessions }))
            : parsedUrl.pathname === '/api/fhir/resource-refresh'
              ? await processResourceRefreshPayload(payload, options)
            : parsedUrl.pathname === '/api/fhir/check'
              ? await processDeliveryCheckPayload(payload, options)
              : await processExportPayload(payload, options);
      sendJson(res, result.statusCode, result.body);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  const fhirBaseUrl = String(process.env.FHIR_SERVER_URL || DEFAULT_PUBLIC_FHIR_BASE_URL).trim();
  const groqApiKey = process.env.GROQ_API_KEY || '';
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const googleApiKey = process.env.GOOGLE_API_KEY || '';
  const groqBaseUrl = process.env.GROQ_API_BASE_URL || DEFAULT_GROQ_BASE_URL;
  const openrouterBaseUrl = process.env.OPENROUTER_API_BASE_URL || DEFAULT_OPENROUTER_BASE_URL;
  const googleBaseUrl = process.env.GOOGLE_API_BASE_URL || DEFAULT_GOOGLE_BASE_URL;
  const llmProvider = process.env.LLM_PROVIDER || (googleApiKey ? 'google' : openrouterApiKey ? 'openrouter' : 'groq');
  const llmModel = process.env.LLM_MODEL || (llmProvider === 'google' ? DEFAULT_GOOGLE_MODEL : llmProvider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : '');
  const sessionStorePath = process.env.AI_COMPANION_SESSION_STORE || DEFAULT_SESSION_STORE_PATH;
  const server = createServer({ fhirBaseUrl, groqApiKey, groqBaseUrl, openrouterApiKey, openrouterBaseUrl, googleApiKey, googleBaseUrl, llmProvider, llmModel, sessionStorePath });
  server.listen(port, () => {
    console.log('FHIR delivery server listening on http://localhost:' + port);
    console.log('Static app available at http://localhost:' + port + '/');
    console.log('Session persistence file:', sessionStorePath);
    if (fhirBaseUrl) {
      console.log('FHIR transaction target:', fhirBaseUrl);
    } else {
      console.log('FHIR delivery server is running in dry-run mode.');
    }
    if (llmProvider === 'google' && googleApiKey) {
      console.log('AI companion engine configured for Google Gemini at', googleBaseUrl);
    } else if (llmProvider === 'openrouter' && openrouterApiKey) {
      console.log('AI companion engine configured for OpenRouter at', openrouterBaseUrl);
    } else if (groqApiKey) {
      console.log('AI companion engine configured for Groq at', groqBaseUrl);
    } else {
      console.log('AI companion engine is waiting for GOOGLE_API_KEY / OPENROUTER_API_KEY / GROQ_API_KEY or a client-provided api_key.');
    }
  });
}

module.exports = {
  DEFAULT_PUBLIC_FHIR_BASE_URL,
  processExportPayload,
  processResourceRefreshPayload,
  processDeliveryCheckPayload,
  processChatPayload,
  processOutputPayload,
  createServer
};
