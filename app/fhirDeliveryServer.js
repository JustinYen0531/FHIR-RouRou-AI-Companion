const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildSessionExportBundle } = require('./fhirBundleBuilder');
const { DEFAULT_FLOWISE_BASE_URL, sendFlowiseChatMessage } = require('./flowiseChatClient');

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
  const apiKey = (options.flowiseApiKey || payload.api_key || '').trim();
  const apiBaseUrl = (options.flowiseBaseUrl || payload.api_base_url || DEFAULT_FLOWISE_BASE_URL).trim();
  const chatflowId = (options.flowiseChatflowId || payload.chatflow_id || '').trim();
  const user = (payload.user || 'web-demo-user').trim();
  const message = (payload.message || '').trim();

  if (!message) {
    return {
      statusCode: 400,
      body: { error: 'Message is required.' }
    };
  }

  if (!chatflowId) {
    return {
      statusCode: 500,
      body: { error: 'Missing Flowise chatflow id. Set FLOWISE_CHATFLOW_ID or send chatflow_id from the client.' }
    };
  }

  try {
    const result = await sendFlowiseChatMessage(
      {
        message,
        inputs: payload.inputs || {},
        user,
        conversation_id: payload.conversation_id || ''
      },
      {
        apiKey,
        baseUrl: apiBaseUrl,
        chatflowId,
        fetchImpl: options.fetchImpl
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
        metadata: result.metadata
      }
    };
  } catch (error) {
    return {
      statusCode: error.status || 502,
      body: {
        error: error.message,
        code: error.code || 'flowise_proxy_error',
        status: error.status || 502,
        conversation_id: payload.conversation_id || ''
      }
    };
  }
}

function createServer(options = {}) {
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
        flowise_configured: Boolean(options.flowiseChatflowId || process.env.FLOWISE_CHATFLOW_ID),
        flowise_requires_key: Boolean(options.flowiseApiKey || process.env.FLOWISE_API_KEY)
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
          ? await processChatPayload(payload, options)
          : await processExportPayload(payload, options);
      sendJson(res, result.statusCode, result.body);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  const fhirBaseUrl = process.env.FHIR_SERVER_URL || '';
  const flowiseApiKey = process.env.FLOWISE_API_KEY || '';
  const flowiseBaseUrl = process.env.FLOWISE_API_BASE_URL || DEFAULT_FLOWISE_BASE_URL;
  const flowiseChatflowId = process.env.FLOWISE_CHATFLOW_ID || '';
  const server = createServer({ fhirBaseUrl, flowiseApiKey, flowiseBaseUrl, flowiseChatflowId });
  server.listen(port, () => {
    console.log('FHIR delivery server listening on http://localhost:' + port);
    console.log('Static app available at http://localhost:' + port + '/');
    if (fhirBaseUrl) {
      console.log('FHIR transaction target:', fhirBaseUrl);
    } else {
      console.log('FHIR delivery server is running in dry-run mode.');
    }
    if (flowiseChatflowId) {
      console.log('Flowise chat proxy configured for', flowiseBaseUrl, 'chatflow', flowiseChatflowId);
    } else {
      console.log('Flowise chat proxy is waiting for FLOWISE_CHATFLOW_ID or a client-provided chatflow_id.');
    }
  });
}

module.exports = {
  processExportPayload,
  processChatPayload,
  createServer
};
