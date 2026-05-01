const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_SESSION_STORE_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), 'ai-companion-sessions.json')
  : path.join(__dirname, '..', '.data', 'ai-companion-sessions.json');
const DEFAULT_DEMO_PATIENT_AUTH_ID = 'patient_1ed3aee1b6f1';
const DEMO_SESSION_USER_IDS = [
  DEFAULT_DEMO_PATIENT_AUTH_ID,
  'web-demo-user',
  'demo-user',
  'patient-001'
];

function createDefaultDemoSession() {
  const startedAt = '2026-03-29T09:00:00+08:00';
  const updatedAt = '2026-03-29T09:30:00+08:00';
  const clinicianSummary = {
    draft_summary: '近兩三週情緒低落、睡眠中斷，並提到工作效率下降；曾出現被動消失想法，但目前否認立即自傷計畫。',
    chief_concerns: ['近兩三週情緒低落', '睡著後容易醒', '工作效率下降'],
    symptom_observations: ['情緒低落', '興趣下降', '睡眠中斷'],
    followup_needs: ['追蹤身體焦慮', '確認被動消失念頭頻率'],
    safety_flags: ['被動消失想法', '目前否認立即自傷計畫'],
    hamd_signals: ['depressed_mood', 'work_interest', 'insomnia']
  };
  const patientAnalysis = {
    plain_summary: '這段對話顯示最近壓力偏高、睡眠被打斷，情緒低落和工作效率下降彼此影響。',
    key_points: ['情緒低落已持續兩三週', '睡眠中斷', '工作效率下降', '可與醫師討論身體焦慮與安全感']
  };
  const patientReview = {
    review_summary: '可提供醫師作為回診前摘要，送出前仍需要病人確認。',
    confirm_items: ['近兩三週情緒低落', '睡著後容易醒', '工作效率下降'],
    optional_edits: ['是否補充最近一週睡眠時數', '是否補充焦慮的身體症狀']
  };
  const fhirDelivery = {
    narrative_summary: 'AI Companion pre-visit draft: depressed mood, reduced work interest, insomnia, and passive disappearance ideation without current plan.',
    questionnaire_targets: ['HAM-D depressed_mood', 'HAM-D work_interest', 'HAM-D insomnia'],
    observation_candidates: [
      { code: 'depressed_mood', display: 'Depressed mood', evidence: '近兩三週情緒低落' },
      { code: 'work_interest', display: 'Work and interest decline', evidence: '工作效率下降' },
      { code: 'insomnia', display: 'Insomnia', evidence: '睡著後容易醒' }
    ],
    composition_sections: [
      { title: 'Chief Concerns', focus: '近兩三週情緒低落；睡著後容易醒；工作效率下降' },
      { title: 'Safety', focus: '被動消失想法；目前否認立即自傷計畫' }
    ],
    resources: [
      { resource_type: 'Patient', purpose: '病人基本資料' },
      { resource_type: 'Encounter', purpose: '本次對話情境' },
      { resource_type: 'QuestionnaireResponse', purpose: 'HAM-D 草稿線索' },
      { resource_type: 'Observation', purpose: '症狀候選項目' },
      { resource_type: 'Composition', purpose: '回診前摘要文件' }
    ]
  };
  const sessionExport = {
    patient: { key: DEFAULT_DEMO_PATIENT_AUTH_ID, name: '星澄', gender: 'unknown' },
    session: { encounterKey: 'demo-session-ready-report', startedAt, endedAt: updatedAt },
    author: 'AI Companion Node Engine',
    active_mode: 'mode_5_natural',
    risk_flag: 'false',
    latest_tag_payload: { summary: '近兩三週情緒低落、睡眠中斷與工作效率下降。', sentiment_tags: ['低落', '疲憊', '睡眠'] },
    clinician_summary_draft: clinicianSummary,
    patient_analysis: patientAnalysis,
    patient_review_packet: patientReview,
    fhir_delivery_draft: fhirDelivery,
    hamd_progress_state: {
      covered_dimensions: ['depressed_mood', 'work_interest', 'insomnia'],
      supported_dimensions: ['depressed_mood', 'work_interest', 'insomnia'],
      recent_evidence: ['近兩三週情緒低落', '睡著後容易醒', '工作效率下降'],
      next_recommended_dimension: 'somatic_anxiety'
    },
    red_flag_payload: {
      warning_tags: ['passive_disappearance_ideation'],
      signals: ['曾表達如果消失就好了', '否認立即自傷計畫']
    },
    patient_authorization_state: {
      authorization_status: 'ready_for_consent',
      share_with_clinician: 'yes'
    },
    delivery_readiness_state: {
      readiness_status: 'ready_for_backend_mapping'
    }
  };

  return {
    id: 'demo-session-ready-report',
    user: DEFAULT_DEMO_PATIENT_AUTH_ID,
    startedAt,
    updatedAt,
    history: [
      { role: 'user', content: '最近兩三週都很累，睡著後很容易醒，工作效率也掉很多。' },
      { role: 'assistant', content: '我有聽到，這不是你不夠努力，而是身心都在提醒你需要被照顧。我先幫你整理成可以給醫師看的重點。' },
      { role: 'user', content: '有時候會想如果消失就好了，但我沒有要傷害自己。' },
      { role: 'assistant', content: '謝謝你說出來。這句很重要，我會把它整理成安全旗標：有被動消失想法，但目前否認立即自傷計畫。' }
    ],
    state: {
      active_mode: 'mode_5_natural',
      risk_flag: 'false',
      latest_tag_payload: sessionExport.latest_tag_payload,
      clinician_summary_draft: clinicianSummary,
      patient_analysis: patientAnalysis,
      patient_review_packet: patientReview,
      fhir_delivery_draft: fhirDelivery,
      hamd_progress_state: sessionExport.hamd_progress_state,
      red_flag_payload: sessionExport.red_flag_payload,
      patient_authorization_state: sessionExport.patient_authorization_state,
      delivery_readiness_state: sessionExport.delivery_readiness_state,
      therapeutic_profile: {
        version: '1.0',
        userId: DEFAULT_DEMO_PATIENT_AUTH_ID,
        stressors: [{ label: '工作壓力', confidence: 0.7 }],
        triggers: [{ keyword: '睡不著', reaction: '疲憊與焦慮', severity: 'medium' }],
        keyThemes: ['睡眠中斷', '工作效率下降'],
        positiveAnchors: [],
        memoryChunks: []
      }
    },
    revision: 4,
    memory_snapshot: {
      note_history: ['近兩三週情緒低落', '睡著後容易醒', '工作效率下降'],
      last_user_message: '有時候會想如果消失就好了，但我沒有要傷害自己。',
      last_assistant_message: '我會把它整理成安全旗標：有被動消失想法，但目前否認立即自傷計畫。',
      active_mode: 'mode_5_natural',
      risk_flag: 'false',
      latest_tag_summary: '近兩三週情緒低落、睡眠中斷與工作效率下降。',
      hamd_focus: 'depressed_mood'
    },
    output_cache: {
      'ui_report_bundle.v1': {
        conversationId: 'demo-session-ready-report',
        savedAt: updatedAt,
        reportOutputs: {
          clinician_summary: clinicianSummary,
          patient_analysis: patientAnalysis,
          patient_review: patientReview,
          fhir_delivery: fhirDelivery,
          session_export: sessionExport,
          updatedAt
        },
        fhirReportHistory: []
      }
    }
  };
}

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

