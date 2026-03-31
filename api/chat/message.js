const { DEFAULT_DIFY_BASE_URL } = require('../../app/difyChatClient');
const { processChatPayload } = require('../../app/fhirDeliveryServer');
const { handleCors, readJsonBody, sendJson } = require('../_shared');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message });
    return;
  }

  const result = await processChatPayload(payload, {
    difyApiKey: process.env.DIFY_APP_API_KEY || process.env.DIFY_API_KEY || '',
    difyBaseUrl: process.env.DIFY_API_BASE_URL || DEFAULT_DIFY_BASE_URL
  });

  sendJson(res, result.statusCode, result.body);
};
