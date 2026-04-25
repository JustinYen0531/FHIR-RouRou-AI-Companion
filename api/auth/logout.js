const { getSharedAuthStore } = require('../_options');
const { handleCors, sendJson } = require('../_shared');

module.exports = function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const header = String(req.headers?.authorization || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? String(match[1] || '').trim() : '';
  if (token) {
    getSharedAuthStore().revokeSession(token);
  }

  sendJson(res, 200, { ok: true, logged_out: true });
};
