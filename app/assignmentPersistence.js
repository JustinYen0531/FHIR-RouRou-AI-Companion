const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_ASSIGNMENT_STORE_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), 'ai-companion-assignments.json')
  : path.join(__dirname, '..', '.data', 'ai-companion-assignments.json');

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeMedicalRecord(record = {}) {
  const source = record && typeof record === 'object' ? record : {};
  return {
    patient: source.patient && typeof source.patient === 'object' ? source.patient : {},
    encounter: source.encounter && typeof source.encounter === 'object' ? source.encounter : {},
    observations: Array.isArray(source.observations) ? source.observations : [],
    questionnaire: source.questionnaire && typeof source.questionnaire === 'object' ? source.questionnaire : {},
    composition: source.composition && typeof source.composition === 'object' ? source.composition : {},
    documents: Array.isArray(source.documents) ? source.documents : [],
    conditions: Array.isArray(source.conditions) ? source.conditions : [],
    medications: Array.isArray(source.medications) ? source.medications : [],
    provenance: source.provenance && typeof source.provenance === 'object' ? source.provenance : {},
    updatedAt: String(source.updatedAt || '').trim()
  };
}

function normalizeOrderDraft(order = {}) {
  const source = order && typeof order === 'object' ? order : {};
  return {
    type: String(source.type || '').trim(),
    content: String(source.content || '').trim(),
    assignee: String(source.assignee || '').trim(),
    duePreset: String(source.duePreset || '').trim(),
    dueDate: String(source.dueDate || '').trim(),
    priority: String(source.priority || '').trim(),
    replyRequirement: String(source.replyRequirement || '').trim(),
    taskRef: String(source.taskRef || '').trim(),
    note: String(source.note || '').trim(),
    status: String(source.status || '').trim(),
    createdBy: String(source.createdBy || '').trim(),
    createdAt: String(source.createdAt || '').trim(),
    patientRef: String(source.patientRef || '').trim(),
    encounterRef: String(source.encounterRef || '').trim(),
    summaryRef: String(source.summaryRef || '').trim(),
    observationRef: String(source.observationRef || '').trim()
  };
}

function normalizeAssignmentRecord(record = {}) {
  const patientId = String(record.patientId || '').trim();
  if (!patientId) return null;
  return {
    patientId,
    patientName: String(record.patientName || '').trim(),
    patientNumber: String(record.patientNumber || '').trim(),
    doctorId: String(record.doctorId || '').trim(),
    doctorName: String(record.doctorName || '').trim(),
    medicalRecordStatus: String(record.medicalRecordStatus || '待送入').trim() || '待送入',
    orderStatus: String(record.orderStatus || '未填寫').trim() || '未填寫',
    medicalRecord: normalizeMedicalRecord(record.medicalRecord),
    orderDraft: normalizeOrderDraft(record.orderDraft),
    syncedAt: String(record.syncedAt || '').trim() || new Date().toISOString()
  };
}

function loadAssignmentsFromFile(filePath = DEFAULT_ASSIGNMENT_STORE_PATH) {
  try {
    if (!fs.existsSync(filePath)) {
      return new Map();
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed.assignments) ? parsed.assignments : [];
    const map = new Map();
    for (const item of items) {
      const normalized = normalizeAssignmentRecord(item);
      if (normalized) map.set(normalized.patientId, normalized);
    }
    return map;
  } catch {
    return new Map();
  }
}

function saveAssignmentsToFile(assignments, filePath = DEFAULT_ASSIGNMENT_STORE_PATH) {
  ensureParentDir(filePath);
  const items = [];
  for (const entry of assignments.values()) {
    const normalized = normalizeAssignmentRecord(entry);
    if (normalized) items.push(normalized);
  }
  items.sort((a, b) => String(b.syncedAt || '').localeCompare(String(a.syncedAt || '')));
  fs.writeFileSync(filePath, JSON.stringify({
    version: 1,
    savedAt: new Date().toISOString(),
    assignments: items
  }, null, 2), 'utf8');
}

function createAssignmentPersistence(options = {}) {
  const filePath = options.filePath || DEFAULT_ASSIGNMENT_STORE_PATH;
  const assignments = loadAssignmentsFromFile(filePath);
  let persistenceAvailable = true;
  function refresh() {
    if (!persistenceAvailable) return assignments;
    const latest = loadAssignmentsFromFile(filePath);
    assignments.clear();
    for (const [key, value] of latest.entries()) {
      assignments.set(key, value);
    }
    return assignments;
  }
  return {
    filePath,
    assignments,
    refresh,
    save(nextAssignments = assignments) {
      if (!persistenceAvailable) return;
      try {
        saveAssignmentsToFile(nextAssignments, filePath);
      } catch (error) {
        if (error && ['EROFS', 'EACCES', 'EPERM'].includes(error.code)) {
          persistenceAvailable = false;
          return;
        }
        throw error;
      }
    }
  };
}

module.exports = {
  DEFAULT_ASSIGNMENT_STORE_PATH,
  createAssignmentPersistence,
  loadAssignmentsFromFile,
  saveAssignmentsToFile,
  normalizeAssignmentRecord
};