function ensureDefaultDemoSessions(sessions) {
  if (!sessions || typeof sessions.has !== 'function') return false;
  if (sessions.has('demo-session-ready-report')) return false;
  sessions.set('demo-session-ready-report', normalizeSessionRecord(createDefaultDemoSession()));
  return true;
}

function getAuthorizedSessionUserIds(authUser = null) {
  if (!authUser) return [];
  const authId = String(authUser.id || authUser).trim();
  if (!authId) return [];
  const loginIdentifier = String(authUser.login_identifier || '').trim().toLowerCase();
  const isDefaultDemoPatient = authId === DEFAULT_DEMO_PATIENT_AUTH_ID || loginIdentifier === 'justin';
  return isDefaultDemoPatient
    ? Array.from(new Set([authId, ...DEMO_SESSION_USER_IDS]))
    : [authId];
}

function sessionBelongsToAuthorizedUser(session, authUser = null) {
  if (!authUser) return true;
  const allowedUsers = getAuthorizedSessionUserIds(authUser);
  return allowedUsers.includes(String(session?.user || '').trim());
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
  let persistenceAvailable = true;
  const seededDefaultDemo = ensureDefaultDemoSessions(sessions);
  const persistence = {
    filePath,
    sessions,
    save(nextSessions = sessions) {
      if (!persistenceAvailable) return;
      try {
        saveSessionsToFile(nextSessions, filePath);
      } catch (error) {
        if (error && ['EROFS', 'EACCES', 'EPERM'].includes(error.code)) {
          persistenceAvailable = false;
          return;
        }
        throw error;
      }
    }
  };
  if (seededDefaultDemo) {
    persistence.save(sessions);
  }
  return persistence;
}

