const fs = require('fs');
const path = require('path');
const { completeChat, DEFAULT_GROQ_MODEL, DEFAULT_OPENROUTER_MODEL, DEFAULT_GOOGLE_MODEL } = require('./llmChatClient');

const ROOT_DIR = path.join(__dirname, '..');
const STATE_SCHEMA_PATH = path.join(ROOT_DIR, 'flowise', 'FLOWISE_STATE_SCHEMA.json');
const PROMPTS_DIR = path.join(ROOT_DIR, 'flowise', 'prompts');
const RAG_DIR = path.join(__dirname, 'rag');
const RAG_TEXT_PATH = path.join(RAG_DIR, 'CompanionAI_RAG資料.txt');
const DEFAULT_AUTHOR = 'AI Companion Node Engine';
const MAX_CHAT_HISTORY_FOR_MODEL = 24;
const MAX_TRANSCRIPT_TURNS_FOR_RETRIEVAL = 40;
const MAX_RECENT_TRANSCRIPT_TURNS = 12;

const PROMPT_FILES = {
  missionRetrievalAudit: '任務檢索稽核.md',
  riskStructurer: '風險結構化器.md',
  safetyResponse: '安全回應器.md',
  summaryDraftBuilder: '摘要草稿建構器.md',
  clinicianSummaryBuilder: '醫師摘要建構器.md',
  patientReviewBuilder: '病人審閱建構器.md',
  patientAuthorizationBuilder: '病人授權建構器.md',
  fhirDeliveryBuilder: 'FHIR交付建構器.md',
  deliveryReadinessBuilder: '交付就緒狀態建構器.md',
  tagStructurer: '標籤結構化器.md',
  burdenLevelBuilder: '負擔程度建構器.md',
  intentClassifier: '意圖分類器.md',
  lowEnergyDetector: '低能量偵測器.md',
  overrideRouter: '覆寫路由器.md',
  voidBox: '樹洞模式.md',
  soulMate: '靈魂陪伴.md',
  hamdProgressTracker: 'HAM-D進度追蹤器.md',
  missionGuide: '任務引導器.md',
  optionRetrievalAudit: '選項檢索稽核.md',
  optionSelector: '選項選擇器.md',
  smartHunter: '智慧獵手.md',
  hamdFormalProbeSelector: 'HAM-D正式探針選擇器.md',
  hamdEvidenceClassifier: 'HAM-D證據分類器.md',
  hamdFormalItemScorer: 'HAM-D正式題項評分器.md',
  followupOutputClassifier: '追問輸出分類器.md',
  followupResolver: '追問解析器.md',
  followupFinalizer: '追問收斂器.md',
  clarifyQuestion: '釐清問題.md'
};

const HAMD_FORMAL_ITEMS = [
  { item_code: 'depressed_mood', item_label: '憂鬱情緒', scale_range: '0_to_4', dimension: 'depressed_mood', preferred_evidence: 'direct_answer', probe_question: '如果用這一週來看，低落或提不起勁的感覺，比較像是偶爾、常常，還是幾乎每天都在？' },
  { item_code: 'guilt', item_label: '有罪感', scale_range: '0_to_4', dimension: 'guilt', preferred_evidence: 'direct_answer', probe_question: '最近有沒有哪件事讓你一直覺得很自責，甚至會反覆怪自己？' },
  { item_code: 'suicide', item_label: '自殺意念', scale_range: '0_to_4', dimension: 'depressed_mood', preferred_evidence: 'direct_answer', probe_question: '這一週有沒有出現過不想活、想消失，或覺得活著沒有意義的念頭？' },
  { item_code: 'insomnia_early', item_label: '入睡困難', scale_range: '0_to_2', dimension: 'insomnia', preferred_evidence: 'direct_answer', probe_question: '最近睡前比較像是一下就睡著，還是常常要躺很久才睡得著？' },
  { item_code: 'insomnia_middle', item_label: '睡眠中斷', scale_range: '0_to_2', dimension: 'insomnia', preferred_evidence: 'direct_answer', probe_question: '最近半夜醒來的情況大概是偶爾，還是已經變得很常發生？' },
  { item_code: 'insomnia_late', item_label: '早醒', scale_range: '0_to_2', dimension: 'insomnia', preferred_evidence: 'direct_answer', probe_question: '最近有沒有常常比預計早醒，而且醒來後就睡不回去？' },
  { item_code: 'work_activities', item_label: '工作與活動', scale_range: '0_to_4', dimension: 'work_interest', preferred_evidence: 'mixed', probe_question: '這一週做事的動力和以前比起來，是差不多、明顯下降，還是幾乎提不起來？' },
  { item_code: 'retardation', item_label: '精神運動遲滯', scale_range: '0_to_4', dimension: 'retardation', preferred_evidence: 'indirect_observation', probe_question: '最近有沒有覺得自己整體變慢，像是回話、思考或做事都拖住了？' },
  { item_code: 'agitation', item_label: '激越', scale_range: '0_to_4', dimension: 'agitation', preferred_evidence: 'indirect_observation', probe_question: '最近身體會不會有一種坐不住、很難放鬆、想一直動來動去的感覺？' },
  { item_code: 'psychic_anxiety', item_label: '精神性焦慮', scale_range: '0_to_4', dimension: 'somatic_anxiety', preferred_evidence: 'direct_answer', probe_question: '最近心裡的緊張感比較像偶爾一下，還是已經常常壓著你？' },
  { item_code: 'somatic_anxiety', item_label: '軀體性焦慮', scale_range: '0_to_4', dimension: 'somatic_anxiety', preferred_evidence: 'mixed', probe_question: '最近除了心情，身體會不會常出現緊繃、胃不舒服、心悸或頭痛這類反應？' },
  { item_code: 'gastrointestinal_somatic', item_label: '胃腸症狀', scale_range: '0_to_2', dimension: 'somatic_anxiety', preferred_evidence: 'direct_answer', probe_question: '最近食慾、腸胃或吃東西這件事，有沒有因為情緒受到影響？' },
  { item_code: 'general_somatic', item_label: '一般身體症狀', scale_range: '0_to_2', dimension: 'somatic_anxiety', preferred_evidence: 'mixed', probe_question: '最近整體身體狀態有沒有特別疲累、痠痛，或像被情緒拖住那種感覺？' },
  { item_code: 'genital_symptoms', item_label: '生理功能症狀', scale_range: '0_to_2', dimension: 'somatic_anxiety', preferred_evidence: 'direct_answer', probe_question: '如果可以接受回答，最近性慾或生理功能有沒有比平常明顯下降？' },
  { item_code: 'hypochondriasis', item_label: '疑病傾向', scale_range: '0_to_4', dimension: 'somatic_anxiety', preferred_evidence: 'mixed', probe_question: '最近會不會很常擔心自己是不是身體哪裡出問題，而且很難放下這個念頭？' },
  { item_code: 'weight_loss', item_label: '體重下降', scale_range: '0_to_2', dimension: 'work_interest', preferred_evidence: 'direct_answer', probe_question: '最近食量或體重有沒有明顯變少，像是連自己都感覺得到？' },
  { item_code: 'insight', item_label: '病識感', scale_range: '0_to_2', dimension: 'guilt', preferred_evidence: 'indirect_observation', probe_question: '你會怎麼看待自己最近這些變化？比較覺得是壓力反應、情緒困擾，還是其實沒什麼問題？' }
];

const HAMD_FORMAL_ITEM_MAP = HAMD_FORMAL_ITEMS.reduce((acc, item) => {
  acc[item.item_code] = item;
  return acc;
}, {});

const HAMD_DIMENSION_TO_ITEM_CODES = {
  depressed_mood: ['depressed_mood', 'suicide'],
  guilt: ['guilt', 'insight'],
  work_interest: ['work_activities', 'weight_loss'],
  retardation: ['retardation'],
  agitation: ['agitation'],
  somatic_anxiety: ['psychic_anxiety', 'somatic_anxiety', 'gastrointestinal_somatic', 'general_somatic', 'genital_symptoms', 'hypochondriasis'],
  insomnia: ['insomnia_early', 'insomnia_middle', 'insomnia_late']
};

