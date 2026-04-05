const { buildServerOptions, getSharedPersistence, listSessionSummaries } = require('../_options');
const { handleCors, sendJson } = require('../_shared');

module.exports = function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const url = new URL(req.url, 'https://placeholder.local');
  const user = String(url.searchParams.get('user') || '').trim();
  const limit = Number(url.searchParams.get('limit') || 5);
  const persistence = getSharedPersistence();
  buildServerOptions();

  sendJson(res, 200, {
    ok: true,
    sessions: listSessionSummaries(persistence.sessions, { user, limit })
  });
};
