const {
  processChatPayload,
  processOutputPayload,
  processExportPayload,
  DEFAULT_PUBLIC_FHIR_BASE_URL
} = require('../app/fhirDeliveryServer');
const {
  createAuthStore,
  DEFAULT_AUTH_STORE_PATH
} = require('../app/authStore');
const {
  DEFAULT_SESSION_STORE_PATH,
  createSessionPersistence,
  getAuthorizedSessionUserIds,
  listSessionSummaries,
  sessionBelongsToAuthorizedUser
} = require('../app/sessionPersistence');
const {
  DEFAULT_ASSIGNMENT_STORE_PATH,
  createAssignmentPersistence
} = require('../app/assignmentPersistence');
const {
  DEFAULT_GROQ_BASE_URL,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_GOOGLE_BASE_URL,
  DEFAULT_GOOGLE_MODEL
} = require('../app/llmChatClient');

let sharedPersistence = null;
let sharedAuthStore = null;
let sharedAssignmentStore = null;

function getSharedPersistence() {
  if (!sharedPersistence) {
    sharedPersistence = createSessionPersistence({
      filePath: process.env.AI_COMPANION_SESSION_STORE || DEFAULT_SESSION_STORE_PATH
    });
  }
  return sharedPersistence;
}

function getSharedAuthStore() {
  if (!sharedAuthStore) {
    sharedAuthStore = createAuthStore({
      filePath: process.env.AI_COMPANION_AUTH_STORE || DEFAULT_AUTH_STORE_PATH
    });
  }
  return sharedAuthStore;
}

function getSharedAssignmentStore() {
  if (!sharedAssignmentStore) {
    sharedAssignmentStore = createAssignmentPersistence({
      filePath: process.env.AI_COMPANION_ASSIGNMENT_STORE || DEFAULT_ASSIGNMENT_STORE_PATH
    });
  }
  return sharedAssignmentStore;
}

function getBearerTokenFromRequest(req) {
  const header = String(req.headers?.authorization || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || '').trim() : '';
}

function getAuthUserFromRequest(req) {
  const token = getBearerTokenFromRequest(req);
  if (!token) return null;
  const authStore = getSharedAuthStore();
  const result = authStore.getSessionByToken(token);
  return result?.user || null;
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
  const assignmentStore = getSharedAssignmentStore();

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
    sessions: persistence.sessions,
    assignmentStorePath: assignmentStore.filePath,
    assignmentStore,
    authStorePath: process.env.AI_COMPANION_AUTH_STORE || DEFAULT_AUTH_STORE_PATH,
    authStore: getSharedAuthStore()
  };
}

module.exports = {
  buildServerOptions,
  getSharedAuthStore,
  getSharedAssignmentStore,
  getAuthUserFromRequest,
  getSharedPersistence,
  getAuthorizedSessionUserIds,
  sessionBelongsToAuthorizedUser,
  listSessionSummaries,
  processChatPayload,
  processOutputPayload,
  processExportPayload
};
