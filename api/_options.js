const {
  processChatPayload,
  processOutputPayload,
  processExportPayload,
  DEFAULT_PUBLIC_FHIR_BASE_URL
} = require('../app/fhirDeliveryServer');
const {
  DEFAULT_SESSION_STORE_PATH,
  createSessionPersistence,
  listSessionSummaries
} = require('../app/sessionPersistence');
const {
  DEFAULT_GROQ_BASE_URL,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_GOOGLE_BASE_URL,
  DEFAULT_GOOGLE_MODEL
} = require('../app/llmChatClient');

let sharedPersistence = null;

function getSharedPersistence() {
  if (!sharedPersistence) {
    sharedPersistence = createSessionPersistence({
      filePath: process.env.AI_COMPANION_SESSION_STORE || DEFAULT_SESSION_STORE_PATH
    });
  }
  return sharedPersistence;
}

function buildServerOptions() {
  const fhirBaseUrl = String(process.env.FHIR_SERVER_URL || DEFAULT_PUBLIC_FHIR_BASE_URL).trim();
  const groqApiKey = process.env.GROQ_API_KEY || '';
  const openrouterApiKey = process.env.OPENROUTER_API_KEY || '';
  const googleApiKey = process.env.GOOGLE_API_KEY || '';
  const groqBaseUrl = process.env.GROQ_API_BASE_URL || DEFAULT_GROQ_BASE_URL;
  const openrouterBaseUrl = process.env.OPENROUTER_API_BASE_URL || DEFAULT_OPENROUTER_BASE_URL;
  const googleBaseUrl = process.env.GOOGLE_API_BASE_URL || DEFAULT_GOOGLE_BASE_URL;
  const llmProvider = process.env.LLM_PROVIDER || (googleApiKey ? 'google' : openrouterApiKey ? 'openrouter' : 'groq');
  const llmModel =
    process.env.LLM_MODEL ||
    (llmProvider === 'google'
      ? DEFAULT_GOOGLE_MODEL
      : llmProvider === 'openrouter'
        ? DEFAULT_OPENROUTER_MODEL
        : '');
  const persistence = getSharedPersistence();

  return {
    fhirBaseUrl,
    groqApiKey,
    groqBaseUrl,
    openrouterApiKey,
    openrouterBaseUrl,
    googleApiKey,
    googleBaseUrl,
    llmProvider,
    llmModel,
    sessionStorePath: persistence.filePath,
    sessions: persistence.sessions
  };
}

module.exports = {
  buildServerOptions,
  getSharedPersistence,
  listSessionSummaries,
  processChatPayload,
  processOutputPayload,
  processExportPayload
};
