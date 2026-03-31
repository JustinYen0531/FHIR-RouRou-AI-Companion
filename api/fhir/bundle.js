const { processExportPayload } = require('../../app/fhirDeliveryServer');
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

  const result = await processExportPayload(payload, {
    fhirBaseUrl: process.env.FHIR_SERVER_URL || ''
  });

  sendJson(res, result.statusCode, result.body);
};
