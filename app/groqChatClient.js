const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_GROQ_TIMEOUT_MS = 20000;

function buildChatUrl(baseUrl) {
  return `${String(baseUrl || DEFAULT_GROQ_BASE_URL).replace(/\/+$/, '')}/chat/completions`;
}

function buildJsonInstruction() {
  return '只輸出有效 JSON，不要使用 markdown code fence，不要加任何解釋文字。';
}

async function completeWithGroq(payload, options = {}) {
  const apiKey = String(options.apiKey || '').trim();
  if (!apiKey) {
    const error = new Error('Missing Groq API key.');
    error.code = 'groq_missing_api_key';
    error.status = 500;
    throw error;
  }

  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available for Groq chat delivery.');
  }

  const timeoutMs = Number(options.timeoutMs || DEFAULT_GROQ_TIMEOUT_MS);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(new Error('Groq request timed out.')), timeoutMs);

  const messages = [];
  if (payload.systemPrompt) {
    messages.push({
      role: 'system',
      content: payload.expectJson
        ? `${payload.systemPrompt}\n\n${buildJsonInstruction()}`
        : payload.systemPrompt
    });
  }
  for (const item of payload.history || []) {
    if (!item || !item.role || !item.content) continue;
    messages.push({ role: item.role, content: item.content });
  }
  messages.push({
    role: 'user',
    content: payload.userPrompt
  });

  let response;
  try {
    response = await fetchImpl(buildChatUrl(options.baseUrl || DEFAULT_GROQ_BASE_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_GROQ_MODEL,
        temperature: payload.temperature == null ? 0.2 : payload.temperature,
        messages
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeoutHandle);
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Groq request timed out after ${timeoutMs / 1000} seconds.`);
      timeoutError.code = 'groq_timeout';
      timeoutError.status = 504;
      throw timeoutError;
    }
    const requestError = new Error(error.message || 'Failed to reach Groq.');
    requestError.code = 'groq_request_failed';
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
      parsed?.error?.message ||
      parsed?.message ||
      parsed?.raw ||
      `Groq request failed with status ${response.status}.`;
    const responseError = new Error(errorMessage);
    responseError.code = parsed?.error?.type || parsed?.code || 'groq_error';
    responseError.status = response.status;
    throw responseError;
  }

  return {
    text: parsed?.choices?.[0]?.message?.content || '',
    raw: parsed
  };
}

module.exports = {
  DEFAULT_GROQ_BASE_URL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_GROQ_TIMEOUT_MS,
  completeWithGroq
};
