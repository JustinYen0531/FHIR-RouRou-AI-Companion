const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildSessionExportBundle } = require('./fhirBundleBuilder');
const { AICompanionEngine } = require('./aiCompanionEngine');
const { createSessionPersistence, DEFAULT_SESSION_STORE_PATH, listSessionSummaries } = require('./sessionPersistence');
const {
  DEFAULT_GROQ_BASE_URL,
  DEFAULT_GOOGLE_BASE_URL,
  DEFAULT_GOOGLE_MODEL,
  inferProvider
} = require('./llmChatClient');

const APP_DIR = __dirname;
const DEFAULT_PUBLIC_FHIR_BASE_URL = 'https://hapi.fhir.org/baseR4';
const STATIC_FILES = {
  '/': { filePath: path.join(APP_DIR, 'index.html'), contentType: 'text/html; charset=utf-8' },
  '/index.html': { filePath: path.join(APP_DIR, 'index.html'), contentType: 'text/html; charset=utf-8' },
  '/app.js': { filePath: path.join(APP_DIR, 'app.js'), contentType: 'application/javascript; charset=utf-8' },
  '/microInterventionRules.js': { filePath: path.join(APP_DIR, 'microInterventionRules.js'), contentType: 'application/javascript; charset=utf-8' },
  '/style.css': { filePath: path.join(APP_DIR, 'style.css'), contentType: 'text/css; charset=utf-8' }
};

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(body, null, 2));
}

