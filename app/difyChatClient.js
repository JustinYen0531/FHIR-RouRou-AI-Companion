const DEFAULT_DIFY_BASE_URL = 'https://api.dify.ai/v1';

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

  const response = await fetchImpl(`${baseUrl}/chat-messages`, {
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
    })
  });

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
    throw new Error(errorMessage);
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
  sendDifyChatMessage
};
