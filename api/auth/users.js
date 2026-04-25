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

  const currentUser = getAuthUserFromRequest(req);
  if (!currentUser) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const userId = String(requestUrl.searchParams.get('id') || '').trim();
  if (!userId) {
    sendJson(res, 400, { error: 'id is required', code: 'missing_user_id' });
    return;
  }

  const canLookup = currentUser.role === 'doctor' || currentUser.id === userId;
  if (!canLookup) {
    sendJson(res, 403, { error: 'Forbidden', code: 'forbidden' });
    return;
  }

  const authStore = getSharedAuthStore();
  const user = authStore.findUserById(userId);
  if (!user) {
    sendJson(res, 404, { error: 'user not found', code: 'user_not_found' });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    user
  });
};