const COMMAND_MAP = {
  auto: {
    routing_mode_override: 'auto',
    active_mode: 'auto',
    pending_question: 'none',
    followup_turn_count: '0',
    followup_status: 'resolved',
    command_feedback: '已切回 auto 模式，之後會重新依照使用者語氣與內容自動分流。'
  },
  void: {
    routing_mode_override: 'mode_1_void',
    active_mode: 'mode_1_void',
    pending_question: 'none',
    followup_turn_count: '0',
    followup_status: 'resolved',
    command_feedback: '已切換到 void 模式，之後會優先維持樹洞式接住，直到你輸入其他模式指令或 auto。'
  },
  soulmate: {
    routing_mode_override: 'mode_2_soulmate',
    active_mode: 'mode_2_soulmate',
    pending_question: 'none',
    followup_turn_count: '0',
    followup_status: 'resolved',
    command_feedback: '已切換到 soulmate 模式，之後會優先維持陪伴式互動，直到你輸入其他模式指令或 auto。'
  },
  mission: {
    routing_mode_override: 'mode_3_mission',
    active_mode: 'mode_3_mission',
    pending_question: 'none',
    followup_turn_count: '0',
    followup_status: 'resolved',
    command_feedback: '已切換到 mission 模式，之後會優先維持任務整理與診前引導，直到你輸入其他模式指令或 auto。'
  },
  option: {
    routing_mode_override: 'mode_4_option',
    active_mode: 'mode_4_option',
    pending_question: 'none',
    followup_turn_count: '0',
    followup_status: 'resolved',
    command_feedback: '已切換到 option 模式，之後會優先用低負擔選項式互動，同時保留量表線索，直到你輸入其他模式指令或 auto。'
  },
  natural: {
    routing_mode_override: 'mode_5_natural',
    active_mode: 'mode_5_natural',
    pending_question: 'none',
    followup_turn_count: '0',
    followup_status: 'resolved',
    command_feedback: '已切換到 natural 模式，之後會優先用自然互動蒐集線索，直到你輸入其他模式指令或 auto。'
  },
  clarify: {
    routing_mode_override: 'mode_6_clarify',
    active_mode: 'mode_6_clarify',
    pending_question: 'none',
    followup_turn_count: '0',
    followup_status: 'resolved',
    command_feedback: '已切換到 clarify 模式，之後會優先用最小補問來釐清資訊，直到你輸入其他模式指令或 auto。'
  }
};

function isPossiblyCorruptedInput(value = '') {
  const text = String(value || '').trim();
  if (!text) return false;
  const stripped = text.replace(/\s+/g, '');
  if (stripped.length < 6) return false;
  const suspiciousChars = stripped.match(/[?？�]/g) || [];
  const suspiciousRatio = suspiciousChars.length / stripped.length;
  if (suspiciousRatio < 0.6) return false;
  return /[?？�]{3,}/.test(stripped);
}

function createCorruptedInputError() {
  const error = new Error('輸入文字疑似在送出前就已發生編碼損壞，這次不會儲存到對話記錄。請直接在網頁重新輸入，並避免使用會把中文轉成問號的外部工具。');
  error.status = 422;
  error.code = 'corrupted_input_rejected';
  return error;
}

const MODE_LABELS = {
  mode_1_void: 'Void',
  mode_2_soulmate: 'Soulmate',
  mode_3_mission: 'Mission',
  mode_4_option: 'Option',
  mode_5_natural: 'Natural',
  mode_6_clarify: 'Clarify',
  followup: 'Follow-up',
  safety: 'Safety',
  auto: 'Auto'
};

const HIGH_RISK_PATTERNS = [
  /我想死/,
  /想自殺/,
  /自殺/,
  /不想活/,
  /活不下去/,
  /結束生命/,
  /傷害自己/,
  /自殘/,
  /割了?自己的?(手臂|手腕|手)/,
  /割腕/,
  /拿刀割/,
  /用刀割/,
  /流了很多血/,
  /我受傷了/,
  /我把自己弄傷/,
  /如果消失就好了/,
  /想消失/,
  /沒必要活著/,
  /不如死/,
  /suicide/i,
  /kill myself/i
];

const OUTPUT_COMMAND_PATTERNS = [
  { type: 'clinician_summary', patterns: [/幫我整理給醫生/, /整理給醫師/, /醫師摘要/, /clinician summary/i, /doctor summary/i] },
  { type: 'patient_analysis', patterns: [/請分析我/, /分析我/, /給我分析/, /給我病人版本/, /patient analysis/i] },
  { type: 'patient_review', patterns: [/病人審閱稿/, /patient review/i] },
  { type: 'patient_authorization', patterns: [/授權狀態/, /病人授權稿/, /patient authorization/i] },
  { type: 'fhir_delivery', patterns: [/fhir draft/i, /\bfhir\b/i, /產生fhir/i] },
  { type: 'delivery_readiness', patterns: [/交付狀態/, /delivery readiness/i] },
  { type: 'session_export', patterns: [/匯出 session/i, /session export/i] }
];

const OUTPUT_LABELS = {
  clinician_summary: '醫師摘要',
  patient_analysis: '給病人的分析報告',
  patient_review: '病人審閱稿',
  patient_authorization: '病人授權稿',
  fhir_delivery: 'FHIR 草稿',
  delivery_readiness: '交付狀態',
  session_export: 'Session Export'
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function tryParseJson(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  const text = String(value).trim();
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (error) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (innerError) {
        return fallback;
      }
    }
    return fallback;
  }
}

function readPromptMarkdown(filename) {
  return fs.readFileSync(path.join(PROMPTS_DIR, filename), 'utf8');
}

