const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_GROQ_MODEL = 'llama-3.1-8b-instant';
const DEFAULT_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_OPENROUTER_MODEL = 'deepseek/deepseek-v4-flash';
const DEFAULT_GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GOOGLE_MODEL = 'gemini-2.0-flash';
const DEFAULT_LLM_TIMEOUT_MS = 20000;
const DEFAULT_RETRY_COUNT = 2;

function buildJsonInstruction() {
  return '只輸出有效 JSON，不要使用 markdown code fence，不要加任何解釋文字。';
}

function normalizeProvider(provider) {
  const value = String(provider || '').trim().toLowerCase();
  if (value === 'gemini') return 'google';
  if (value === 'google') return 'google';
  if (value === 'groq') return 'groq';
  if (value === 'openrouter') return 'openrouter';
  return '';
}

function inferProvider(options = {}) {
  const explicit = normalizeProvider(options.provider);
  if (explicit) return explicit;
  if (String(options.baseUrl || '').includes('openrouter.ai')) return 'openrouter';
  if (String(options.baseUrl || '').includes('googleapis.com')) return 'google';
  return 'groq';
}

function createTimeoutController(timeoutMs) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(new Error('LLM request timed out.')), timeoutMs);
  return { controller, clear: () => clearTimeout(timeoutHandle) };
}

function parseJsonSafely(text) {
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    return { raw: text };
  }
}

