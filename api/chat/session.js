const { buildServerOptions, getSharedPersistence } = require('../_options');
const { handleCors, readJsonBody, sendJson } = require('../_shared');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  if (!['GET', 'DELETE', 'PATCH'].includes(req.method)) {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const url = new URL(req.url, 'https://placeholder.local');
  const sessionId = String(url.searchParams.get('id') || '').trim();
  if (!sessionId) {
    sendJson(res, 400, { error: 'Session id is required.' });
    return;
  }

  const persistence = getSharedPersistence();
  buildServerOptions();

  if (req.method === 'PATCH') {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
      return;
    }

    let session = persistence.sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        user: payload.user || 'web-demo-user',
        startedAt: payload.startedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
        state: {},
        revision: 0,
        memory_snapshot: {},
        output_cache: {}
      };
      persistence.sessions.set(sessionId, session);
    }

    if (payload.therapeutic_profile && typeof payload.therapeutic_profile === 'object') {
      session.state = session.state && typeof session.state === 'object' ? session.state : {};
      session.state.therapeutic_profile = payload.therapeutic_profile;
      session.updatedAt = new Date().toISOString();
    }

    if (Array.isArray(payload.history)) {
      session.history = payload.history;
      session.updatedAt = new Date().toISOString();
    }

    if (payload.state && typeof payload.state === 'object') {
      session.state = payload.state;
      session.updatedAt = new Date().toISOString();
    }

    if (payload.memory_snapshot && typeof payload.memory_snapshot === 'object') {
      session.memory_snapshot = payload.memory_snapshot;
      session.updatedAt = new Date().toISOString();
    }

    if (Number.isFinite(Number(payload.revision))) {
      session.revision = Number(payload.revision);
    }

    if (payload.user) {
      session.user = payload.user;
    }

    if (payload.startedAt) {
      session.startedAt = payload.startedAt;
    }

    if (payload.clear_output_cache) {
      session.output_cache = {};
    }

    persistence.save(persistence.sessions);

    sendJson(res, 200, { ok: true, updated: true, session_id: sessionId });
    return;
  }

  if (req.method === 'DELETE') {
    if (!persistence.sessions.has(sessionId)) {
      sendJson(res, 404, { error: 'Session not found.' });
      return;
    }

    persistence.sessions.delete(sessionId);
    persistence.save(persistence.sessions);
    sendJson(res, 200, { ok: true, deleted: true, session_id: sessionId });
    return;
  }

  const session = persistence.sessions.get(sessionId);
  if (!session) {
    sendJson(res, 404, { error: 'Session not found.' });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    session: {
      id: session.id,
      user: session.user || 'web-demo-user',
      startedAt: session.startedAt || '',
      updatedAt: session.updatedAt || '',
      history: Array.isArray(session.history) ? session.history : [],
      state: session.state && typeof session.state === 'object' ? session.state : {},
      revision: Number.isFinite(Number(session.revision)) ? Number(session.revision) : 0,
      memory_snapshot: session.memory_snapshot && typeof session.memory_snapshot === 'object'
        ? session.memory_snapshot
        : {},
      output_cache: session.output_cache && typeof session.output_cache === 'object'
        ? session.output_cache
        : {}
    }
  });
};
