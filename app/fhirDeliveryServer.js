const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildSessionExportBundle } = require('./fhirBundleBuilder');
const { AICompanionEngine } = require('./aiCompanionEngine');
const { DEFAULT_GROQ_BASE_URL } = require('./groqChatClient');

const APP_DIR = __dirname;
const STATIC_FILES = {
  '/': { filePath: path.join(APP_DIR, 'index.html'), contentType: 'text/html; charset=utf-8' },
  '/index.html': { filePath: path.join(APP_DIR, 'index.html'), contentType: 'text/html; charset=utf-8' },
  '/app.js': { filePath: path.join(APP_DIR, 'app.js'), contentType: 'application/javascript; charset=utf-8' },
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
  const apiKey = (options.groqApiKey || payload.api_key || '').trim();
  const apiBaseUrl = (options.groqBaseUrl || payload.api_base_url || DEFAULT_GROQ_BASE_URL).trim();
  const user = (payload.user || 'web-demo-user').trim();
  const message = (payload.message || '').trim();

  if (!message) {
    return {
      statusCode: 400,
      body: { error: 'Message is required.' }
    };
  }

  try {
    const engine = options.engine || new AICompanionEngine({
      apiKey,
      baseUrl: apiBaseUrl,
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
        metadata: result.metadata,
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

function createServer(options = {}) {
  const sharedSessions = options.sessions || new Map();
  const sharedEngine = options.engine || new AICompanionEngine({
    apiKey: options.groqApiKey || '',
    baseUrl: options.groqBaseUrl || DEFAULT_GROQ_BASE_URL,
    fetchImpl: options.fetchImpl,
    sessions: sharedSessions
  });

  return http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && sendStaticFile(res, req.url)) {
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, {
        ok: true,
        groq_configured: Boolean(options.groqApiKey || process.env.GROQ_API_KEY),
        ai_engine: 'node'
      });
      return;
    }

    if (req.method !== 'POST' || !['/api/fhir/bundle', '/api/chat/message'].includes(req.url)) {
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
        req.url === '/api/chat/message'
          ? await processChatPayload(payload, Object.assign({}, options, { engine: sharedEngine, sessions: sharedSessions }))
          : await processExportPayload(payload, options);
      sendJson(res, result.statusCode, result.body);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  const fhirBaseUrl = process.env.FHIR_SERVER_URL || '';
  const groqApiKey = process.env.GROQ_API_KEY || '';
  const groqBaseUrl = process.env.GROQ_API_BASE_URL || DEFAULT_GROQ_BASE_URL;
  const server = createServer({ fhirBaseUrl, groqApiKey, groqBaseUrl });
  server.listen(port, () => {
    console.log('FHIR delivery server listening on http://localhost:' + port);
    console.log('Static app available at http://localhost:' + port + '/');
    if (fhirBaseUrl) {
      console.log('FHIR transaction target:', fhirBaseUrl);
    } else {
      console.log('FHIR delivery server is running in dry-run mode.');
    }
    if (groqApiKey) {
      console.log('AI companion engine configured for Groq at', groqBaseUrl);
    } else {
      console.log('AI companion engine is waiting for GROQ_API_KEY or a client-provided api_key.');
    }
  });
}

module.exports = {
  processExportPayload,
  processChatPayload,
  createServer
};
