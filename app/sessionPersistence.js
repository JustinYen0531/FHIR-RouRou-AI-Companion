const fs = require('fs');
const path = require('path');

const DEFAULT_SESSION_STORE_PATH = path.join(__dirname, '..', '.data', 'ai-companion-sessions.json');

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeSessionRecord(record) {
  if (!record || typeof record !== 'object') return null;
  if (!record.id || typeof record.id !== 'string') return null;
  return {
    id: record.id,
    user: typeof record.user === 'string' && record.user.trim() ? record.user.trim() : 'web-demo-user',
    startedAt: record.startedAt || new Date().toISOString(),
    updatedAt: record.updatedAt || record.startedAt || new Date().toISOString(),
    history: Array.isArray(record.history) ? record.history : [],
    state: record.state && typeof record.state === 'object' ? record.state : {},
    revision: Number.isFinite(Number(record.revision)) ? Number(record.revision) : 0,
    structured_revision: Number.isFinite(Number(record.structured_revision)) ? Number(record.structured_revision) : undefined,
    memory_snapshot: record.memory_snapshot && typeof record.memory_snapshot === 'object'
      ? record.memory_snapshot
      : {
          note_history: [],
          last_user_message: '',
          last_assistant_message: '',
          active_mode: 'auto',
          risk_flag: 'false',
          latest_tag_summary: '',
          hamd_focus: ''
        },
    output_cache: record.output_cache && typeof record.output_cache === 'object' ? record.output_cache : {}
  };
}

function loadSessionsFromFile(filePath = DEFAULT_SESSION_STORE_PATH) {
  try {
    if (!fs.existsSync(filePath)) {
      return new Map();
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    const map = new Map();
    for (const record of sessions) {
      const normalized = normalizeSessionRecord(record);
      if (normalized) {
        map.set(normalized.id, normalized);
      }
    }
    return map;
  } catch (error) {
    return new Map();
  }
}

function saveSessionsToFile(sessions, filePath = DEFAULT_SESSION_STORE_PATH) {
  ensureParentDir(filePath);
  const serialized = [];
  for (const session of sessions.values()) {
    const normalized = normalizeSessionRecord(session);
    if (normalized) {
      serialized.push(normalized);
    }
  }
  serialized.sort((a, b) => String(a.updatedAt || '').localeCompare(String(b.updatedAt || '')));
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        version: 1,
        savedAt: new Date().toISOString(),
        sessions: serialized
      },
      null,
      2
    ),
    'utf8'
  );
}

function createSessionPersistence(options = {}) {
  const filePath = options.filePath || DEFAULT_SESSION_STORE_PATH;
  const sessions = loadSessionsFromFile(filePath);
  return {
    filePath,
    sessions,
    save(nextSessions = sessions) {
      saveSessionsToFile(nextSessions, filePath);
    }
  };
}

function isUnreadableText(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  const stripped = text.replace(/\s+/g, '');
  if (!stripped) return true;
  const suspiciousChars = stripped.match(/[?？�]/g) || [];
  return suspiciousChars.length / stripped.length >= 0.6;
}

function findReadableHistoryMessage(history = [], role = '') {
  const items = Array.isArray(history) ? history : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item || !item.content) continue;
    if (role && item.role !== role) continue;
    const content = String(item.content || '').trim();
    if (content && !isUnreadableText(content)) {
      return content;
    }
  }
  return '';
}

function summarizeSession(session) {
  const history = Array.isArray(session.history) ? session.history : [];
  const lastUserMessage = !isUnreadableText(session.memory_snapshot?.last_user_message)
    ? String(session.memory_snapshot?.last_user_message || '').trim()
    : findReadableHistoryMessage(history, 'user') ||
      String(session.memory_snapshot?.last_user_message || '').trim() ||
      '';
  const lastAssistantMessage = !isUnreadableText(session.memory_snapshot?.last_assistant_message)
    ? String(session.memory_snapshot?.last_assistant_message || '').trim()
    : findReadableHistoryMessage(history, 'assistant') ||
      String(session.memory_snapshot?.last_assistant_message || '').trim() ||
      '';
  const latestTags = session.state?.latest_tag_payload && typeof session.state.latest_tag_payload === 'object'
    ? session.state.latest_tag_payload
    : {};
  const clinicianSummary = session.state?.clinician_summary_draft && typeof session.state.clinician_summary_draft === 'object'
    ? session.state.clinician_summary_draft
    : {};
  const latestTagSummary = !isUnreadableText(session.memory_snapshot?.latest_tag_summary)
    ? String(session.memory_snapshot?.latest_tag_summary || '').trim()
    : !isUnreadableText(latestTags.summary)
      ? String(latestTags.summary || '').trim()
      : '';
  const fallbackSummary = findReadableHistoryMessage(history, 'assistant') || findReadableHistoryMessage(history, 'user') || '';

  return {
    id: session.id,
    user: session.user || 'web-demo-user',
    startedAt: session.startedAt || '',
    updatedAt: session.updatedAt || '',
    active_mode: session.state?.active_mode || session.memory_snapshot?.active_mode || 'auto',
    risk_flag: session.state?.risk_flag || session.memory_snapshot?.risk_flag || 'false',
    latest_tag_summary: latestTagSummary || fallbackSummary,
    last_user_message: String(lastUserMessage || '').trim(),
    last_assistant_message: String(lastAssistantMessage || '').trim(),
    note_history_count: Array.isArray(session.memory_snapshot?.note_history) ? session.memory_snapshot.note_history.length : 0,
    has_clinician_summary: Boolean(clinicianSummary && Object.keys(clinicianSummary).length),
    has_fhir_draft: Boolean(session.state?.fhir_delivery_draft && typeof session.state.fhir_delivery_draft === 'object' && Object.keys(session.state.fhir_delivery_draft).length),
    message_count: history.length
  };
}

function listSessionSummaries(sessions, options = {}) {
  const user = String(options.user || '').trim();
  const limit = Math.max(1, Math.min(20, Number(options.limit) || 5));
  const results = [];
  for (const session of sessions.values()) {
    if (user && String(session.user || '').trim() !== user) continue;
    results.push(summarizeSession(session));
  }
  results.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return results.slice(0, limit);
}

module.exports = {
  DEFAULT_SESSION_STORE_PATH,
  createSessionPersistence,
  listSessionSummaries,
  loadSessionsFromFile,
  saveSessionsToFile,
  summarizeSession
};
