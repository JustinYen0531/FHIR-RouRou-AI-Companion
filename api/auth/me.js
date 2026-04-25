const { getAuthUserFromRequest, getSharedAuthStore } = require('../_options');
const { handleCors, sendJson } = require('../_shared');

module.exports = function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const user = getAuthUserFromRequest(req);
  if (!user) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const authStore = getSharedAuthStore();
  const header = String(req.headers?.authorization || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? String(match[1] || '').trim() : '';
  const authResult = token ? authStore.getSessionByToken(token) : null;

  sendJson(res, 200, {
    ok: true,
    user,
    session: authResult?.session
      ? {
          id: authResult.session.id,
          created_at: authResult.session.created_at,
          expires_at: authResult.session.expires_at
        }
      : null
  });
};