function isUnreadableText(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  const stripped = text.replace(/\s+/g, '');
  if (!stripped) return true;
  const suspiciousChars = stripped.match(/[?？�]/g) || [];
  return suspiciousChars.length / stripped.length >= 0.6;
}

function hasCorruptedHistory(history = []) {
  return (Array.isArray(history) ? history : []).some((item) => {
    if (item?.recalled === true || item?.is_recalled === true) return false;
    const content = String(item?.content || '').trim();
    return Boolean(content) && isUnreadableText(content);
  });
}

function findReadableHistoryMessage(history = [], role = '') {
  const items = Array.isArray(history) ? history : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item || !item.content) continue;
    if (item.recalled === true || item.is_recalled === true) continue;
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
  const activeHistory = history.filter((item) => item && item.recalled !== true && item.is_recalled !== true);
  const lastUserMessage = !isUnreadableText(session.memory_snapshot?.last_user_message)
    ? String(session.memory_snapshot?.last_user_message || '').trim()
    : findReadableHistoryMessage(activeHistory, 'user') ||
      String(session.memory_snapshot?.last_user_message || '').trim() ||
      '';
  const lastAssistantMessage = !isUnreadableText(session.memory_snapshot?.last_assistant_message)
    ? String(session.memory_snapshot?.last_assistant_message || '').trim()
    : findReadableHistoryMessage(activeHistory, 'assistant') ||
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
  const fallbackSummary = findReadableHistoryMessage(activeHistory, 'assistant') || findReadableHistoryMessage(activeHistory, 'user') || '';

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
    has_corrupted_history: hasCorruptedHistory(activeHistory),
    message_count: activeHistory.length
  };
}

function listSessionSummaries(sessions, options = {}) {
  const user = String(options.user || '').trim();
  const users = Array.isArray(options.users)
    ? options.users.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const limit = Math.max(1, Math.min(20, Number(options.limit) || 5));
  const results = [];
  for (const session of sessions.values()) {
    const sessionUser = String(session.user || '').trim();
    if (users.length && !users.includes(sessionUser)) continue;
    if (!users.length && user && sessionUser !== user) continue;
    results.push(summarizeSession(session));
  }
  results.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return results.slice(0, limit);
}

module.exports = {
  DEFAULT_SESSION_STORE_PATH,
  DEFAULT_DEMO_PATIENT_AUTH_ID,
  DEMO_SESSION_USER_IDS,
  createSessionPersistence,
  getAuthorizedSessionUserIds,
  sessionBelongsToAuthorizedUser,
  listSessionSummaries,
  loadSessionsFromFile,
  saveSessionsToFile,
  summarizeSession,
  isUnreadableText,
  hasCorruptedHistory
};
