const { buildServerOptions } = require('../_options');
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

  const { authStore } = buildServerOptions();
  try {
    const loginResult = authStore.login(payload);
    sendJson(res, 200, {
      ok: true,
      token: loginResult.token,
      user: loginResult.user,
      session: {
        id: loginResult.session.id,
        created_at: loginResult.session.created_at,
        expires_at: loginResult.session.expires_at
      }
    });
  } catch (error) {
    sendJson(res, 401, { error: error.message || 'Unable to login.' });
  }
};