function mapHistoryForGoogle(history = []) {
  return history
    .filter((item) => item && item.role && item.content)
    .map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(item.content) }]
    }));
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

  const timeoutMs = Number(options.timeoutMs || DEFAULT_LLM_TIMEOUT_MS);
  const timeout = createTimeoutController(timeoutMs);

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
    response = await fetchImpl(`${String(options.baseUrl || DEFAULT_GROQ_BASE_URL).replace(/\/+$/, '')}/chat/completions`, {
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
      signal: timeout.controller.signal
    });
  } catch (error) {
    timeout.clear();
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

  timeout.clear();

  const text = await response.text();
  const parsed = parseJsonSafely(text);

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

async function completeWithOpenRouter(payload, options = {}) {
  const apiKey = String(options.apiKey || '').trim();
  if (!apiKey) {
    const error = new Error('Missing OpenRouter API key.');
    error.code = 'openrouter_missing_api_key';
    error.status = 500;
    throw error;
  }

  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available for OpenRouter chat delivery.');
  }

  const timeoutMs = Number(options.timeoutMs || DEFAULT_LLM_TIMEOUT_MS);
  const timeout = createTimeoutController(timeoutMs);

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
    response = await fetchImpl(`${String(options.baseUrl || DEFAULT_OPENROUTER_BASE_URL).replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        // OpenRouter 要求附上 referer/title，否則部分模型（含 DeepSeek 路由）會被拒絕
        'HTTP-Referer': options.referer || 'https://github.com/JustinYen0531/FHIR-RouRou-AI-Companion',
        'X-Title': options.appTitle || 'RouRou AI Companion'
      },
      body: JSON.stringify({
        model: options.model || DEFAULT_OPENROUTER_MODEL,
        temperature: payload.temperature == null ? 0.2 : payload.temperature,
        messages
      }),
      signal: timeout.controller.signal
    });
  } catch (error) {
    timeout.clear();
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`OpenRouter request timed out after ${timeoutMs / 1000} seconds.`);
      timeoutError.code = 'openrouter_timeout';
      timeoutError.status = 504;
      throw timeoutError;
    }
    const requestError = new Error(error.message || 'Failed to reach OpenRouter.');
    requestError.code = 'openrouter_request_failed';
    requestError.status = 502;
    throw requestError;
  }

  timeout.clear();

  const text = await response.text();
  const parsed = parseJsonSafely(text);

  if (!response.ok) {
    const errorMessage =
      parsed?.error?.message ||
      parsed?.message ||
      parsed?.raw ||
      `OpenRouter request failed with status ${response.status}.`;
    // 印出完整原始回應，方便診斷模型不存在 / 沒有額度 / 隱私設定等問題
    try {
      console.error('[OpenRouter error]', {
        status: response.status,
        model: options.model || DEFAULT_OPENROUTER_MODEL,
        body: text?.slice?.(0, 1000) || text
      });
    } catch (_) { /* noop */ }
    const responseError = new Error(errorMessage);
    responseError.code = parsed?.error?.code || parsed?.code || 'openrouter_error';
    responseError.status = response.status;
    throw responseError;
  }

  return {
    text: parsed?.choices?.[0]?.message?.content || '',
    raw: parsed
  };
}

async function completeWithGoogle(payload, options = {}) {
  const apiKey = String(options.apiKey || '').trim();
  if (!apiKey) {
    const error = new Error('Missing Google API key.');
    error.code = 'google_missing_api_key';
    error.status = 500;
    throw error;
  }

  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available for Google Gemini chat delivery.');
  }

  const timeoutMs = Number(options.timeoutMs || DEFAULT_LLM_TIMEOUT_MS);
  const timeout = createTimeoutController(timeoutMs);
  const model = options.model || DEFAULT_GOOGLE_MODEL;
  const baseUrl = String(options.baseUrl || DEFAULT_GOOGLE_BASE_URL).replace(/\/+$/, '');
  const endpoint = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const systemText = payload.expectJson
    ? `${payload.systemPrompt || ''}\n\n${buildJsonInstruction()}`.trim()
    : String(payload.systemPrompt || '').trim();

  const contents = mapHistoryForGoogle(payload.history);
  contents.push({
    role: 'user',
    parts: [{ text: String(payload.userPrompt || '') }]
  });

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
        contents,
        generationConfig: {
          temperature: payload.temperature == null ? 0.2 : payload.temperature
        }
      }),
      signal: timeout.controller.signal
    });
  } catch (error) {
    timeout.clear();
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Google Gemini request timed out after ${timeoutMs / 1000} seconds.`);
      timeoutError.code = 'google_timeout';
      timeoutError.status = 504;
      throw timeoutError;
    }
    const requestError = new Error(error.message || 'Failed to reach Google Gemini.');
    requestError.code = 'google_request_failed';
    requestError.status = 502;
    throw requestError;
  }

  timeout.clear();

  const text = await response.text();
  const parsed = parseJsonSafely(text);

  if (!response.ok) {
    const errorMessage =
      parsed?.error?.message ||
      parsed?.message ||
      parsed?.raw ||
      `Google Gemini request failed with status ${response.status}.`;
    const responseError = new Error(errorMessage);
    responseError.code = parsed?.error?.status || parsed?.code || 'google_error';
    responseError.status = response.status;
    throw responseError;
  }

  const parts = parsed?.candidates?.[0]?.content?.parts || [];
  return {
    text: parts.map((part) => part?.text || '').join('').trim(),
    raw: parsed
  };
}

function shouldRetryLlmError(error) {
  return Number(error?.status || 0) === 429;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function completeChat(payload, options = {}) {
  const provider = inferProvider(options);
  const retries = Number(options.retryCount == null ? DEFAULT_RETRY_COUNT : options.retryCount);
  let attempt = 0;

  while (true) {
    try {
      if (provider === 'google') {
        return await completeWithGoogle(payload, options);
      }
      if (provider === 'openrouter') {
        return await completeWithOpenRouter(payload, options);
      }
      return await completeWithGroq(payload, options);
    } catch (error) {
      if (!shouldRetryLlmError(error) || attempt >= retries) {
        throw error;
      }
      const delayMs = 800 * (attempt + 1);
      await wait(delayMs);
      attempt += 1;
    }
  }
}

module.exports = {
  DEFAULT_GROQ_BASE_URL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_OPENROUTER_BASE_URL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_GOOGLE_BASE_URL,
  DEFAULT_GOOGLE_MODEL,
  DEFAULT_LLM_TIMEOUT_MS,
  inferProvider,
  completeChat,
  completeWithGroq,
  completeWithOpenRouter,
  completeWithGoogle
};
