const DEFAULT_CHATFLOW_BASE_URL = 'http://localhost:3000';
const DEFAULT_CHATFLOW_TIMEOUT_MS = 20000;

function buildPredictionUrl(baseUrl, chatflowId) {
  const normalized = (baseUrl || DEFAULT_CHATFLOW_BASE_URL).trim().replace(/\/+$/, '');
  return `${normalized}/api/v1/prediction/${encodeURIComponent(chatflowId)}`;
}

async function sendChatflowRuntimeMessage(payload, options = {}) {
  const chatflowId = (options.chatflowId || '').trim();
  if (!chatflowId) {
    const missingIdError = new Error('Missing chatflow runtime id.');
    missingIdError.code = 'chatflow_missing_id';
    missingIdError.status = 500;
    throw missingIdError;
  }

  const baseUrl = (options.baseUrl || DEFAULT_CHATFLOW_BASE_URL).trim();
  const apiKey = (options.apiKey || '').trim();
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available for chatflow runtime delivery.');
  }

  const timeoutMs = Number(options.timeoutMs || DEFAULT_CHATFLOW_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(new Error('Chatflow runtime request timed out.')), timeoutMs);

  const sessionId = (payload.conversation_id || payload.user || '').trim();
  const overrideConfig = Object.assign({}, options.overrideConfig || {}, payload.overrideConfig || {});
  if (sessionId) {
    overrideConfig.sessionId = sessionId;
  }
  if (payload.inputs && Object.keys(payload.inputs).length > 0) {
    overrideConfig.vars = Object.assign({}, overrideConfig.vars || {}, payload.inputs);
  }

  const headers = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let response;
  try {
    response = await fetchImpl(buildPredictionUrl(baseUrl, chatflowId), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        question: payload.message,
        streaming: false,
        overrideConfig,
        history: payload.history || [],
        uploads: payload.uploads || [],
        form: payload.form || {}
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeoutHandle);
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Chatflow runtime request timed out after ${timeoutMs / 1000} seconds.`);
      timeoutError.code = 'chatflow_timeout';
      timeoutError.status = 504;
      throw timeoutError;
    }

    const requestError = new Error(error.message || 'Failed to reach chatflow runtime.');
    requestError.code = 'chatflow_request_failed';
    requestError.status = 502;
    throw requestError;
  }

  clearTimeout(timeoutHandle);

  const text = await response.text();
  let parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (error) {
    parsed = { raw: text };
  }

  if (!response.ok) {
    const errorMessage =
      parsed.message ||
      parsed.error ||
      parsed.raw ||
      `Chatflow runtime request failed with status ${response.status}.`;
    const responseError = new Error(errorMessage);
    responseError.code = parsed.code || 'chatflow_error';
    responseError.status = response.status;
    throw responseError;
  }

  const answer =
    parsed.text ||
    parsed.answer ||
    parsed.output ||
    parsed.response ||
    parsed.result ||
    '';

  const conversationId =
    parsed.sessionId ||
    parsed.session_id ||
    parsed.chatId ||
    sessionId ||
    payload.conversation_id ||
    '';

  return {
    conversation_id: conversationId,
    answer,
    message_id: parsed.chatMessageId || parsed.messageId || '',
    metadata: parsed
  };
}

module.exports = {
  DEFAULT_CHATFLOW_BASE_URL,
  DEFAULT_CHATFLOW_TIMEOUT_MS,
  sendChatflowRuntimeMessage
};