function sendStaticFile(res, pathname) {
  const match = STATIC_FILES[pathname];
  if (!match) {
    if (pathname.startsWith('/docs/')) {
      const relativePath = pathname.replace(/^\/+/, '');
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

async function processExportPayload(payload, options = {}) {
  const bundleResult = buildSessionExportBundle(payload);
  const response = {
    delivery_status: 'blocked',
    mode: options.fhirBaseUrl ? 'transaction' : 'dry_run',
    fhir_base_url: options.fhirBaseUrl || '',
    bundle_result: bundleResult,
    transaction_response: null
  };

  if (!bundleResult.bundle_json) {
    return {
      statusCode: 422,
      body: Object.assign(response, {
        delivery_status: 'blocked'
      })
    };
  }

  if (bundleResult.validation_report && !bundleResult.validation_report.valid) {
    return {
      statusCode: 422,
      body: Object.assign(response, {
        delivery_status: 'validation_failed'
      })
    };
  }

  if (!options.fhirBaseUrl) {
    return {
      statusCode: 200,
      body: Object.assign(response, {
        delivery_status: 'dry_run_ready'
      })
    };
  }

  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
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
    const transactionResponse = await fetchImpl(options.fhirBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json'
      },
      body: JSON.stringify(bundleResult.bundle_json)
    });

    const text = await transactionResponse.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch (error) {
      parsed = { raw: text };
    }

    return {
      statusCode: transactionResponse.ok ? 200 : 502,
      body: Object.assign(response, {
        delivery_status: transactionResponse.ok ? 'delivered' : 'transaction_failed',
        transaction_response: {
          status: transactionResponse.status,
          ok: transactionResponse.ok,
          body: parsed
        }
      })
    };
  } catch (error) {
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

async function processChatPayload(payload, options = {}) {
  const provider = inferProvider({
    provider: payload.api_provider || options.llmProvider || '',
    baseUrl: payload.api_base_url || options.googleBaseUrl || options.groqBaseUrl || ''
  }) || (payload.api_provider || options.llmProvider || (options.googleApiKey || process.env.GOOGLE_API_KEY ? 'google' : 'groq'));
  const apiKey = (
    provider === 'google'
      ? (payload.api_key || options.googleApiKey || '')
      : (payload.api_key || options.groqApiKey || '')
  ).trim();
  const apiBaseUrl = (
    provider === 'google'
      ? (payload.api_base_url || options.googleBaseUrl || DEFAULT_GOOGLE_BASE_URL)
      : (payload.api_base_url || options.groqBaseUrl || DEFAULT_GROQ_BASE_URL)
  ).trim();
  const apiModel = String(payload.api_model || options.llmModel || (provider === 'google' ? DEFAULT_GOOGLE_MODEL : '')).trim();
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
        conversation_id: payload.conversation_id || ''
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
          model: apiModel || (provider === 'google' ? DEFAULT_GOOGLE_MODEL : undefined)
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
    baseUrl: payload.api_base_url || options.googleBaseUrl || options.groqBaseUrl || ''
  }) || (payload.api_provider || options.llmProvider || (options.googleApiKey || process.env.GOOGLE_API_KEY ? 'google' : 'groq'));
  const apiKey = (
    provider === 'google'
      ? (payload.api_key || options.googleApiKey || '')
      : (payload.api_key || options.groqApiKey || '')
  ).trim();
  const apiBaseUrl = (
    provider === 'google'
      ? (payload.api_base_url || options.googleBaseUrl || DEFAULT_GOOGLE_BASE_URL)
      : (payload.api_base_url || options.groqBaseUrl || DEFAULT_GROQ_BASE_URL)
  ).trim();
  const apiModel = String(payload.api_model || options.llmModel || (provider === 'google' ? DEFAULT_GOOGLE_MODEL : '')).trim();
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
            model: apiModel || (provider === 'google' ? DEFAULT_GOOGLE_MODEL : undefined)
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
  const persistence = options.sessionPersistence || createSessionPersistence({
    filePath: options.sessionStorePath || process.env.AI_COMPANION_SESSION_STORE || DEFAULT_SESSION_STORE_PATH
  });
  const activeFhirBaseUrl = String(options.fhirBaseUrl || '').trim();
  const sharedSessions = options.sessions || persistence.sessions || new Map();
  const sharedProvider = options.llmProvider || (options.googleApiKey || process.env.GOOGLE_API_KEY ? 'google' : 'groq');
  const sharedEngine = options.engine || new AICompanionEngine({
    provider: sharedProvider,
    apiKey: sharedProvider === 'google' ? (options.googleApiKey || '') : (options.groqApiKey || ''),
    baseUrl:
      sharedProvider === 'google'
        ? (options.googleBaseUrl || DEFAULT_GOOGLE_BASE_URL)
        : (options.groqBaseUrl || DEFAULT_GROQ_BASE_URL),
    model: options.llmModel || (sharedProvider === 'google' ? DEFAULT_GOOGLE_MODEL : undefined),
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
      sendJson(res, 200, {
        ok: true,
        ai_engine: 'node',
        provider: sharedProvider,
        fhir_delivery_mode: activeFhirBaseUrl ? 'transaction' : 'dry_run',
        fhir_server_url: activeFhirBaseUrl,
        groq_configured: Boolean(options.groqApiKey || process.env.GROQ_API_KEY),
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

    if (req.method !== 'POST' || !['/api/fhir/bundle', '/api/chat/message', '/api/chat/output'].includes(parsedUrl.pathname)) {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
    });

    req.on('end', async () => {
      let payload;
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch (error) {
        sendJson(res, 400, { error: 'Invalid JSON body' });
        return;
      }

      const result =
        parsedUrl.pathname === '/api/chat/message'
          ? await processChatPayload(payload, Object.assign({}, options, { engine: sharedEngine, sessions: sharedSessions }))
          : parsedUrl.pathname === '/api/chat/output'
            ? await processOutputPayload(payload, Object.assign({}, options, { engine: sharedEngine, sessions: sharedSessions }))
            : await processExportPayload(payload, options);
      sendJson(res, result.statusCode, result.body);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  const fhirBaseUrl = String(process.env.FHIR_SERVER_URL || DEFAULT_PUBLIC_FHIR_BASE_URL).trim();
  const groqApiKey = process.env.GROQ_API_KEY || '';
  const googleApiKey = process.env.GOOGLE_API_KEY || '';
  const groqBaseUrl = process.env.GROQ_API_BASE_URL || DEFAULT_GROQ_BASE_URL;
  const googleBaseUrl = process.env.GOOGLE_API_BASE_URL || DEFAULT_GOOGLE_BASE_URL;
  const llmProvider = process.env.LLM_PROVIDER || (googleApiKey ? 'google' : 'groq');
  const llmModel = process.env.LLM_MODEL || (llmProvider === 'google' ? DEFAULT_GOOGLE_MODEL : '');
  const sessionStorePath = process.env.AI_COMPANION_SESSION_STORE || DEFAULT_SESSION_STORE_PATH;
  const server = createServer({ fhirBaseUrl, groqApiKey, groqBaseUrl, googleApiKey, googleBaseUrl, llmProvider, llmModel, sessionStorePath });
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
    } else if (groqApiKey) {
      console.log('AI companion engine configured for Groq at', groqBaseUrl);
    } else {
      console.log('AI companion engine is waiting for GOOGLE_API_KEY / GROQ_API_KEY or a client-provided api_key.');
    }
  });
}

module.exports = {
  processExportPayload,
  processChatPayload,
  processOutputPayload,
  createServer
};
