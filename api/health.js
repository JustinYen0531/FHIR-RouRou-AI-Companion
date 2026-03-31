const { DEFAULT_DIFY_BASE_URL } = require('../app/difyChatClient');
const { sendJson, sendNoContent } = require('./_shared');

module.exports = function handler(req, res) {
  if (req.method === 'OPTIONS') {
    sendNoContent(res);
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    dify_configured: Boolean(process.env.DIFY_APP_API_KEY || process.env.DIFY_API_KEY),
    dify_base_url: process.env.DIFY_API_BASE_URL || DEFAULT_DIFY_BASE_URL,
    fhir_configured: Boolean(process.env.FHIR_SERVER_URL)
  });
};
