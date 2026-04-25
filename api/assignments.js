const { getAuthUserFromRequest, getSharedAssignmentStore } = require('./_options');
const { handleCors, readJsonBody, sendJson } = require('./_shared');
const { normalizeAssignmentRecord } = require('../app/assignmentPersistence');

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  if (!['GET', 'PATCH'].includes(req.method)) {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const currentUser = getAuthUserFromRequest(req);
  if (!currentUser) {
    sendJson(res, 401, { error: 'Unauthorized', code: 'unauthorized' });
    return;
  }

  const url = new URL(req.url, 'https://placeholder.local');
  const requestedPatientId = String(url.searchParams.get('patient_id') || '').trim();
  const patientId = currentUser.role === 'patient' ? currentUser.id : requestedPatientId;
  if (!patientId) {
    sendJson(res, 400, { error: 'patient_id is required', code: 'missing_patient_id' });
    return;
  }

  const store = getSharedAssignmentStore();
  store.refresh?.();

  if (req.method === 'GET') {
    if (currentUser.role === 'patient' && patientId !== currentUser.id) {
      sendJson(res, 403, { error: 'Forbidden', code: 'forbidden' });
      return;
    }

    const assignment = store.assignments.get(patientId) || null;
    sendJson(res, 200, {
      ok: true,
      assignment
    });
    return;
  }

  if (currentUser.role !== 'doctor') {
    sendJson(res, 403, { error: 'Forbidden', code: 'forbidden' });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendJson(res, 400, { error: error.message, code: 'invalid_json' });
    return;
  }

  const normalized = normalizeAssignmentRecord(Object.assign({}, payload, {
    patientId,
    doctorId: currentUser.id,
    doctorName: payload?.doctorName || currentUser.display_name || currentUser.login_identifier || '醫師',
    syncedAt: new Date().toISOString()
  }));

  if (!normalized) {
    sendJson(res, 400, { error: 'Invalid assignment payload', code: 'invalid_assignment' });
    return;
  }

  store.assignments.set(patientId, normalized);
  store.save(store.assignments);
  sendJson(res, 200, {
    ok: true,
    assignment: normalized
  });
};