function extractPromptBody(markdown) {
  const systemMatch = markdown.match(/### system\s+([\s\S]+)/);
  if (systemMatch) {
    return systemMatch[1].trim();
  }
  const instructionMatch = markdown.match(/## Instruction\s+([\s\S]+)/);
  if (instructionMatch) {
    return instructionMatch[1].trim();
  }
  return markdown.trim();
}

function interpolateTemplate(template, context) {
  return template.replace(/\{\{#([^}]+)#\}\}/g, (_, token) => {
    const parts = token.split('.');
    let current = context;
    for (const part of parts) {
      current = current == null ? '' : current[part];
    }
    if (current == null) return '';
    if (typeof current === 'object') return JSON.stringify(current, null, 2);
    return String(current);
  });
}

function createDefaultState() {
  const schema = JSON.parse(fs.readFileSync(STATE_SCHEMA_PATH, 'utf8'));
  const state = {};
  for (const item of schema) {
    state[item.name] = item.default_value;
  }
  return state;
}

function normalizeObjectState(state, key, emptyValue = {}) {
  return tryParseJson(state[key], emptyValue) || emptyValue;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeTherapeuticProfile(profile, fallbackUser = '') {
  const base = profile && typeof profile === 'object' ? profile : {};
  return {
    version: typeof base.version === 'string' && base.version.trim() ? base.version.trim() : '1.0',
    userId: typeof base.userId === 'string' && base.userId.trim() ? base.userId.trim() : String(fallbackUser || '').trim(),
    createdAt: base.createdAt || new Date().toISOString(),
    lastUpdatedAt: base.lastUpdatedAt || new Date().toISOString(),
    sessionCount: Number.isFinite(Number(base.sessionCount)) ? Number(base.sessionCount) : 0,
    stressors: normalizeArray(base.stressors).map((item) => typeof item === 'string' ? { label: item } : item).filter((item) => item && item.label),
    triggers: normalizeArray(base.triggers).map((item) => typeof item === 'string' ? { keyword: item } : item).filter((item) => item && item.keyword),
    copingProfile: base.copingProfile && typeof base.copingProfile === 'object'
      ? {
          preferredStyle: typeof base.copingProfile.preferredStyle === 'string' ? base.copingProfile.preferredStyle : '',
          effectiveMethods: normalizeArray(base.copingProfile.effectiveMethods),
          ineffectiveMethods: normalizeArray(base.copingProfile.ineffectiveMethods)
        }
      : { preferredStyle: '', effectiveMethods: [], ineffectiveMethods: [] },
    positiveAnchors: normalizeArray(base.positiveAnchors).map((item) => typeof item === 'string' ? { label: item, category: 'other' } : item).filter((item) => item && item.label),
    emotionalBaseline: base.emotionalBaseline && typeof base.emotionalBaseline === 'object'
      ? {
          dominantMood: typeof base.emotionalBaseline.dominantMood === 'string' ? base.emotionalBaseline.dominantMood : '',
          phq9Trend: normalizeArray(base.emotionalBaseline.phq9Trend),
          hamdSignalCount: Number.isFinite(Number(base.emotionalBaseline.hamdSignalCount)) ? Number(base.emotionalBaseline.hamdSignalCount) : 0
        }
      : { dominantMood: '', phq9Trend: [], hamdSignalCount: 0 },
    keyThemes: normalizeArray(base.keyThemes),
    clinicianNotes: typeof base.clinicianNotes === 'string' ? base.clinicianNotes : ''
  };
}

function defaultSessionExport(session) {
  return {
    patient: {
      key: session.user || 'patient-001',
      name: session.user || 'Demo User',
      gender: 'unknown'
    },
    session: {
      encounterKey: session.id,
      startedAt: session.startedAt,
      endedAt: session.updatedAt
    },
    author: DEFAULT_AUTHOR,
    active_mode: session.state.active_mode || 'auto',
    risk_flag: session.state.risk_flag || 'false',
    latest_tag_payload: normalizeObjectState(session.state, 'latest_tag_payload', {}),
    burden_level_state: normalizeObjectState(session.state, 'burden_level_state', {}),
    clinician_summary_draft: normalizeObjectState(session.state, 'clinician_summary_draft', {}),
    patient_analysis: normalizeObjectState(session.state, 'patient_analysis', {}),
    hamd_progress_state: normalizeObjectState(session.state, 'hamd_progress_state', {}),
    hamd_formal_assessment: normalizeObjectState(session.state, 'hamd_formal_assessment', {}),
    red_flag_payload: normalizeObjectState(session.state, 'red_flag_payload', {}),
    patient_authorization_state: normalizeObjectState(session.state, 'patient_authorization_state', {}),
    delivery_readiness_state: normalizeObjectState(session.state, 'delivery_readiness_state', {}),
    patient_review_packet: normalizeObjectState(session.state, 'patient_review_packet', {}),
    fhir_delivery_draft: normalizeObjectState(session.state, 'fhir_delivery_draft', {}),
    summary_draft_state: normalizeObjectState(session.state, 'summary_draft_state', {}),
    therapeutic_profile: normalizeObjectState(session.state, 'therapeutic_profile', normalizeTherapeuticProfile({}, session.user))
  };
}

function createDefaultFormalAssessment() {
  return {
    scale_version: 'HAM-D17',
    status: 'draft',
    assessment_mode: 'mixed',
    recall_window: 'past_7_days',
    pending_probe_item_code: '',
    pending_probe_question: '',
    items: HAMD_FORMAL_ITEMS.map((item) => ({
      item_code: item.item_code,
      item_label: item.item_label,
      scale_range: item.scale_range,
      evidence_type: 'none',
      direct_answer_value: null,
      ai_suggested_score: null,
      clinician_final_score: null,
      evidence_summary: [],
      rating_rationale: '',
      confidence: 'low',
      review_required: item.preferred_evidence === 'indirect_observation'
    })),
    ai_total_score: 0,
    clinician_total_score: null,
    severity_band: 'unrated',
    review_flags: [],
    rated_by: '',
    reviewed_at: ''
  };
}

function hydrateFormalAssessment(value) {
  const base = createDefaultFormalAssessment();
  const current = tryParseJson(value, {}) || {};
  const currentItems = Array.isArray(current.items) ? current.items : [];
  const itemMap = currentItems.reduce((acc, item) => {
    if (item && item.item_code) acc[item.item_code] = item;
    return acc;
  }, {});
  base.scale_version = current.scale_version || base.scale_version;
  base.status = current.status || base.status;
  base.assessment_mode = current.assessment_mode || base.assessment_mode;
  base.recall_window = current.recall_window || base.recall_window;
  base.pending_probe_item_code = current.pending_probe_item_code || '';
  base.pending_probe_question = current.pending_probe_question || '';
  base.ai_total_score = typeof current.ai_total_score === 'number' ? current.ai_total_score : 0;
  base.clinician_total_score = typeof current.clinician_total_score === 'number' ? current.clinician_total_score : null;
  base.severity_band = current.severity_band || base.severity_band;
  base.review_flags = normalizeArray(current.review_flags);
  base.rated_by = current.rated_by || '';
  base.reviewed_at = current.reviewed_at || '';
  base.items = HAMD_FORMAL_ITEMS.map((item) => Object.assign({}, base.items.find((entry) => entry.item_code === item.item_code), itemMap[item.item_code] || {}));
  return base;
}

function calculateHamdSeverity(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) return 'unrated';
  if (score <= 7) return 'normal_or_remission';
  if (score <= 13) return 'mild';
  if (score <= 18) return 'moderate';
  if (score <= 22) return 'severe';
  return 'very_severe';
}

function scoreRangeMax(scaleRange) {
  return scaleRange === '0_to_2' ? 2 : 4;
}

function clampScore(value, scaleRange) {
  if (value == null || value === '') return null;
  const max = scoreRangeMax(scaleRange);
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return Math.max(0, Math.min(max, Math.round(num)));
}

function inferDirectAnswerValue(text, scaleRange) {
  const input = String(text || '').trim();
  if (!input) return null;
  const numeric = input.match(/-?\d+/);
  if (numeric) {
    return clampScore(Number(numeric[0]), scaleRange);
  }
  const lower = input.toLowerCase();
  if (/(沒有|完全沒有|none|no)/.test(lower)) return 0;
  if (/(偶爾|一點|有點|輕微|偶而)/.test(lower)) return 1;
  if (scaleRange === '0_to_2') {
    if (/(常常|很多|嚴重|幾乎每天|每天|明顯)/.test(lower)) return 2;
    return null;
  }
  if (/(常常|明顯|中度|很多)/.test(lower)) return 2;
  if (/(很常|幾乎每天|每天|嚴重|很重|很明顯)/.test(lower)) return 3;
  if (/(極度|非常嚴重|整天|幾乎整天)/.test(lower)) return 4;
  return null;
}

function buildFormalAssessmentProbeFallback(state) {
  const assessment = hydrateFormalAssessment(state.hamd_formal_assessment);
  if (assessment.pending_probe_item_code) {
    return {
      should_ask: 'no',
      item_code: '',
      item_label: '',
      probe_question: '',
      reason: 'pending_probe_exists'
    };
  }
  const nextDimension = normalizeObjectState(state, 'hamd_progress_state', {}).next_recommended_dimension || 'depressed_mood';
  const candidateCode = (HAMD_DIMENSION_TO_ITEM_CODES[nextDimension] || []).find((itemCode) => {
    const item = assessment.items.find((entry) => entry.item_code === itemCode);
    return item && (!item.evidence_summary.length || item.review_required);
  });
  if (!candidateCode) {
    return {
      should_ask: 'no',
      item_code: '',
      item_label: '',
      probe_question: '',
      reason: 'no_gap'
    };
  }
  const definition = HAMD_FORMAL_ITEM_MAP[candidateCode];
  return {
    should_ask: 'yes',
    item_code: definition.item_code,
    item_label: definition.item_label,
    probe_question: definition.probe_question,
    reason: `gap_in_${nextDimension}`
  };
}

function buildEvidenceClassifierFallback(targetItems, pendingProbe, message) {
  const text = String(message || '').trim();
  if (!text || !targetItems.length) {
    return { assessment_mode: 'mixed', items: [] };
  }
  const updates = targetItems.slice(0, 2).map((item) => {
    const directValue = inferDirectAnswerValue(text, item.scale_range);
    const evidenceType = pendingProbe && pendingProbe.item_code === item.item_code
      ? (directValue != null ? 'direct_answer' : (item.preferred_evidence === 'indirect_observation' ? 'indirect_observation' : 'mixed'))
      : (item.preferred_evidence === 'indirect_observation' ? 'indirect_observation' : (directValue != null ? 'direct_answer' : 'mixed'));
    return {
      item_code: item.item_code,
      evidence_type: evidenceType,
      direct_answer_value: directValue,
      evidence_summary: [text],
      confidence: directValue != null ? 'high' : (evidenceType === 'indirect_observation' ? 'medium' : 'medium'),
      review_required: evidenceType !== 'direct_answer'
    };
  });
  return {
    assessment_mode: pendingProbe ? 'smart_hunter_probe' : 'mixed',
    items: updates
  };
}

function buildFormalScoringFallback(targetItems, evidenceResult) {
  const evidenceMap = (Array.isArray(evidenceResult.items) ? evidenceResult.items : []).reduce((acc, item) => {
    acc[item.item_code] = item;
    return acc;
  }, {});
  return {
    items: targetItems.map((item) => {
      const evidence = evidenceMap[item.item_code] || {};
      let suggested = evidence.direct_answer_value;
      if (suggested == null && Array.isArray(evidence.evidence_summary) && evidence.evidence_summary.length) {
        suggested = evidence.evidence_type === 'indirect_observation' ? 1 : Math.min(1, scoreRangeMax(item.scale_range));
      }
      suggested = clampScore(suggested, item.scale_range);
      if (suggested == null) return null;
      return {
        item_code: item.item_code,
        ai_suggested_score: suggested,
        rating_rationale: evidence.evidence_type === 'direct_answer'
          ? '依病人直接回答映射正式 HAM-D 分值。'
          : (evidence.evidence_type === 'indirect_observation'
            ? '依互動觀察與症狀線索形成 AI 建議分數，需臨床覆核。'
            : '同時參考病人回答與互動觀察形成 AI 建議分數。'),
        confidence: evidence.confidence || 'medium'
      };
    }).filter(Boolean)
  };
}

function mergeFormalAssessmentUpdates(assessment, evidenceResult, scoreResult) {
  const evidenceMap = (Array.isArray(evidenceResult.items) ? evidenceResult.items : []).reduce((acc, item) => {
    acc[item.item_code] = item;
    return acc;
  }, {});
  const scoreMap = (Array.isArray(scoreResult.items) ? scoreResult.items : []).reduce((acc, item) => {
    acc[item.item_code] = item;
    return acc;
  }, {});

  assessment.items = assessment.items.map((item) => {
    const evidence = evidenceMap[item.item_code];
    const score = scoreMap[item.item_code];
    if (!evidence && !score) return item;
    return Object.assign({}, item, {
      evidence_type: evidence ? evidence.evidence_type || item.evidence_type : item.evidence_type,
      direct_answer_value: evidence && Object.prototype.hasOwnProperty.call(evidence, 'direct_answer_value')
        ? clampScore(evidence.direct_answer_value, item.scale_range)
        : item.direct_answer_value,
      evidence_summary: evidence ? normalizeArray(evidence.evidence_summary) : item.evidence_summary,
      confidence: score ? score.confidence || item.confidence : (evidence ? evidence.confidence || item.confidence : item.confidence),
      review_required: evidence ? Boolean(evidence.review_required) : item.review_required,
      ai_suggested_score: score && Object.prototype.hasOwnProperty.call(score, 'ai_suggested_score')
        ? clampScore(score.ai_suggested_score, item.scale_range)
        : item.ai_suggested_score,
      rating_rationale: score ? score.rating_rationale || item.rating_rationale : item.rating_rationale
    });
  });

  const aiScores = assessment.items
    .map((item) => item.ai_suggested_score)
    .filter((value) => typeof value === 'number');
  const clinicianScores = assessment.items
    .map((item) => item.clinician_final_score)
    .filter((value) => typeof value === 'number');
  const reviewFlags = assessment.items
    .filter((item) => item.review_required || item.evidence_type === 'indirect_observation')
    .map((item) => item.item_code);
  assessment.assessment_mode = evidenceResult.assessment_mode || assessment.assessment_mode;
  assessment.ai_total_score = aiScores.reduce((sum, value) => sum + value, 0);
  assessment.clinician_total_score = clinicianScores.length ? clinicianScores.reduce((sum, value) => sum + value, 0) : null;
  assessment.severity_band = calculateHamdSeverity(assessment.clinician_total_score != null ? assessment.clinician_total_score : assessment.ai_total_score);
  assessment.review_flags = reviewFlags;
  assessment.status = reviewFlags.length ? 'review_required' : 'draft';
  return assessment;
}

function getFormalTargetItems(state, limit = 2) {
  const assessment = hydrateFormalAssessment(state.hamd_formal_assessment);
  if (assessment.pending_probe_item_code && HAMD_FORMAL_ITEM_MAP[assessment.pending_probe_item_code]) {
    return [HAMD_FORMAL_ITEM_MAP[assessment.pending_probe_item_code]];
  }
  const progress = normalizeObjectState(state, 'hamd_progress_state', {});
  const dimensions = [];
  if (progress.next_recommended_dimension) dimensions.push(progress.next_recommended_dimension);
  normalizeArray(progress.supported_dimensions).forEach((item) => {
    if (dimensions.indexOf(item) === -1) dimensions.push(item);
  });
  if (!dimensions.length) dimensions.push('depressed_mood');
  const targetCodes = [];
  dimensions.forEach((dimension) => {
    (HAMD_DIMENSION_TO_ITEM_CODES[dimension] || []).forEach((itemCode) => {
      if (targetCodes.length >= limit) return;
      const current = assessment.items.find((item) => item.item_code === itemCode);
      if (!current) return;
      if (!current.evidence_summary.length || current.review_required) {
        if (targetCodes.indexOf(itemCode) === -1) targetCodes.push(itemCode);
      }
    });
  });
  return targetCodes.map((itemCode) => HAMD_FORMAL_ITEM_MAP[itemCode]).filter(Boolean);
}

function buildFormalClinicianFields(formalAssessment) {
  return {
    hamd_item_scores: formalAssessment.items
      .filter((item) => item.ai_suggested_score != null || item.clinician_final_score != null)
      .map((item) => ({
        item_code: item.item_code,
        item_label: item.item_label,
        ai_suggested_score: item.ai_suggested_score,
        clinician_final_score: item.clinician_final_score
      })),
    hamd_total_score_ai: formalAssessment.ai_total_score,
    hamd_total_score_clinician: formalAssessment.clinician_total_score,
    hamd_severity_band: formalAssessment.severity_band,
    hamd_evidence_table: formalAssessment.items
      .filter((item) => normalizeArray(item.evidence_summary).length)
      .map((item) => ({
        item_label: item.item_label,
        evidence_type: item.evidence_type,
        evidence_summary: normalizeArray(item.evidence_summary),
        rating_rationale: item.rating_rationale || ''
      })),
    hamd_review_required_items: normalizeArray(formalAssessment.review_flags)
  };
}

function buildFormalFhirTargets(formalAssessment) {
  return formalAssessment.items
    .filter((item) => item.ai_suggested_score != null || item.clinician_final_score != null)
    .map((item) => ({
      item_code: item.item_code,
      evidence_type: item.evidence_type,
      status: 'preliminary'
    }));
}

function isDraftRelevantHistoryItem(item) {
  if (!item || typeof item !== 'object') return false;
  const kind = String(item.kind || 'chat').trim();
  return kind !== 'command' && kind !== 'output';
}

function formatTranscriptEntry(item) {
  if (!item || typeof item !== 'object') return '';
  const role = item.role === 'assistant' ? 'AI' : '使用者';
  const content = String(item.content || '').trim();
  if (!content) return '';
  return `${role}：${content}`;
}

function isDraftRelevantInstruction(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/^\//, '');
  if (Object.prototype.hasOwnProperty.call(COMMAND_MAP, normalized)) {
    return false;
  }
  return !OUTPUT_COMMAND_PATTERNS.some((item) => item.patterns.some((pattern) => pattern.test(text)));
}

function buildPatientAnalysis(state, fallbackMessage = '') {
  const clinician = normalizeObjectState(state, 'clinician_summary_draft', {});
  const patientReview = normalizeObjectState(state, 'patient_review_packet', {});
  const latestTags = normalizeObjectState(state, 'latest_tag_payload', {});
  const burden = normalizeObjectState(state, 'burden_level_state', {});
  const hamdProgress = normalizeObjectState(state, 'hamd_progress_state', {});
  const therapeuticProfile = normalizeObjectState(state, 'therapeutic_profile', {});
  const concerns = normalizeArray(clinician.chief_concerns).slice(0, 3);
  const observations = normalizeArray(clinician.symptom_observations).slice(0, 3);
  const followupNeeds = normalizeArray(clinician.followup_needs).slice(0, 3);
  const stressors = normalizeArray(therapeuticProfile.stressors)
    .map((item) => typeof item === 'string' ? item : item?.label)
    .filter(Boolean)
    .slice(0, 3);
  const keyThemes = normalizeArray(therapeuticProfile.keyThemes).filter(Boolean).slice(0, 3);
  const positiveAnchors = normalizeArray(therapeuticProfile.positiveAnchors)
    .map((item) => typeof item === 'string' ? item : item?.label)
    .filter(Boolean)
    .slice(0, 2);
  const supportedDimensions = normalizeArray(hamdProgress.supported_dimensions).filter(Boolean).slice(0, 3);
  const recentEvidence = normalizeArray(hamdProgress.recent_evidence).filter(Boolean).slice(0, 3);
  const sentimentTags = normalizeArray(latestTags.sentiment_tags).filter(Boolean).slice(0, 3);
  const cognitiveTags = normalizeArray(latestTags.cognitive_tags).filter(Boolean).slice(0, 2);
  const behavioralTags = normalizeArray(latestTags.behavioral_tags).filter(Boolean).slice(0, 2);
  const summary =
    patientReview.patient_facing_summary ||
    clinician.draft_summary ||
    fallbackMessage ||
    '目前還沒有足夠內容可以整理成給病人的分析。';
  const stateUnderstanding = [];
  if (sentimentTags.length) stateUnderstanding.push(`你最近的情緒線索比較靠近「${sentimentTags.join('、')}」`);
  if (burden.burden_level === 'high') stateUnderstanding.push('你現在的互動負擔偏高，可能不太適合一次處理太多問題');
  if (burden.burden_level === 'medium') stateUnderstanding.push('你現在還撐得住對話，但可能已經有點疲累，需要比較溫和的整理節奏');
  if (supportedDimensions.length) stateUnderstanding.push(`目前對話已經碰到的狀態面向包含 ${supportedDimensions.join('、')}`);
  if (keyThemes.length) stateUnderstanding.push(`這段對話反覆繞著 ${keyThemes.join('、')} 這幾個主題`);
  if (!stateUnderstanding.length) stateUnderstanding.push('目前資料還偏少，但已經能看出你不是單純想抱怨，而是在試著整理自己的狀態');

  const pressurePoints = [];
  if (concerns.length) pressurePoints.push(...concerns.map((item) => `你明顯在意的事包括：${item}`));
  if (stressors.length) pressurePoints.push(...stressors.map((item) => `可能正在拉扯你的壓力來源之一是：${item}`));
  if (observations.length) pressurePoints.push(...observations.map((item) => `我注意到一個具體表現是：${item}`));
  if (recentEvidence.length) pressurePoints.push(...recentEvidence.map((item) => `最近浮出的線索像是：${item}`));
  if (cognitiveTags.length) pressurePoints.push(`你的想法裡可能也帶著 ${cognitiveTags.join('、')} 這類認知壓力`);
  if (behavioralTags.length) pressurePoints.push(`行為線索上有 ${behavioralTags.join('、')} 的傾向`);
  const dedupedPressurePoints = Array.from(new Set(pressurePoints)).slice(0, 4);

  const supportSuggestions = [];
  if (burden.response_style === 'option_first' || burden.burden_level === 'high') {
    supportSuggestions.push('你現在比較適合先用「少一點選項、少一點追問」的方式繼續，而不是一次講很多。');
  } else {
    supportSuggestions.push('你現在可以承受一些整理，所以比較適合慢慢把最卡的那件事講清楚。');
  }
  if (followupNeeds.length) {
    supportSuggestions.push(`如果要再往下聊，優先可以放在：${followupNeeds.join('、')}`);
  }
  if (hamdProgress.next_recommended_dimension) {
    supportSuggestions.push(`下一步如果要更理解你的狀態，可以再補一點和「${hamdProgress.next_recommended_dimension}」有關的感受或例子。`);
  }
  if (positiveAnchors.length) {
    supportSuggestions.push(`你不是只有困住的部分，像 ${positiveAnchors.join('、')} 這些也可能是幫你穩住自己的資源。`);
  }
  if (!supportSuggestions.length) {
    supportSuggestions.push('如果你願意，下一輪可以先從最近最卡、最難受，或最反覆想到的一件事開始。');
  }

  const nextSteps = [
    '如果你想要的是被理解，可以繼續補充最近最卡的一件事，讓分析不要只停在表面。',
    '如果你想把這些內容整理成比較正式的看診材料，可以按「整理給醫師」。'
  ];
  if (burden.burden_level === 'high') {
    nextSteps.unshift('如果你現在很沒力，也可以只回一小句，像「最難受的是什麼」或「我最卡在哪裡」。');
  }

  const bullets = Array.from(new Set([
    ...concerns,
    ...observations,
    ...stressors,
    ...keyThemes
  ])).slice(0, 5);
  const markdown = [
    '## 給你的分析',
    '',
    summary,
    '',
    '### 我怎麼理解你現在的狀態',
    ...stateUnderstanding.map((item) => `- ${item}`),
    '',
    '### 我目前注意到你卡住的地方',
    ...(dedupedPressurePoints.length
      ? dedupedPressurePoints.map((item) => `- ${item}`)
      : ['- 目前還需要更多對話，才能整理出更具體的卡點。']),
    '',
    '### 你現在比較需要的支持方式',
    ...supportSuggestions.map((item) => `- ${item}`),
    '',
    '### 接下來可以怎麼做',
    ...nextSteps.map((item) => `- ${item}`),
    '',
    '### 提醒',
    '這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。'
  ].join('\n');

  return {
    version: 'p3_patient_analysis_v2',
    status: 'ready',
    plain_summary: summary,
    key_points: bullets,
    reminder: '這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。',
    markdown
  };
}

function createEmptyRetrievalAudit(kind) {
  return {
    retrieval_status: 'empty',
    use_knowledge: 'no',
    knowledge_role: kind === 'mission' ? 'none' : 'none',
    confidence_note: 'No relevant local knowledge chunk matched this turn.',
    safe_usage_note: 'Do not force knowledge into the answer when retrieval is empty.'
  };
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token && token.length > 1);
}

function createSimpleRetriever(corpusText) {
  const rawChunks = String(corpusText || '')
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.replace(/\s+/g, ' ').trim())
    .filter((chunk) => chunk.length > 40);
  const indexedChunks = rawChunks.map((chunk) => ({
    text: chunk,
    tokens: new Set(tokenize(chunk))
  }));

  return {
    retrieve(query, topK = 4) {
      const queryTokens = tokenize(query);
      if (queryTokens.length === 0) return [];
      return indexedChunks
        .map((chunk) => {
          let score = 0;
          for (const token of queryTokens) {
            if (chunk.tokens.has(token)) score += 1;
          }
          return { text: chunk.text, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    }
  };
}

function createPromptRegistry() {
  const registry = {};
  for (const [key, filename] of Object.entries(PROMPT_FILES)) {
    registry[key] = extractPromptBody(readPromptMarkdown(filename));
  }
  return registry;
}

class AICompanionEngine {
  constructor(options = {}) {
    this.modelClient = options.modelClient || completeChat;
    this.provider = options.provider || '';
    this.model = options.model || (
      this.provider === 'google'
        ? DEFAULT_GOOGLE_MODEL
        : this.provider === 'openrouter'
          ? DEFAULT_OPENROUTER_MODEL
          : DEFAULT_GROQ_MODEL
    );
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey || '';
    this.fetchImpl = options.fetchImpl;
    this.sessions = options.sessions || new Map();
    this.onSessionsChanged = typeof options.onSessionsChanged === 'function' ? options.onSessionsChanged : null;
    this.prompts = createPromptRegistry();
    this.retriever = options.retriever || createSimpleRetriever(this.loadRagCorpus());
    this.now = options.now || (() => new Date().toISOString());
  }

  loadRagCorpus() {
    if (fs.existsSync(RAG_TEXT_PATH)) {
      return fs.readFileSync(RAG_TEXT_PATH, 'utf8');
    }
    return '';
  }

  findLatestSessionIdByUser(user) {
    const normalizedUser = String(user || '').trim();
    if (!normalizedUser) return '';
    let latestSession = null;
    for (const session of this.sessions.values()) {
      if (String(session.user || '').trim() !== normalizedUser) continue;
      if (!latestSession || String(session.updatedAt || '') > String(latestSession.updatedAt || '')) {
        latestSession = session;
      }
    }
    return latestSession ? latestSession.id : '';
  }

  persistSessions() {
    if (this.onSessionsChanged) {
      this.onSessionsChanged(this.sessions);
    }
  }

  syncTherapeuticProfile(session, profile) {
    if (!session || !profile || typeof profile !== 'object') return;
    session.state.therapeutic_profile = normalizeTherapeuticProfile(profile, session.user);
  }

  getOrCreateSession(id, user, options = {}) {
    const forceNewSession = Boolean(options.forceNewSession);
    const sessionId = id || (!forceNewSession && this.findLatestSessionIdByUser(user)) || `conv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        user: user || 'web-demo-user',
        startedAt: this.now(),
        updatedAt: this.now(),
        history: [],
        state: createDefaultState(),
        revision: 0,
        memory_snapshot: {
          note_history: [],
          last_user_message: '',
          last_assistant_message: '',
          active_mode: 'auto',
          risk_flag: 'false',
          latest_tag_summary: '',
          hamd_focus: ''
        },
        output_cache: {}
      });
      this.persistSessions();
    }
    const session = this.sessions.get(sessionId);
    session.user = user || session.user;
    session.updatedAt = this.now();
    this.persistSessions();
    return session;
  }

  async handleMessage(payload, options = {}) {
    const message = String(payload.message || '').trim();
    if (message && isPossiblyCorruptedInput(message)) {
      throw createCorruptedInputError();
    }

    const session = this.getOrCreateSession(payload.conversation_id, payload.user, {
      forceNewSession: payload.force_new_session
    });
    const state = session.state;
    this.syncTherapeuticProfile(session, payload.therapeutic_profile);
    if (!message) {
      this.persistSessions();
      return {
        conversation_id: session.id,
        answer: '',
        state,
        session_export: defaultSessionExport(session),
        metadata: {
          active_mode: state.active_mode,
          risk_flag: state.risk_flag,
          latest_tag_payload: normalizeObjectState(state, 'latest_tag_payload', {}),
          burden_level_state: normalizeObjectState(state, 'burden_level_state', {})
        }
      };
    }

    const command = this.detectCommand(message);
    const outputType = this.detectOutputCommand(message);
    const rawMessage = String(payload.raw_message || '').trim() || message;
    const isInternalCall = payload.raw_message === '' || payload.hide_response;
    const userHistoryKind = command ? 'command' : outputType ? 'output' : 'chat';

    if (!isInternalCall) {
      session.history.push({ role: 'user', content: rawMessage, kind: userHistoryKind });
      if (userHistoryKind === 'chat') {
        session.memory_snapshot.last_user_message = rawMessage;
        session.revision += 1;
      }
    }

    if (command) {
      Object.assign(state, COMMAND_MAP[command]);
      const answer = state.command_feedback;
      session.history.push({ role: 'assistant', content: answer, kind: 'command' });
      this.updateMemorySnapshot(session, answer);
      this.persistSessions();
      return {
        conversation_id: session.id,
        answer,
        state: deepClone(state),
        session_export: defaultSessionExport(session),
        metadata: {
          active_mode: state.active_mode,
          route: 'command',
          risk_flag: state.risk_flag,
          latest_tag_payload: normalizeObjectState(state, 'latest_tag_payload', {}),
          burden_level_state: normalizeObjectState(state, 'burden_level_state', {})
        }
      };
    }

    if (this.isHighRisk(message)) {
      const riskPayload = await this.runJsonTask('riskStructurer', session, message, {
        fallback: {
          route_type: 'safety',
          source_mode: 'safety',
          followup_status: 'resolved',
          risk_level: 'high',
          sentiment_tags: ['distress'],
          behavioral_tags: [],
          cognitive_tags: [],
          warning_tags: ['self_harm_risk'],
          signals: [message],
          summary: 'User expressed possible self-harm or suicidal ideation.'
        }
      });
      state.risk_flag = 'true';
      state.red_flag_payload = riskPayload;
      state.latest_tag_payload = riskPayload;
      state.pending_question = 'none';
      state.active_mode = 'safety';
      const answer = await this.runTextTask('safetyResponse', session, message);
      session.history.push({ role: 'assistant', content: answer });
      this.updateMemorySnapshot(session, answer);
      this.persistSessions();
      return {
        conversation_id: session.id,
        answer,
        state: deepClone(state),
        session_export: defaultSessionExport(session),
        metadata: {
          active_mode: state.active_mode,
          route: 'safety',
          risk_flag: state.risk_flag,
          latest_tag_payload: normalizeObjectState(state, 'latest_tag_payload', {}),
          burden_level_state: normalizeObjectState(state, 'burden_level_state', {})
        }
      };
    }

    if (outputType) {
      const outputResult = await this.generateOutput({
        conversation_id: session.id,
        user: session.user,
        output_type: outputType,
        instruction: message
      });
      session.history.push({ role: 'assistant', content: outputResult.formatted_text, kind: 'output' });
      this.updateMemorySnapshot(session, outputResult.formatted_text);
      this.persistSessions();
      return {
        conversation_id: session.id,
        answer: outputResult.formatted_text,
        state: deepClone(session.state),
        session_export: outputResult.session_export,
        metadata: Object.assign({}, outputResult.metadata, { route: 'output', output_type: outputType })
      };
    }

    state.risk_flag = 'false';
    state.red_flag_payload = 'none';

    await this.updateSharedState(session, message);

    if (state.pending_question !== 'none' && state.pending_question) {
      const answer = await this.handleFollowup(session, message);
      session.history.push({ role: 'assistant', content: answer, kind: 'chat' });
      this.updateMemorySnapshot(session, answer);
      return {
        conversation_id: session.id,
        answer,
        state: deepClone(state),
        session_export: defaultSessionExport(session),
        metadata: {
          active_mode: state.active_mode,
          route: 'followup',
          risk_flag: state.risk_flag,
          latest_tag_payload: normalizeObjectState(state, 'latest_tag_payload', {}),
          burden_level_state: normalizeObjectState(state, 'burden_level_state', {})
        }
      };
    }

    const activeMode = await this.resolveActiveMode(session, message);
    state.active_mode = activeMode;

    let answer = '';
    if (activeMode === 'mode_1_void') {
      answer = await this.runTextTask('voidBox', session, message);
    } else if (activeMode === 'mode_2_soulmate') {
      answer = await this.runTextTask('soulMate', session, message);
    } else if (activeMode === 'mode_3_mission') {
      answer = await this.handleMission(session, message);
    } else if (activeMode === 'mode_4_option') {
      answer = await this.handleOption(session, message);
    } else if (activeMode === 'mode_6_clarify') {
      answer = await this.handleClarify(session, message);
    } else {
      state.active_mode = 'mode_5_natural';
      answer = await this.buildNaturalResponse(session, message);
    }

    session.history.push({ role: 'assistant', content: answer, kind: 'chat' });
    this.updateMemorySnapshot(session, answer);
    this.persistSessions();

    return {
      conversation_id: session.id,
      answer,
      state: deepClone(state),
      session_export: defaultSessionExport(session),
      metadata: {
        active_mode: state.active_mode,
        route: MODE_LABELS[state.active_mode] || state.active_mode,
        risk_flag: state.risk_flag,
        latest_tag_payload: normalizeObjectState(state, 'latest_tag_payload', {}),
        burden_level_state: normalizeObjectState(state, 'burden_level_state', {})
      }
    };
  }

  detectCommand(message) {
    const normalized = message.trim().toLowerCase().replace(/^\//, '');
    return Object.prototype.hasOwnProperty.call(COMMAND_MAP, normalized) ? normalized : '';
  }

  detectOutputCommand(message) {
    const text = String(message || '').trim();
    for (const item of OUTPUT_COMMAND_PATTERNS) {
      if (item.patterns.some((pattern) => pattern.test(text))) {
        return item.type;
      }
    }
    return '';
  }

  isHighRisk(message) {
    return HIGH_RISK_PATTERNS.some((pattern) => pattern.test(message));
  }

  async updateSharedState(session, message) {
    const state = session.state;
    const tags = await this.runJsonTask('tagStructurer', session, message, {
      fallback: {
        route_type: 'normal',
        source_mode: state.active_mode,
        followup_status: state.followup_status,
        sentiment_tags: [],
        behavioral_tags: [],
        cognitive_tags: [],
        warning_tags: [],
        summary: message
      }
    });
    state.latest_tag_payload = tags;

    const burden = await this.runJsonTask('burdenLevelBuilder', session, message, {
      fallback: {
        burden_level: message.length < 12 ? 'high' : 'medium',
        response_style: message.length < 12 ? 'option_first' : 'natural',
        followup_budget: message.length < 12 ? '0' : '1',
        burden_note: 'Fallback burden estimate.'
      }
    });
    state.burden_level_state = burden;

    const hamd = await this.runJsonTask('hamdProgressTracker', session, message, {
      fallback: {
        progress_stage: 'initial',
        current_focus: 'depressed_mood',
        supported_dimensions: [],
        covered_dimensions: [],
        missing_dimensions: ['depressed_mood', 'guilt', 'work_interest', 'retardation', 'agitation', 'somatic_anxiety', 'insomnia'],
        next_recommended_dimension: 'depressed_mood',
        recent_evidence: [message],
        needs_clarification: 'yes',
        status_summary: 'Fallback HAM-D state.'
      }
    });
    state.hamd_progress_state = hamd;
    await this.updateFormalAssessment(session, message);
  }

  async resolveActiveMode(session, message) {
    const state = session.state;
    if (state.routing_mode_override && state.routing_mode_override !== 'auto') {
      return state.routing_mode_override;
    }

    const burden = normalizeObjectState(state, 'burden_level_state', {});
    if (burden.response_style === 'option_first' || burden.burden_level === 'high') {
      const lowEnergy = await this.runClassifier('lowEnergyDetector', session, message, [
        'degrade_option',
        'degrade_soulmate',
        'continue_auto'
      ], 'continue_auto');
      if (lowEnergy === 'degrade_option') return 'mode_4_option';
      if (lowEnergy === 'degrade_soulmate') return 'mode_2_soulmate';
    }

    const intent = await this.runClassifier('intentClassifier', session, message, [
      'mode_1_void',
      'mode_2_soulmate',
      'mode_3_mission',
      'mode_4_option',
      'mode_5_natural',
      'mode_6_clarify'
    ], 'mode_5_natural');
    return intent;
  }

  async handleMission(session, message) {
    const state = session.state;
    const retrieval = this.retriever.retrieve(message, 4);
    const retrievalContext = retrieval.map((item, index) => `${index + 1}. ${item.text}`).join('\n\n');
    const audit = retrieval.length > 0
      ? await this.runJsonTask('missionRetrievalAudit', session, message, {
          extraContext: { retrieval: { result: retrievalContext } },
          fallback: createEmptyRetrievalAudit('mission')
        })
      : createEmptyRetrievalAudit('mission');
    state.mission_retrieval_audit = audit;
    return this.runTextTask('missionGuide', session, message, {
      extraContext: { retrieval: { result: retrievalContext } }
    });
  }

  async handleOption(session, message) {
    const state = session.state;
    const retrieval = this.retriever.retrieve(message, 4);
    const retrievalContext = retrieval.map((item, index) => `${index + 1}. ${item.text}`).join('\n\n');
    const audit = retrieval.length > 0
      ? await this.runJsonTask('optionRetrievalAudit', session, message, {
          extraContext: { retrieval: { result: retrievalContext } },
          fallback: createEmptyRetrievalAudit('option')
        })
      : createEmptyRetrievalAudit('option');
    state.option_retrieval_audit = audit;
    return this.runTextTask('optionSelector', session, message, {
      extraContext: { retrieval: { result: retrievalContext } }
    });
  }

  async handleClarify(session, message) {
    const state = session.state;
    const question = await this.runTextTask('clarifyQuestion', session, message);
    state.pending_question = question;
    state.followup_turn_count = '1';
    state.followup_status = 'pending';
    state.active_mode = 'mode_6_clarify';
    return question;
  }

  async handleFollowup(session, message) {
    const state = session.state;
    const turnCount = Number(state.followup_turn_count || '0');
    const burden = normalizeObjectState(state, 'burden_level_state', {});
    const promptKey = turnCount >= 2 || burden.followup_budget === '0' ? 'followupFinalizer' : 'followupResolver';
    const candidate = await this.runTextTask(promptKey, session, message);
    const classification = turnCount >= 2
      ? 'followup_answer_now'
      : await this.runClassifier('followupOutputClassifier', session, candidate, ['followup_ask_more', 'followup_answer_now'], candidate.includes('?') ? 'followup_ask_more' : 'followup_answer_now', {
          userPromptOverride: candidate
        });

    if (classification === 'followup_ask_more' && turnCount < 2) {
      state.pending_question = candidate;
      state.followup_turn_count = String(turnCount + 1);
      state.followup_status = 'pending';
      state.active_mode = 'followup';
      return candidate;
    }

    state.pending_question = 'none';
    state.followup_turn_count = '0';
    state.followup_status = 'resolved';
    return candidate;
  }

  updateMemorySnapshot(session, assistantAnswer = '') {
    const state = session.state;
    const latestTags = normalizeObjectState(state, 'latest_tag_payload', {});
    const hamd = normalizeObjectState(state, 'hamd_progress_state', {});
    const note = String(latestTags.summary || '').trim();
    if (note) {
      session.memory_snapshot.note_history.push(note);
      session.memory_snapshot.note_history = session.memory_snapshot.note_history.slice(-20);
    }
    session.memory_snapshot.last_assistant_message = assistantAnswer || session.memory_snapshot.last_assistant_message;
    session.memory_snapshot.active_mode = state.active_mode || session.memory_snapshot.active_mode;
    session.memory_snapshot.risk_flag = state.risk_flag || session.memory_snapshot.risk_flag;
    session.memory_snapshot.latest_tag_summary = note;
    session.memory_snapshot.hamd_focus = String(hamd.current_focus || '').trim();
  }

  async updateFormalAssessment(session, message) {
    const state = session.state;
    const assessment = hydrateFormalAssessment(state.hamd_formal_assessment);
    const targetItems = getFormalTargetItems(state, 2);
    const pendingProbe = assessment.pending_probe_item_code
      ? {
          item_code: assessment.pending_probe_item_code,
          probe_question: assessment.pending_probe_question
        }
      : {};
    const evidenceResult = await this.runJsonTask('hamdEvidenceClassifier', session, message, {
      extraContext: {
        formal_assessment: {
          target_items: targetItems,
          pending_probe: pendingProbe
        }
      },
      fallback: buildEvidenceClassifierFallback(targetItems, pendingProbe, message)
    });
    const scoreResult = await this.runJsonTask('hamdFormalItemScorer', session, message, {
      extraContext: {
        formal_assessment: {
          target_items: targetItems,
          evidence_result: evidenceResult
        }
      },
      fallback: buildFormalScoringFallback(targetItems, evidenceResult)
    });
    state.hamd_formal_assessment = mergeFormalAssessmentUpdates(assessment, evidenceResult, scoreResult);
    if (assessment.pending_probe_item_code) {
      const answeredPending = state.hamd_formal_assessment.items.find((item) =>
        item.item_code === assessment.pending_probe_item_code && normalizeArray(item.evidence_summary).length
      );
      if (answeredPending) {
        state.hamd_formal_assessment.pending_probe_item_code = '';
        state.hamd_formal_assessment.pending_probe_question = '';
      }
    }
  }

  async buildNaturalResponse(session, message) {
    const state = session.state;
    const formalProbe = await this.runJsonTask('hamdFormalProbeSelector', session, message, {
      extraContext: {
        formal_probe: {
          items: getFormalTargetItems(state, 4)
        }
      },
      fallback: buildFormalAssessmentProbeFallback(state)
    });
    const answer = await this.runTextTask('smartHunter', session, message, {
      extraContext: {
        formal_probe: formalProbe
      }
    });
    const normalizedProbeQuestion = String(formalProbe.probe_question || '').trim();
    if (formalProbe.should_ask === 'yes' && formalProbe.item_code && normalizedProbeQuestion) {
      const assessment = hydrateFormalAssessment(state.hamd_formal_assessment);
      assessment.pending_probe_item_code = formalProbe.item_code;
      assessment.pending_probe_question = normalizedProbeQuestion;
      assessment.assessment_mode = 'smart_hunter_probe';
      state.hamd_formal_assessment = assessment;
      if (answer.includes(normalizedProbeQuestion)) {
        return answer;
      }
      return `${answer}\n\n${normalizedProbeQuestion}`;
    }
    return answer;
  }

  async updateSummaryChain(session, message) {
    const state = session.state;
    state.summary_draft_state = await this.runJsonTask('summaryDraftBuilder', session, message, {
      fallback: {
        active_mode: state.active_mode,
        risk_flag: state.risk_flag,
        followup_status: state.followup_status,
        latest_tags: state.latest_tag_payload,
        red_flags: state.red_flag_payload,
        hamd_progress: state.hamd_progress_state,
        hamd_formal_assessment: state.hamd_formal_assessment,
        draft_summary: message
      }
    });
    const formalAssessment = hydrateFormalAssessment(state.hamd_formal_assessment);
    state.clinician_summary_draft = await this.runJsonTask('clinicianSummaryBuilder', session, message, {
      fallback: {
        summary_version: 'p1_clinician_draft_v1',
        active_mode: state.active_mode,
        risk_level: state.risk_flag === 'true' ? 'high' : 'watch',
        chief_concerns: [message],
        symptom_observations: normalizeArray(normalizeObjectState(state, 'hamd_progress_state', {}).recent_evidence),
        hamd_signals: normalizeArray(normalizeObjectState(state, 'hamd_progress_state', {}).covered_dimensions),
        ...buildFormalClinicianFields(formalAssessment),
        followup_needs: [],
        safety_flags: normalizeArray(normalizeObjectState(state, 'red_flag_payload', {}).warning_tags),
        patient_tone: 'unknown',
        draft_summary: typeof state.summary_draft_state === 'object' ? state.summary_draft_state.draft_summary || message : message
      }
    });
    state.clinician_summary_draft = Object.assign(
      {},
      state.clinician_summary_draft,
      buildFormalClinicianFields(formalAssessment)
    );
    state.patient_review_packet = await this.runJsonTask('patientReviewBuilder', session, message, {
      fallback: {
        packet_version: 'p3_patient_review_v1',
        status: 'draft_review',
        patient_facing_summary: typeof state.clinician_summary_draft === 'object' ? state.clinician_summary_draft.draft_summary || message : message,
        confirm_items: [],
        editable_items: [],
        remove_if_wrong: [],
        authorization_needed: 'yes',
        authorization_prompt: '若你願意，我可以把這份整理提供給臨床團隊。'
      }
    });
    state.patient_analysis = buildPatientAnalysis(state, message);
    state.patient_authorization_state = await this.runJsonTask('patientAuthorizationBuilder', session, message, {
      fallback: {
        state_version: 'p3_authorization_state_v1',
        authorization_status: 'ready_for_consent',
        share_with_clinician: 'yes',
        review_blockers: [],
        patient_actions: [],
        restricted_sections: [],
        consent_note: 'Fallback authorization state.'
      }
    });
    state.fhir_delivery_draft = await this.runJsonTask('fhirDeliveryBuilder', session, message, {
      fallback: {
        draft_version: 'p3_fhir_delivery_v1',
        delivery_status: 'ready_for_mapping',
        consent_gate: 'ready_for_consent',
        resources: [],
        hamd_formal_targets: buildFormalFhirTargets(formalAssessment),
        narrative_summary: typeof state.clinician_summary_draft === 'object' ? state.clinician_summary_draft.draft_summary || message : message
      }
    });
    state.fhir_delivery_draft = Object.assign({}, state.fhir_delivery_draft, {
      hamd_formal_targets: buildFormalFhirTargets(formalAssessment)
    });
    state.delivery_readiness_state = await this.runJsonTask('deliveryReadinessBuilder', session, message, {
      fallback: {
        state_version: 'p3_delivery_readiness_v1',
        readiness_status: 'ready_for_backend_mapping',
        primary_blockers: [],
        next_step: 'Send to backend mapping',
        provenance_requirements: [],
        handoff_note: 'Fallback delivery readiness state.'
      }
    });
  }

  async ensureStructuredOutputs(session, instruction = '') {
    if (session.structured_revision === session.revision) {
      return;
    }
    const normalizedInstruction = String(instruction || '').trim();
    const triggerMessage =
      (isDraftRelevantInstruction(normalizedInstruction) ? normalizedInstruction : '') ||
      session.memory_snapshot.last_user_message ||
      session.history.slice().reverse().find((item) => item.role === 'user' && isDraftRelevantHistoryItem(item))?.content ||
      '';
    await this.updateSummaryChain(session, triggerMessage);
    session.structured_revision = session.revision;
  }

  formatStructuredOutput(outputType, output) {
    const label = OUTPUT_LABELS[outputType] || outputType;
    if (outputType === 'session_export') {
      return `${label}\n\n${JSON.stringify(output, null, 2)}`;
    }
    return `${label}\n\n${JSON.stringify(output, null, 2)}`;
  }

  async generateOutput(payload) {
    const session = this.getOrCreateSession(payload.conversation_id, payload.user, {
      forceNewSession: payload.force_new_session
    });
    this.syncTherapeuticProfile(session, payload.therapeutic_profile);
    const outputType = String(payload.output_type || '').trim();
    const instruction = String(payload.instruction || '').trim();
    const cacheKey = outputType;
    const cached = session.output_cache[cacheKey];
    if (cached && cached.revision === session.revision) {
      return cached.value;
    }

    if (!outputType) {
      const error = new Error('output_type is required.');
      error.status = 400;
      error.code = 'missing_output_type';
      throw error;
    }

    await this.ensureStructuredOutputs(session, instruction);

    let output;
      if (outputType === 'clinician_summary') {
        output = normalizeObjectState(session.state, 'clinician_summary_draft', {});
      } else if (outputType === 'patient_analysis') {
        output = normalizeObjectState(session.state, 'patient_analysis', {});
      } else if (outputType === 'patient_review') {
        output = normalizeObjectState(session.state, 'patient_review_packet', {});
    } else if (outputType === 'patient_authorization') {
      output = normalizeObjectState(session.state, 'patient_authorization_state', {});
    } else if (outputType === 'fhir_delivery') {
      output = normalizeObjectState(session.state, 'fhir_delivery_draft', {});
    } else if (outputType === 'delivery_readiness') {
      output = normalizeObjectState(session.state, 'delivery_readiness_state', {});
    } else if (outputType === 'session_export') {
      output = defaultSessionExport(session);
    } else {
      const error = new Error(`Unsupported output_type: ${outputType}`);
      error.status = 400;
      error.code = 'unsupported_output_type';
      throw error;
    }

    const response = {
      conversation_id: session.id,
      output_type: outputType,
      output,
      formatted_text: this.formatStructuredOutput(outputType, output),
      session_export: defaultSessionExport(session),
      metadata: {
        output_type: outputType,
        active_mode: session.state.active_mode,
        risk_flag: session.state.risk_flag,
        latest_tag_payload: normalizeObjectState(session.state, 'latest_tag_payload', {}),
        burden_level_state: normalizeObjectState(session.state, 'burden_level_state', {}),
        hamd_formal_assessment: normalizeObjectState(session.state, 'hamd_formal_assessment', {})
      }
    };

    session.output_cache[cacheKey] = {
      revision: session.revision,
      value: response
    };
    this.persistSessions();

    return response;
  }

  buildPromptContext(session, message, extraContext = {}) {
    const transcriptWindow = this.buildTranscriptWindow(session);
    return Object.assign(
      {
        sys: {
          query: message
        },
        conversation: session.state,
        retrieval: transcriptWindow
      },
      extraContext || {}
    );
  }

  buildDraftRelevantHistory(session) {
    return session.history.filter((item) => isDraftRelevantHistoryItem(item));
  }

  buildTranscriptWindow(session) {
    const relevantHistory = this.buildDraftRelevantHistory(session);
    const recentTurns = relevantHistory.slice(-MAX_RECENT_TRANSCRIPT_TURNS);
    const olderTurns = relevantHistory.slice(
      Math.max(0, relevantHistory.length - MAX_TRANSCRIPT_TURNS_FOR_RETRIEVAL),
      Math.max(0, relevantHistory.length - MAX_RECENT_TRANSCRIPT_TURNS)
    );

    return {
      total_relevant_turns: relevantHistory.length,
      recent_chat_history: recentTurns.map((item) => ({
        role: item.role,
        content: String(item.content || '').trim()
      })),
      recent_chat_history_text: recentTurns.map(formatTranscriptEntry).filter(Boolean).join('\n'),
      longitudinal_dialogue: olderTurns.map(formatTranscriptEntry).filter(Boolean).join('\n'),
      context_rule: 'Ignore mode-switch, command, and output-control turns. Treat only real chat content as clinical draft evidence.'
    };
  }

  buildHistory(session) {
    return this.buildDraftRelevantHistory(session).slice(-MAX_CHAT_HISTORY_FOR_MODEL);
  }

  async runTextTask(promptKey, session, message, options = {}) {
    const systemPrompt = interpolateTemplate(
      this.prompts[promptKey],
      this.buildPromptContext(session, message, options.extraContext)
    );
    const result = await this.modelClient(
      {
        systemPrompt,
        userPrompt: options.userPromptOverride || message,
        history: this.buildHistory(session),
        temperature: 0.2
      },
      {
        provider: options.provider || this.provider,
        apiKey: options.apiKey || this.apiKey,
        baseUrl: options.baseUrl || this.baseUrl,
        model: options.model || this.model,
        fetchImpl: options.fetchImpl || this.fetchImpl
      }
    );
    return String(result.text || '').trim();
  }

  async runJsonTask(promptKey, session, message, options = {}) {
    const text = await this.runTextTask(promptKey, session, message, Object.assign({}, options, {
      model: options.model || this.model,
      fetchImpl: options.fetchImpl || this.fetchImpl,
      userPromptOverride: options.userPromptOverride,
      apiKey: options.apiKey || this.apiKey,
      baseUrl: options.baseUrl || this.baseUrl,
      extraContext: options.extraContext
    ,}));
    const parsed = tryParseJson(text, null);
    return parsed || options.fallback || {};
  }

  async runClassifier(promptKey, session, message, allowedValues, fallback, options = {}) {
    const systemPrompt = interpolateTemplate(
      this.prompts[promptKey],
      this.buildPromptContext(session, message, options.extraContext)
    );
    const result = await this.modelClient(
      {
        systemPrompt,
        userPrompt: options.userPromptOverride || message,
        history: [],
        temperature: 0
      },
      {
        provider: options.provider || this.provider,
        apiKey: options.apiKey || this.apiKey,
        baseUrl: options.baseUrl || this.baseUrl,
        model: options.model || this.model,
        fetchImpl: options.fetchImpl || this.fetchImpl
      }
    );
    const normalized = String(result.text || '').trim();
    const matched = allowedValues.find((value) => normalized.includes(value));
    return matched || fallback;
  }
}

module.exports = {
  AICompanionEngine,
  createDefaultState,
  createSimpleRetriever,
  defaultSessionExport,
  tryParseJson
};

