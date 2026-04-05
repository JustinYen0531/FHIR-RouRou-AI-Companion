const { buildServerOptions } = require('./_options');
const { handleCors, sendJson } = require('./_shared');

module.exports = function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const options = buildServerOptions();
  const defaultApiBaseUrl =
    options.llmProvider === 'google'
      ? options.googleBaseUrl
      : options.llmProvider === 'openrouter'
        ? options.openrouterBaseUrl
        : options.groqBaseUrl;
  sendJson(res, 200, {
    ok: true,
    ai_engine: 'node',
    provider: options.llmProvider,
    default_api_base_url: defaultApiBaseUrl,
    default_model: options.llmModel,
    fhir_delivery_mode: options.fhirBaseUrl ? 'transaction' : 'dry_run',
    fhir_server_url: options.fhirBaseUrl,
    groq_configured: Boolean(options.groqApiKey),
    openrouter_configured: Boolean(options.openrouterApiKey),
    google_configured: Boolean(options.googleApiKey)
  });
};
