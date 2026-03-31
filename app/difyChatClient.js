const DEFAULT_DIFY_BASE_URL = 'https://api.dify.ai/v1';
const DEFAULT_DIFY_TIMEOUT_MS = 20000;

async function sendDifyChatMessage(payload, options = {}) {
  const apiKey = (options.apiKey || '').trim();
  if (!apiKey) {
    throw new Error('Missing Dify API key.');
  }

  const baseUrl = (options.baseUrl || DEFAULT_DIFY_BASE_URL).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available for Dify chat delivery.');
  }

  const timeoutMs = Number(options.timeoutMs || DEFAULT_DIFY_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(new Error('Dify request timed out.')), timeoutMs);

  let response;
  try {
    response = await fetchImpl(`${baseUrl}/chat-messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: payload.message,
        inputs: payload.inputs || {},
        user: payload.user,
        response_mode: 'blocking',
        conversation_id: payload.conversation_id || ''
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeoutHandle);
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Dify request timed out after ${timeoutMs / 1000} seconds.`);
      timeoutError.code = 'dify_timeout';
      timeoutError.status = 504;
      throw timeoutError;
    }

    const requestError = new Error(error.message || 'Failed to reach Dify.');
    requestError.code = 'dify_request_failed';
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
      `Dify request failed with status ${response.status}.`;
    const responseError = new Error(errorMessage);
    responseError.code = parsed.code || 'dify_error';
    responseError.status = response.status;
    throw responseError;
  }

  return {
    conversation_id: parsed.conversation_id || '',
    answer: parsed.answer || '',
    message_id: parsed.message_id || '',
    metadata: parsed.metadata || {}
  };
}

module.exports = {
  DEFAULT_DIFY_BASE_URL,
  DEFAULT_DIFY_TIMEOUT_MS,
  sendDifyChatMessage
};
