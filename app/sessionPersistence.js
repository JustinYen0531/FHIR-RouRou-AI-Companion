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

module.exports = {
  DEFAULT_SESSION_STORE_PATH,
  createSessionPersistence,
  loadSessionsFromFile,
  saveSessionsToFile
};
