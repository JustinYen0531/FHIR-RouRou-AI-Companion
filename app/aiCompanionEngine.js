const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { completeChat, DEFAULT_GROQ_MODEL, DEFAULT_OPENROUTER_MODEL, DEFAULT_GOOGLE_MODEL } = require('./llmChatClient');
const KnowYouMemory = require('./knowYouMemory');

const ROOT_DIR = path.join(__dirname, '..');
const STATE_SCHEMA_PATH = path.join(ROOT_DIR, 'ai_assets', 'AI_STATE_SCHEMA.json');
const PROMPTS_DIR = path.join(ROOT_DIR, 'ai_assets', 'prompts');
const RAG_DIR = path.join(__dirname, 'rag');
const RAG_TEXT_PATH = path.join(RAG_DIR, 'CompanionAI_RAG資料.txt');
const DEFAULT_AUTHOR = 'AI Companion Node Engine';
const MAX_CHAT_HISTORY_FOR_MODEL = 24;
const MAX_TRANSCRIPT_TURNS_FOR_RETRIEVAL = 40;
const MAX_RECENT_TRANSCRIPT_TURNS = 12;
const KNOW_YOU_TOKEN_LIMIT = KnowYouMemory.DEFAULT_CONTEXT_TOKEN_LIMIT;
const KNOW_YOU_RECENT_ITEMS = KnowYouMemory.DEFAULT_RECENT_HISTORY_ITEMS;

const PROMPT_FILES = {
  missionRetrievalAudit: '任務檢索稽核.md',
  riskStructurer: '風險結構化器.md',
  safetyResponse: '安全回應器.md',
  summaryDraftBuilder: '摘要草稿建構器.md',
  symptomBridgeBuilder: '症狀對接建構器.md',
  clinicianSummaryBuilder: '醫師摘要建構器.md',
  patientAnalysisBuilder: '病人分析建構器.md',
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
  clarifyQuestion: '釐清問題.md',
  conversationModeJudge: '對話三態判斷器.md',
  memoryCompressionBuilder: '肉肉認識你壓縮器.md'
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

const HAMD_PROGRESS_DIMENSIONS = Object.keys(HAMD_DIMENSION_TO_ITEM_CODES);

// Change 4: 從使用者說的話偵測提到哪些 dimension，讓選題優先對應語境
const DIMENSION_KEYWORD_PATTERNS = {
  depressed_mood: /(空虛|空掉|低落|沒有意義|沒意義|沮喪|難過|心情很差|情緒低落|憂鬱|提不起來|悶悶)/,
  guilt:          /(自責|內疚|罪惡感|怪自己|都是我的錯|愧疚)/,
  insomnia:       /(睡不好|睡不著|難入睡|早醒|半夜醒|失眠|睡眠不好|睡得很差)/,
  work_interest:  /(提不起勁|沒動力|不想做事|做不下去|懶得動|沒興趣|什麼都不想做)/,
  retardation:    /(做事變慢|思考慢|反應慢|動作遲緩|腦袋轉不動|說話慢|整個人慢)/,
  agitation:      /(坐不住|煩躁|靜不下來|一直動來動去|焦躁|待不住)/,
  somatic_anxiety:/(緊張|焦慮|心悸|胸悶|肌肉緊繃|頭痛|食慾|疲倦|很累|身體不舒服)/
};

function detectMentionedDimensions(userMessage) {
  if (!userMessage) return [];
  const dims = [];
  for (const [dim, pattern] of Object.entries(DIMENSION_KEYWORD_PATTERNS)) {
    if (pattern.test(userMessage)) dims.push(dim);
  }
  return dims;
}

// Change 5: 依 evidence 缺口決定 question_type，不照固定輪替
function getItemDataGap(item) {
  const evidence = normalizeArray(item.evidence_summary).join(' ');
  if (!evidence) return 'frequency';
  const hasFrequency = /一週|幾天|每天|偶爾|幾乎每天|大多數|天左右|幾乎天天|不常|很少/.test(evidence);
  const hasSeverity = /輕微|中等|嚴重|明顯|輕度|重度|很嚴重|有點嚴重|程度/.test(evidence);
  if (!hasFrequency) return 'frequency';
  if (!hasSeverity) return 'severity';
  return null;
}

const HAMD_DIMENSION_LABELS_ZH = {
  depressed_mood: '情緒低落',
  guilt: '自責或罪惡感',
  work_interest: '工作或興趣下降',
  retardation: '思考或動作變慢',
  agitation: '坐立難安或煩躁',
  somatic_anxiety: '焦慮與身體緊繃',
  insomnia: '睡眠困擾'
};

const FHIR_RESOURCE_DEFINITIONS = {
  Patient: { resource_type: 'Patient', resourceType: 'Patient', display: 'Patient / Subject Of Care', status: 'preliminary', purpose: 'subject_identity' },
  Encounter: { resource_type: 'Encounter', resourceType: 'Encounter', display: 'Encounter / Conversation Session', status: 'preliminary', purpose: 'session_context' },
  QuestionnaireResponse: { resource_type: 'QuestionnaireResponse', resourceType: 'QuestionnaireResponse', display: 'QuestionnaireResponse / Dialogue Mapping', status: 'preliminary', purpose: 'dialogue_to_scale_mapping' },
  Observation: { resource_type: 'Observation', resourceType: 'Observation', display: 'Observation / Symptom Tracking', status: 'preliminary', purpose: 'symptom_tracking' },
  ClinicalImpression: { resource_type: 'ClinicalImpression', resourceType: 'ClinicalImpression', display: 'ClinicalImpression / Risk And Context', status: 'preliminary', purpose: 'risk_and_context' },
  Composition: { resource_type: 'Composition', resourceType: 'Composition', display: 'Composition / Clinical Summary', status: 'preliminary', purpose: 'clinical_summary' },
  DocumentReference: { resource_type: 'DocumentReference', resourceType: 'DocumentReference', display: 'DocumentReference / Summary Export', status: 'preliminary', purpose: 'summary_export' },
  Provenance: { resource_type: 'Provenance', resourceType: 'Provenance', display: 'Provenance / Draft Traceability', status: 'preliminary', purpose: 'generation_traceability' }
};

function buildControlledFhirResourceList(options = {}) {
  return [
    FHIR_RESOURCE_DEFINITIONS.Patient,
    FHIR_RESOURCE_DEFINITIONS.Encounter,
    options.includeQuestionnaire ? FHIR_RESOURCE_DEFINITIONS.QuestionnaireResponse : null,
    options.includeObservation ? FHIR_RESOURCE_DEFINITIONS.Observation : null,
    options.includeClinicalImpression ? FHIR_RESOURCE_DEFINITIONS.ClinicalImpression : null,
    FHIR_RESOURCE_DEFINITIONS.Composition,
    options.includeDocumentReference ? FHIR_RESOURCE_DEFINITIONS.DocumentReference : null,
    FHIR_RESOURCE_DEFINITIONS.Provenance
  ].filter(Boolean).map((item) => Object.assign({}, item));
}

function humanizeHamdDimension(value = '') {
  const key = String(value || '').trim();
  return HAMD_DIMENSION_LABELS_ZH[key] || key;
}

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
  /沒必要活著/,
  /不如死/,
  /suicide/i,
  /kill myself/i
  // 已移除：想消失、如果消失就好了（語意模糊，改由 SOFT 多重命中才觸發）
];

const OUTPUT_COMMAND_PATTERNS = [
  { type: 'clinician_summary', patterns: [/幫我整理給醫生/, /整理給醫師/, /整理成.*給醫(師|生).*(重點|摘要|版本)?/i, /醫師摘要/, /clinician summary/i, /doctor summary/i] },
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

const MODE_SWITCH_PATTERNS = [
  /切回.*auto/i,
  /切換到.*(auto|void|soulmate|mission|option|natural|clarify)/i,
  /^mode[:：]/i,
  /模式$/i
];

const OUTPUT_CONTROL_PATTERNS = [
  /^output:/i,
  /請幫我.*(生成|產生|準備).*(fhir|草稿|摘要)/i,
  /幫我整理給醫(師|生)/i,
  /整理成.*給醫(師|生).*(重點|摘要|版本)?/i,
  /病人審閱稿/i,
  /授權狀態/i,
  /session export/i,
  /準備授權預覽/i,
  /fhir draft/i
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueStrings(values = [], limit = 8) {
  const result = [];
  normalizeArray(values).forEach((value) => {
    const text = String(value || '').trim();
    if (!text || result.includes(text) || result.length >= limit) return;
    result.push(text);
  });
  return result;
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

function normalizePhq9Score(value) {
  return Math.max(0, Math.min(3, Number.isFinite(Number(value)) ? Number(value) : 0));
}

function normalizePhq9Assessment(assessment) {
  const base = assessment && typeof assessment === 'object' ? assessment : {};
  const answers = Array.isArray(base.answers)
    ? base.answers.map((item) => ({
        index: Number.isFinite(Number(item && item.index)) ? Number(item.index) : 0,
        questionId: String(item?.questionId || item?.question_id || item?.itemCode || item?.item_code || '').trim(),
        label: String(item?.label || item?.item_label || '').trim(),
        score: normalizePhq9Score(item?.score),
        narrative: String(item && item.narrative ? item.narrative : '').trim()
      }))
    : [];
  const answerTotalScore = answers.reduce((sum, answer) => sum + normalizePhq9Score(answer.score), 0);
  const explicitTotalScore = Math.max(0, Math.min(27, Number.isFinite(Number(base.totalScore)) ? Number(base.totalScore) : 0));
  const totalScore = Math.max(answerTotalScore, explicitTotalScore);

  return {
    version: typeof base.version === 'string' && base.version.trim() ? base.version.trim() : 'PHQ-9',
    totalScore,
    severityBand: typeof base.severityBand === 'string' ? base.severityBand : '',
    completedAt: typeof base.completedAt === 'string' ? base.completedAt : '',
    updatedAt: typeof base.updatedAt === 'string' ? base.updatedAt : '',
    note: typeof base.note === 'string' ? base.note : '',
    answers
  };
}

function buildPhq9SeverityBand(totalScore = 0) {
  const score = Math.max(0, Math.min(27, Number(totalScore) || 0));
  if (score <= 4) return { label: 'minimal', zhLabel: '極輕微', color: 'low' };
  if (score <= 9) return { label: 'mild', zhLabel: '輕度', color: 'soft' };
  if (score <= 14) return { label: 'moderate', zhLabel: '中度', color: 'mid' };
  if (score <= 19) return { label: 'moderately-severe', zhLabel: '中重度', color: 'strong' };
  return { label: 'severe', zhLabel: '重度', color: 'critical' };
}

function buildPhq9AssessmentSummary(assessment) {
  const normalized = normalizePhq9Assessment(assessment);
  const severity = buildPhq9SeverityBand(normalized.totalScore);
  const hasAssessment = Boolean(
    normalized.completedAt
    || normalized.updatedAt
    || normalized.note
    || normalized.answers.length
  );
  const answeredAnswers = normalized.answers.filter((answer) => Number.isFinite(Number(answer.score)));
  const narrativeAnswers = normalized.answers.filter((answer) => String(answer.narrative || '').trim().length > 0);
  return {
    phq9_assessment: normalized,
    phq9_total_score: normalized.totalScore,
    phq9_severity_band: hasAssessment ? severity.label : '',
    phq9_severity_label: hasAssessment ? severity.zhLabel : '',
    phq9_summary: hasAssessment ? `PHQ-9 ${normalized.totalScore}/27（${severity.zhLabel}）` : '',
    phq9_completed_at: hasAssessment ? (normalized.completedAt || normalized.updatedAt || '') : '',
    phq9_answer_count: hasAssessment ? answeredAnswers.length : 0,
    phq9_narrative_count: hasAssessment ? narrativeAnswers.length : 0,
    phq9_answers: hasAssessment ? normalized.answers.map((answer, index) => ({
      item_code: answer.questionId || `phq9_${index + 1}`,
      item_label: answer.label,
      score: answer.score,
      narrative: answer.narrative
    })) : [],
    phq9_questionnaire_targets: hasAssessment ? normalized.answers.map((answer, index) => ({
      item_code: answer.questionId || `phq9_${index + 1}`,
      item_label: answer.label,
      score: answer.score,
      narrative: answer.narrative,
      status: 'preliminary'
    })) : []
  };
}

function hasMeaningfulPhq9Assessment(assessment) {
  const normalized = normalizePhq9Assessment(assessment);
  return Boolean(
    normalized.completedAt
    || normalized.updatedAt
    || normalized.note
    || normalized.answers.some((answer) => Number(answer.score) > 0 || String(answer.narrative || '').trim())
  );
}

function normalizeTherapeuticProfile(profile, fallbackUser = '') {
  const normalized = KnowYouMemory.normalizeTherapeuticProfile(profile);
  normalized.userId = typeof normalized.userId === 'string' && normalized.userId.trim()
    ? normalized.userId.trim()
    : String(fallbackUser || '').trim();
  normalized.version = typeof normalized.version === 'string' && normalized.version.trim()
    ? normalized.version.trim()
    : '1.0';
  normalized.stressors = normalizeArray(normalized.stressors).map((item) => typeof item === 'string' ? { label: item } : item).filter((item) => item && item.label);
  normalized.triggers = normalizeArray(normalized.triggers).map((item) => typeof item === 'string' ? { keyword: item } : item).filter((item) => item && item.keyword);
  normalized.copingProfile = normalized.copingProfile && typeof normalized.copingProfile === 'object'
    ? {
        preferredStyle: typeof normalized.copingProfile.preferredStyle === 'string' ? normalized.copingProfile.preferredStyle : '',
        effectiveMethods: normalizeArray(normalized.copingProfile.effectiveMethods),
        ineffectiveMethods: normalizeArray(normalized.copingProfile.ineffectiveMethods)
      }
    : { preferredStyle: '', effectiveMethods: [], ineffectiveMethods: [] };
  normalized.positiveAnchors = normalizeArray(normalized.positiveAnchors).map((item) => typeof item === 'string' ? { label: item, category: 'other' } : item).filter((item) => item && item.label);
  normalized.emotionalBaseline = normalized.emotionalBaseline && typeof normalized.emotionalBaseline === 'object'
    ? {
        dominantMood: typeof normalized.emotionalBaseline.dominantMood === 'string' ? normalized.emotionalBaseline.dominantMood : '',
        phq9Trend: normalizeArray(normalized.emotionalBaseline.phq9Trend),
        hamdSignalCount: Number.isFinite(Number(normalized.emotionalBaseline.hamdSignalCount)) ? Number(normalized.emotionalBaseline.hamdSignalCount) : 0
      }
    : { dominantMood: '', phq9Trend: [], hamdSignalCount: 0 };
  normalized.keyThemes = normalizeArray(normalized.keyThemes);
  normalized.clinicianNotes = typeof normalized.clinicianNotes === 'string' ? normalized.clinicianNotes : '';
  normalized.memoryChunks = Array.isArray(normalized.memoryChunks) ? normalized.memoryChunks : [];
  normalized.memoryStats = KnowYouMemory.normalizeMemoryStats(normalized.memoryStats);
  return normalized;
}

function normalizePatientProfile(profile = {}) {
  const base = profile && typeof profile === 'object' ? profile : {};
  const key = sanitizePatientKey(
    base.key
    || base.profileKey
    || base.identifier
    || base.patient_key
  );
  const name = sanitizePatientDisplayName(base.name || base.display_name || base.displayName);
  const gender = normalizePatientAdministrativeGender(base.gender);
  const birthDate = normalizePatientBirthDate(base.birthDate || base.birth_date);
  const phone = String(base.phone || '').trim();
  const email = String(base.email || '').trim();
  const emergencyName = sanitizePatientDisplayName(base.emergencyName || base.emergency_name);
  const emergencyPhone = String(base.emergencyPhone || base.emergency_phone || '').trim();
  const telecom = [
    phone ? { system: 'phone', value: phone, use: 'mobile' } : null,
    email ? { system: 'email', value: email, use: 'home' } : null
  ].filter(Boolean);
  const contact = (emergencyName || emergencyPhone)
    ? [{
        relationship: [{ text: 'Emergency contact' }],
        name: emergencyName ? { text: emergencyName } : undefined,
        telecom: emergencyPhone
          ? [{
              system: 'phone',
              value: emergencyPhone,
              use: 'mobile'
            }]
          : undefined
      }]
    : [];

  return {
    profileKey: key,
    key,
    name,
    gender,
    birthDate,
    phone,
    email,
    emergencyName,
    emergencyPhone,
    telecom,
    contact
  };
}

function pickFirstPatientField(candidates) {
  for (const candidate of candidates) {
    const value = typeof candidate?.value === 'string' ? candidate.value.trim() : '';
    if (!value) continue;
    return {
      value,
      source: candidate.source || ''
    };
  }

  return {
    value: '',
    source: ''
  };
}

function sanitizePatientKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function looksLikePlaceholderIdentity(value) {
  const text = String(value || '').trim();
  if (!text) return true;

  const lowered = text.toLowerCase();
  if (
    lowered === 'demo' ||
    lowered === 'demo user' ||
    lowered === 'demo-user' ||
    lowered === 'web-demo-user' ||
    lowered === 'test patient' ||
    lowered === 'anonymous patient' ||
    lowered === 'patient' ||
    lowered === 'user'
  ) {
    return true;
  }

  if (/^(demo|test|user|patient)[-_ ]?\d*$/i.test(text)) {
    return true;
  }

  if (/^[a-z0-9._-]+$/i.test(text) && !/\s/.test(text) && !/[\u3400-\u9fff]/.test(text)) {
    return true;
  }

  return false;
}

function sanitizePatientDisplayName(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text || looksLikePlaceholderIdentity(text)) {
    return '';
  }
  return text.slice(0, 80);
}

function normalizePatientAdministrativeGender(value) {
  const text = String(value || '').trim().toLowerCase();
  return ['male', 'female', 'other', 'unknown'].includes(text) ? text : '';
}

function normalizePatientBirthDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function buildAnonymousPatientKey(session, explicitSeed = '') {
  const seed = explicitSeed || session?.user || session?.id || 'session';
  const digest = crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 12);
  return `anon-${digest}`;
}

function buildPatientDraft(session) {
  const state = session && session.state && typeof session.state === 'object' ? session.state : {};
  const statePatient = state.patient_profile && typeof state.patient_profile === 'object'
    ? normalizePatientProfile(state.patient_profile)
    : (state.patient && typeof state.patient === 'object' ? state.patient : {});
  const therapeuticProfile = state.therapeutic_profile && typeof state.therapeutic_profile === 'object'
    ? state.therapeutic_profile
    : {};
  const therapeuticPatient = therapeuticProfile.patient && typeof therapeuticProfile.patient === 'object'
    ? therapeuticProfile.patient
    : {};

  const nameField = pickFirstPatientField([
    { value: statePatient.name, source: 'patient_profile.name' },
    { value: statePatient.display_name, source: 'patient_profile.display_name' },
    { value: statePatient.displayName, source: 'patient_profile.displayName' },
    { value: therapeuticPatient.name, source: 'therapeutic_profile.patient.name' },
    { value: therapeuticPatient.display_name, source: 'therapeutic_profile.patient.display_name' },
    { value: therapeuticProfile.patient_name, source: 'therapeutic_profile.patient_name' },
    { value: therapeuticProfile.patientName, source: 'therapeutic_profile.patientName' },
    { value: session?.user, source: 'session.user' }
  ]);
  const keyField = pickFirstPatientField([
    { value: statePatient.key, source: 'patient_profile.key' },
    { value: statePatient.profileKey, source: 'patient_profile.profileKey' },
    { value: statePatient.identifier, source: 'patient_profile.identifier' },
    { value: statePatient.patient_key, source: 'patient_profile.patient_key' },
    { value: therapeuticPatient.key, source: 'therapeutic_profile.patient.key' },
    { value: therapeuticProfile.patient_key, source: 'therapeutic_profile.patient_key' }
  ]);
  const genderField = pickFirstPatientField([
    { value: statePatient.gender, source: 'patient_profile.gender' },
    { value: therapeuticPatient.gender, source: 'therapeutic_profile.patient.gender' },
    { value: therapeuticProfile.gender, source: 'therapeutic_profile.gender' }
  ]);
  const birthDateField = pickFirstPatientField([
    { value: statePatient.birthDate, source: 'patient_profile.birthDate' },
    { value: statePatient.birth_date, source: 'patient_profile.birth_date' },
    { value: therapeuticPatient.birthDate, source: 'therapeutic_profile.patient.birthDate' },
    { value: therapeuticProfile.birthDate, source: 'therapeutic_profile.birthDate' }
  ]);

  const name = sanitizePatientDisplayName(nameField.value);
  const gender = normalizePatientAdministrativeGender(genderField.value);
  const birthDate = normalizePatientBirthDate(birthDateField.value);
  const sanitizedExplicitKey = sanitizePatientKey(keyField.value);
  const fallbackKeySeed = sanitizedExplicitKey || sanitizePatientKey(name) || session?.id || session?.user || 'session';
  const key = sanitizedExplicitKey || buildAnonymousPatientKey(session, fallbackKeySeed);
  const demographicsStatus = gender && birthDate
    ? 'basic_demographics_present'
    : (gender || birthDate ? 'partial_demographics_present' : 'anonymous_minimal');

  const patient = {
    key,
    name: name || 'Anonymous Patient',
    identity_strategy: name ? 'provided_identity' : 'anonymous_default',
    name_source: name ? nameField.source : 'anonymous_default',
    demographics_status: demographicsStatus
  };

  if (gender) {
    patient.gender = gender;
  }

  if (birthDate) {
    patient.birthDate = birthDate;
  }

  if (statePatient.phone) {
    patient.phone = statePatient.phone;
  }

  if (statePatient.email) {
    patient.email = statePatient.email;
  }

  if (statePatient.emergencyName) {
    patient.emergencyName = statePatient.emergencyName;
  }

  if (statePatient.emergencyPhone) {
    patient.emergencyPhone = statePatient.emergencyPhone;
  }

  if (Array.isArray(statePatient.telecom) && statePatient.telecom.length) {
    patient.telecom = statePatient.telecom.map((item) => Object.assign({}, item));
  }

  if (Array.isArray(statePatient.contact) && statePatient.contact.length) {
    patient.contact = statePatient.contact.map((item) => Object.assign({}, item));
  }

  return patient;
}

function defaultSessionExport(session) {
  return {
    patient: buildPatientDraft(session),
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
    symptom_bridge_state: normalizeObjectState(session.state, 'symptom_bridge_state', {}),
    patient_profile: normalizeObjectState(session.state, 'patient_profile', {}),
    therapeutic_profile: normalizeObjectState(session.state, 'therapeutic_profile', normalizeTherapeuticProfile({}, session.user)),
    phq9_assessment: normalizePhq9Assessment(normalizeObjectState(session.state, 'phq9_assessment', {}))
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
    pending_probe_meta: null,
    items: HAMD_FORMAL_ITEMS.map((item) => ({
      item_code: item.item_code,
      item_label: item.item_label,
      scale_range: item.scale_range,
      evidence_type: 'none',
      direct_answer_value: null,
      ai_suggested_score: null,
      clinician_final_score: null,
      user_self_rating: null,
      evidence_summary: [],
      rating_rationale: '',
      confidence: 'low',
      review_required: item.preferred_evidence === 'indirect_observation',
      probe_count: 0,
      completion_announced: false
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
  base.pending_probe_meta = current.pending_probe_meta || null;
  base.ai_total_score = typeof current.ai_total_score === 'number' ? current.ai_total_score : 0;
  base.clinician_total_score = typeof current.clinician_total_score === 'number' ? current.clinician_total_score : null;
  base.severity_band = current.severity_band || base.severity_band;
  base.review_flags = normalizeArray(current.review_flags);
  base.rated_by = current.rated_by || '';
  base.reviewed_at = current.reviewed_at || '';
  base.items = HAMD_FORMAL_ITEMS.map((item) => {
    const saved = itemMap[item.item_code] || {};
    const merged = Object.assign({}, base.items.find((entry) => entry.item_code === item.item_code), saved);
    if (saved.user_self_rating !== undefined) merged.user_self_rating = saved.user_self_rating;
    return merged;
  });
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

function computeHamdItemLockState(progressItems, formalItems) {
  const lockState = {};
  // LLM progress complete 只作為參考，不單獨觸發鎖定
  // （保留 progressItems 掃描以備未來擴充，但不寫入 locked）

  normalizeArray(formalItems).forEach((item) => {
    const code = String(item.item_code || '').trim();
    if (!code || lockState[code] === 'locked') return;
    const hasEvidence = normalizeArray(item.evidence_summary).length > 0;
    const hasScore = item.ai_suggested_score != null;
    const hasSlider = item.user_self_rating != null
      && item.user_self_rating.source === 'slider'
      && item.user_self_rating.value != null;
    // 真正鎖定：有 evidence 且有 AI 評分，或有滑桿自評 + 文字證據
    if ((hasEvidence && hasScore) || (hasSlider && hasEvidence)) {
      lockState[code] = 'locked';
      return;
    }
    // 暫時跳過：問了 1 次仍沒有 evidence → skipped（不是永久鎖，低優先補問）
    if ((item.probe_count || 0) >= 1 && !hasEvidence) {
      lockState[code] = 'skipped';
    }
  });
  return lockState;
}

function getLockedItemCodes(state) {
  const lockState = normalizeObjectState(state, 'hamd_item_lock_state', {});
  return Object.keys(lockState).filter((code) => lockState[code] === 'locked');
}

function getSkippedItemCodes(state) {
  const lockState = normalizeObjectState(state, 'hamd_item_lock_state', {});
  return Object.keys(lockState).filter((code) => lockState[code] === 'skipped');
}

// ── 問題類型鎖（Question Type Lock） ──────────────────────────────────────
const ALLOWED_QUESTION_TYPES = ['frequency', 'severity', 'functional_impact'];

// 第 1 層：中段安慰／正常化句型 → 命中只刪除該句，不重生整段
const BAD_COMFORT_PATTERNS = [
  /你並不孤單[^。\n]*。?/g,
  /你的感受(是|都)?(很)?真實[^。\n]*。?/g,
  /(這|你的感受)?並?不是(你)?(太)?誇張[^。\n]*。?/g,
  /很多人(也)?會?有[^。\n]*。?/g,
  /大家(可能)?(也)?都(差不多|一樣|有(這)?類似)[^。\n]*。?/g,
  /每個人都有不同的掙扎[^。\n]*。?/g,
  /每個人都會[^。\n]*?(難|累|低落|有這)[^。\n]*。?/g,
  /這(是|也是)?很常見的?[^。\n]*。?/g,
  /你不用擔心[^。\n]*。?/g,
  /你已經很棒[^。\n]*。?/g,
  /你願意[^。\n]{0,30}(就)?(已經)?很不容易[^。\n]*。?/g,
  /(你的)?感受(是|都)?(很)?重要[^。\n]*。?/g,
  // ── 建議式陳述句（不管在哪個位置都要移除）──
  /或許(你)?可以試著[^。\n]*。?/g,
  /可以試著[^。\n]*。?/g,
  /試著(把|將|用|做)[^。\n]*。?/g,
  /不妨試試[^。\n]*。?/g,
  /不妨(先|從)[^。\n]*。?/g,
  /你可以(先|從|試|嘗試)[^。\n]*。?/g,
  /你也可以[^。\n]*。?/g,
  /建議(你|先)[^。\n]*。?/g,
  /把.{2,10}分成小?步驟[^。\n]*。?/g,
  /分解成小?步驟[^。\n]*。?/g,
  /先從小?一步開始[^。\n]*。?/g,
  /面對[^。\n]{0,20}挑戰[^。\n]*。?/g
];

// 繞題防護閾值
const MAX_TURNS_PER_ITEM = 3;       // 同一題累計被問 3 次 → 暫列為過多，排除
const MAX_CONSECUTIVE_SAME_ITEM = 2; // 連續 2 輪問同一題 → 強制切換

// 第 2 層：最後一句問句的非法句型 → 命中替換成 formal_probe / emergencyProbe
const BAD_QUESTION_PATTERNS = [
  // coping
  /怎麼處理/,
  /怎麼應對/,
  /怎麼調適/,
  /有試著做/,
  /試著做(些)?什麼/,
  /有沒有.*試/,
  /打算怎麼做/,
  // 建議 / advice
  /你可以試試/,
  /要不要試試/,
  /你有想過怎麼/,
  /建議你/,
  /可以嘗試/,
  /可以做.{0,6}什麼/,
  // 開放反思
  /你怎麼看/,
  /覺得原因是什麼/,
  /原因是什麼/,
  /你覺得.{0,8}原因/,
  /想不想.{0,4}(分享|聊|說|談|講)/,
  /要不要.{0,4}(分享|聊|說|談|講)/,
  /願不願意.{0,4}(分享|聊|說)/,
  /分享更多/,
  /多說.{0,4}一些/,
  /多聊.{0,4}一些/,
  /多.{0,2}聽聽你/,
  /什麼.{0,8}事情.{0,8}讓你/,
  /什麼.{0,8}讓你(感到|覺得|有這種|變成|這樣)/,
  /讓你感到這樣/,
  /讓你變成這樣/,
  /有.{0,4}特別.{0,6}(事|事情|原因|觸發)/,
  /是什麼.{0,6}讓你/,
  /是不是.{0,8}(發生|觸發|讓你)/,
  /可以.{0,4}多說/,
  /可以.{0,4}聊聊/,
  // 舒緩導向
  /有沒有什麼方法/,
  /有什麼.{0,4}方法/,
  /什麼.{0,4}小?方法/,
  /讓你(稍微)?(感到|覺得).{0,4}(好|舒服|輕鬆)/,
  /讓你.{0,6}好一點/,
  /幫(助)?你(減輕|緩解|放鬆|舒緩)/,
  /讓自己(好|舒服|放鬆|輕鬆)/,
  /可以.{0,6}(減輕|緩解)/,
  /什麼.{0,6}(能|可以)讓你/,
  // 泛問
  /感覺如何[？?]?\s*$/,
  /還好嗎[？?]?\s*$/,
  /你覺得怎麼樣[？?]?\s*$/,
  /你覺得如何[？?]?\s*$/,
  /覺得好(一點)?嗎[？?]?\s*$/,
  /這樣會不會讓你[^？\n]*[？?]\s*$/,
  /你有沒有試過[^？\n]*[？?]\s*$/,
  /幫助(到)?你嗎[？?]?\s*$/
];

// 太空泛的 functional_impact：問句含「影響」但沒指名具體領域
const FUNCTIONAL_DOMAIN_KEYWORDS = [
  '工作', '上班', '上課', '上學', '讀書', '念書',
  '睡眠', '睡覺', '入睡',
  '吃飯', '食慾', '胃口',
  '社交', '朋友', '家人', '同事', '同學',
  '出門',
  '完成', '任務', '事情'
];

// 第 3 層：使用者輸入中的風險訊號 → 下一輪強制改走 risk probe
// 分兩層：HARD（單獨命中即觸發）/ SOFT（要 2+ 命中或 1+ 低能量）
// 注意：此處的 HARD_RISK_PATTERNS 與檔頭的 HIGH_RISK_PATTERNS（safety 路由用）獨立
const HARD_RISK_PATTERNS = [
  /想死/,
  /想自殺/,
  /自殺/,
  /不想活/,
  /活不下去/,
  /結束(自己|一切|生命)/,
  /不如死/,
  /傷害自己/,
  /自殘/,
  /了結(自己|生命)/
];

const SOFT_RISK_PATTERNS = [
  /沒(有)?意義/,
  /想消失/,
  /消失就好/,
  /不想醒來/,
  /撐不下去/,
  /撐不住/,
  /活著.{0,6}(累|沒.{0,2}意思)/,
  /死掉/  // 「死掉」太模糊（如「想死掉算了」 vs「我家狗死掉」），歸 soft
];

// 具體可量化症狀關鍵詞：若使用者本輪也提到這些，soft risk 先讓位
const CONCRETE_SYMPTOM_PATTERNS = [
  /睡(不好|不著)/,
  /失眠/,
  /(早|半夜)醒/,
  /躺.{0,4}很久/,
  /疲倦|疲憊|很累|沒力氣|提不起勁/,
  /(食慾|胃口|吃不下)/,
  /(注意力|專心|分心|恍神)/,
  /(體重|食量).{0,4}(下降|變少)/
];

const RISK_PROBE = {
  item_code: 'suicide',
  item_label: '自殺意念',
  question_type: 'severity',
  probe_question: '我想確認一件重要的事：當這種「沒有意義」「不想繼續」的感覺出現時，你有沒有想過傷害自己，或是不想繼續活下去？',
  reason: 'risk_signal_priority'
};

function userFacingEvidenceSummary(item) {
  const evidence = normalizeArray(item && item.evidence_summary);
  if (!evidence.length) return '';
  return evidence
    .slice(0, 2)
    .map((e) => String(e || '')
      .replace(/^病人(描述|提到|表達|表示|反映|呈現|有時|常常)?/, '')
      .replace(/[，,。]?\s*$/, '')
      .trim())
    .filter(Boolean)
    .join('；');
}

function stripComfortPhrases(text) {
  let out = String(text || '');
  for (const pat of BAD_COMFORT_PATTERNS) {
    out = out.replace(pat, '');
  }
  // 收斂多餘空白與斷行
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function detectRiskSignal(text, state) {
  const t = String(text || '');
  if (!t) return false;
  // 規則 0：HARD risk 單獨命中即觸發
  if (HARD_RISK_PATTERNS.some((p) => p.test(t))) return true;
  // 計算 SOFT risk 命中數
  const softCount = SOFT_RISK_PATTERNS.filter((p) => p.test(t)).length;
  if (softCount === 0) return false;
  // 規則 A：SOFT 命中 3+ 個才觸發（門檻由 2 提高至 3，減少日常表達誤觸）
  if (softCount >= 3) return true;
  // 規則 B 已移除（SOFT 1 個 + burden=high 自動觸發 → 誤報率太高）
  return false;
}

function isVagueFunctionalImpact(question) {
  const q = String(question || '');
  if (!/影響/.test(q)) return false;
  return !FUNCTIONAL_DOMAIN_KEYWORDS.some((kw) => q.includes(kw));
}

function isInvalidQuestionEnding(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return false;
  const tail = trimmed.split(/[。\n]/).filter(Boolean).slice(-3).join('');
  if (BAD_QUESTION_PATTERNS.some((pattern) => pattern.test(tail))) return true;
  // 太空泛的 functional_impact 也視為非法
  const lastQ = extractLastQuestion(trimmed);
  if (lastQ && isVagueFunctionalImpact(lastQ.question)) return true;
  return false;
}

// ── 回答後處理器（Answer Post-Processor）────────────────────────────────────
function extractLastQuestion(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  // 用句尾標點（。！？）切句，但保留標點在句尾
  const segments = t
    .split(/(?<=[。！？?！\n])/)
    .map((s) => s.trim())
    .filter(Boolean);
  // 從後往前找第一個含問號的完整句段
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/[？?]/.test(segments[i])) {
      return {
        before: segments.slice(0, i).join('').trim(),
        question: segments[i].trim()
      };
    }
  }
  return null;
}

function pickEmergencyProbe(state, userMessage = '', extraExcludeCodes = []) {
  const lockedCodes = getLockedItemCodes(state);
  const skippedCodes = getSkippedItemCodes(state);
  // 過多探針的題項也暫時排除（繞題防護）
  const overProbedCodes = Object.entries((state && state.hamd_item_turn_counts) || {})
    .filter(([, count]) => Number(count) >= MAX_TURNS_PER_ITEM)
    .map(([code]) => code);
  const excludedCodes = [...new Set([...lockedCodes, ...skippedCodes, ...overProbedCodes, ...extraExcludeCodes])];
  const assessment = hydrateFormalAssessment(state.hamd_formal_assessment);
  const progress = normalizeObjectState(state, 'hamd_progress_state', {});

  // 動態 dimension 順序：使用者提到的症狀 → next_recommended → 全部
  const mentionedDims = detectMentionedDimensions(userMessage);
  const dimOrder = [...mentionedDims];
  if (progress.next_recommended_dimension && !dimOrder.includes(progress.next_recommended_dimension)) {
    dimOrder.push(progress.next_recommended_dimension);
  }
  HAMD_PROGRESS_DIMENSIONS.forEach((d) => { if (!dimOrder.includes(d)) dimOrder.push(d); });

  // Pass 1: 優先選無 evidence 的未鎖/未跳過題
  for (const dim of dimOrder) {
    for (const code of (HAMD_DIMENSION_TO_ITEM_CODES[dim] || [])) {
      if (excludedCodes.includes(code)) continue;
      const item = assessment.items.find((i) => i.item_code === code);
      const def = HAMD_FORMAL_ITEM_MAP[code];
      if (!item || !def) continue;
      if (!item.evidence_summary.length || item.review_required) {
        const variants = ITEM_PROBE_TEXTS[code];
        return {
          item_code: code,
          item_label: def.item_label,
          question_type: getItemDataGap(item) || 'frequency',
          probe_question: (variants && variants[0]) ? variants[0] : def.probe_question,
          reason: 'emergency_fallback'
        };
      }
    }
  }

  // Pass 2: 都有部分 evidence，選缺 severity/frequency 的那個
  for (const dim of dimOrder) {
    for (const code of (HAMD_DIMENSION_TO_ITEM_CODES[dim] || [])) {
      if (excludedCodes.includes(code)) continue;
      const item = assessment.items.find((i) => i.item_code === code);
      const def = HAMD_FORMAL_ITEM_MAP[code];
      if (!def) continue;
      const gap = item ? getItemDataGap(item) : 'frequency';
      if (gap) {
        return {
          item_code: code,
          item_label: def.item_label,
          question_type: gap,
          probe_question: def.probe_question,
          reason: 'emergency_fallback_fill_gap'
        };
      }
    }
  }

  // Pass 3 (最後手段): 所有題都 locked/skipped，從 skipped 補問
  for (const code of skippedCodes) {
    const def = HAMD_FORMAL_ITEM_MAP[code];
    if (!def) continue;
    const item = assessment.items.find((i) => i.item_code === code);
    return {
      item_code: code,
      item_label: def.item_label,
      question_type: getItemDataGap(item || {}) || 'frequency',
      probe_question: def.probe_question,
      reason: 'emergency_fallback_skipped_retry'
    };
  }

  return null;
}

// ── 正向可評分檢查（Scoreable Question Enforcement）─────────────────────────
// 不是抓錯，而是檢查最後一句「有沒有真的包含 HAM-D 可用訊號」
const SCOREABLE_PATTERNS = [
  // 頻率
  /一週.{0,6}幾天/,
  /幾乎每天/,
  /偶爾/,
  /每天/,
  /每週/,
  /幾天/,
  /幾次/,
  // 持續時間
  /持續.{0,6}多久/,
  /多久了/,
  /幾(週|個月|個禮拜|星期)/,
  // 程度
  /輕微/,
  /明顯/,
  /嚴重/,
  /撐得?住/,
  /撐不住/,
  /很(難受|不舒服|累)/,
  /比.{0,4}以前(差|嚴重)/,
  // 功能影響（必須含具體領域字）
  /影響.{0,10}(工作|上班|上課|上學|讀書|念書|睡眠|睡覺|入睡|吃飯|食慾|胃口|社交|朋友|家人|同事|同學|出門|完成|任務|事情)/
];

// 對應 HAM-D 17 個面向，每條兩個變種探針，隨機抽一個避免重複感
const SYMPTOM_TO_PROBE = [
  // 1. 憂鬱情緒
  { pattern: /(空虛|空掉|低落|沒有意義|沒意義|沮喪|難過|心情很差|情緒低落)/, probes: [
    '最近這種空掉或低落的感覺，是幾乎每天都有，還是偶爾才會出現？',
    '這一週心情低落或空洞的感覺，是每天幾乎都這樣，還是偶爾才有？'
  ]},
  // 2. 有罪感
  { pattern: /(自責|內疚|罪惡感|怪自己|都是我的錯|愧疚|對不起大家)/, probes: [
    '這種自責的感覺，大概一週會出現幾天？',
    '最近一直覺得哪裡做錯或怪自己，這種感覺一週大約有幾天？'
  ]},
  // 3. 自殺意念
  { pattern: /(不想活|想消失|想死|了結|結束一切|活著沒意義|輕生|不如死)/, probes: [
    '這一週有沒有出現過不想活、想消失，或覺得活著沒有意義的念頭？',
    '這週有沒有冒出過想消失、不想繼續，或覺得活著很累的念頭？'
  ]},
  // 4. 入睡困難
  { pattern: /(睡不著|難以?入睡|躺很久睡不著|怎樣都睡不著|睡前一直醒著)/, probes: [
    '最近睡前難入睡的情況，大概一週會有幾天？',
    '最近要花多久才睡得著？這種情況一週大概幾天會發生？'
  ]},
  // 5. 睡眠中斷
  { pattern: /(半夜醒|睡到一半醒|中途一直醒|睡睡醒醒|睡不深)/, probes: [
    '最近半夜醒來的情況，是偶爾還是幾乎每天都發生？',
    '最近睡到一半醒來的狀況，大概一週有幾天？'
  ]},
  // 6. 早醒
  { pattern: /(早醒|很早就醒|比平常早醒|醒太早|天還沒亮就醒)/, probes: [
    '最近早醒之後就睡不回去的情況，大概一週會有幾天？',
    '最近有沒有常常比預計早醒，而且醒了就再也睡不回去？'
  ]},
  // 7. 工作與活動
  { pattern: /(提不起勁|沒動力|不想做事|做不下去|懶得動|沒興趣做|什麼都不想)/, probes: [
    '這一週做事的動力跟以前比起來，是差不多、明顯下降，還是幾乎提不起來？',
    '最近想做事或出門的動力，跟平常相比是差不多、有點下降，還是幾乎都提不起來？'
  ]},
  // 8. 精神運動遲滯
  { pattern: /(做事變慢|思考變慢|反應慢|動作遲緩|腦袋轉不動|說話慢)/, probes: [
    '最近覺得思考或做事變慢，大概一週會有幾天明顯感覺到？',
    '這一週有沒有覺得自己反應或做事比以前慢，大概幾天會有這種感覺？'
  ]},
  // 9. 激越
  { pattern: /(坐不住|煩躁|靜不下來|一直動來動去|焦躁|待不住)/, probes: [
    '這種坐不住或煩躁的感覺，是偶爾，還是幾乎每天都有？',
    '最近有沒有容易感到煩躁、靜不下來？這種情況大概多常出現？'
  ]},
  // 10. 精神性焦慮
  { pattern: /(緊張|焦慮|一直擔心|莫名不安|很害怕|恐慌|惶惶不安)/, probes: [
    '這種緊張或焦慮的感覺，是偶爾，還是幾乎每天都會有？',
    '最近心裡有沒有一種莫名的不安或擔心，這種感覺大概一週幾天會有？'
  ]},
  // 11. 軀體性焦慮
  { pattern: /(心悸|胸悶|肌肉緊繃|頭痛頭暈|手抖|冒冷汗|身體很緊)/, probes: [
    '身體上的緊繃、心悸或頭痛這類反應，大概一週會出現幾天？',
    '最近有沒有出現心跳加速、胸悶或肌肉緊繃這類身體反應，大概一週幾天？'
  ]},
  // 12. 胃腸症狀
  { pattern: /(食慾|吃不下|胃口|沒胃口|腸胃不舒服|胃痛|噁心想吐)/, probes: [
    '食慾或腸胃不適的情況，是輕微還是已經明顯影響到你吃飯？',
    '最近腸胃狀況或食慾，有沒有因為情緒受到影響？程度是輕微還是明顯？'
  ]},
  // 13. 一般身體症狀
  { pattern: /(疲倦|沒力氣|很累|沒精神|無力感|身體很重|整個人沉沉的)/, probes: [
    '身體整體的疲累或痠痛，大概一週會有幾天？',
    '最近整個人有沒有特別容易累或覺得身體沉重，大概一週幾天會這樣？'
  ]},
  // 14. 生理功能症狀
  { pattern: /(性慾|對那方面沒興趣|生理功能|房事|性生活|對性沒感覺)/, probes: [
    '最近性慾或生理功能的變化，是輕微還是明顯？',
    '最近對這方面的興趣或反應，有沒有感覺跟以前不太一樣？是輕微還是明顯？'
  ]},
  // 15. 疑病傾向
  { pattern: /(一直擔心身體|覺得自己生病|一直去看醫生|身體哪裡出問題|疑神疑鬼身體|反覆檢查身體)/, probes: [
    '對身體狀況的擔心，大概一週會有幾天讓你放不下？',
    '最近有沒有常常很擔心自己身體哪裡出問題，這種擔心大概多常讓你放不下？'
  ]},
  // 16. 體重下降
  { pattern: /(體重|變瘦|瘦了|吃得很少|食量減少|體重掉|明顯輕了)/, probes: [
    '最近食量或體重變化，是輕微還是明顯到你自己都感覺得到？',
    '這一個月體重或食量有沒有明顯變化，是輕微還是連自己都感覺得到？'
  ]},
  // 17. 病識感
  { pattern: /(覺得沒什麼問題|應該沒關係|只是太累|只是壓力|不覺得自己有病|大家都這樣)/, probes: [
    '你自己覺得最近這些狀況，比較像是一時的壓力，還是已經持續一段時間的情緒困擾？',
    '對自己最近這些變化，你比較覺得是壓力反應、情緒困擾，還是其實沒什麼問題？'
  ]}
];

function isScoreableQuestion(question) {
  const q = String(question || '');
  if (!q.trim()) return false;
  return SCOREABLE_PATTERNS.some((p) => p.test(q));
}

// HAM-D 17 題：每題兩個變種問句，隨機抽一個避免使用者看出固定模式
const ITEM_PROBE_TEXTS = {
  depressed_mood: [
    '最近這種低落或空掉的感覺，是幾乎每天都有，還是偶爾才會出現？',
    '這一週心情比較低落或空洞的感覺，是每天幾乎都這樣，還是偶爾才會有？'
  ],
  guilt: [
    '這種自責的感覺，大概一週會出現幾天？',
    '最近有沒有常常覺得哪裡做錯、一直怪自己？這種感覺一週大約有幾天？'
  ],
  suicide: [
    '這一週有沒有出現過不想活、想消失，或覺得活著沒有意義的念頭？',
    '這週有沒有冒出過想消失、不想繼續，或覺得活著很累的念頭？'
  ],
  insomnia_early: [
    '最近睡前難入睡的情況，大概一週會有幾天？',
    '最近要花多久才睡得著？這種情況一週大概幾天會發生？'
  ],
  insomnia_middle: [
    '最近半夜醒來的情況，大概一週會有幾天？',
    '最近睡到一半醒來的狀況，是偶爾還是已經很頻繁？'
  ],
  insomnia_late: [
    '最近早醒之後就睡不回去的情況，大概一週會有幾天？',
    '最近有沒有常常比預計早醒，而且醒了就再也睡不回去？'
  ],
  work_activities: [
    '這一週做事的動力跟以前比起來，是差不多、明顯下降，還是幾乎提不起來？',
    '最近想做事或出門的動力，跟平常相比是差不多、有點下降，還是幾乎都提不起來？'
  ],
  retardation: [
    '最近覺得思考或做事變慢，大概一週會有幾天明顯感覺到？',
    '這一週有沒有覺得自己反應或做事比以前慢，大概幾天會有這種感覺？'
  ],
  agitation: [
    '這種坐不住或煩躁的感覺，是偶爾還是幾乎每天都有？',
    '最近有沒有容易感到煩躁、靜不下來？這種情況大概多常出現？'
  ],
  psychic_anxiety: [
    '這種緊張或焦慮的感覺，是偶爾，還是幾乎每天都會有？',
    '最近心裡有沒有一種莫名的不安或擔心，這種感覺大概一週幾天會有？'
  ],
  somatic_anxiety: [
    '身體上的緊繃、心悸或頭痛這類反應，大概一週會出現幾天？',
    '最近有沒有出現心跳加速、胸悶或肌肉緊繃這類身體反應，大概一週幾天？'
  ],
  gastrointestinal_somatic: [
    '食慾或腸胃不適的情況，是輕微還是已經明顯影響到你吃飯？',
    '最近腸胃狀況或食慾，有沒有因為情緒而受到影響？程度是輕微還是明顯？'
  ],
  general_somatic: [
    '身體整體的疲累或痠痛，大概一週會有幾天？',
    '最近整個人有沒有特別容易累或覺得身體沉重，大概一週幾天會這樣？'
  ],
  genital_symptoms: [
    '最近性慾或生理功能的變化，是輕微還是明顯？',
    '最近對這方面的興趣或反應，有沒有感覺跟以前不太一樣？是輕微還是明顯？'
  ],
  hypochondriasis: [
    '對身體狀況的擔心，大概一週會有幾天讓你放不下？',
    '最近有沒有常常很擔心自己身體哪裡出問題，這種擔心大概多常讓你放不下？'
  ],
  weight_loss: [
    '最近食量或體重變化，是輕微還是明顯到你自己都感覺得到？',
    '這一個月體重或食量有沒有明顯變化，是輕微還是連自己都感覺得到？'
  ],
  insight: [
    '對自己最近這些變化，你比較覺得是壓力反應、情緒困擾，還是其實沒什麼問題？',
    '你自己覺得最近這些狀況，比較像是一時的壓力，還是已經持續一段時間的情緒困擾？'
  ]
};

function buildProbeFromItem(itemCode) {
  const variants = ITEM_PROBE_TEXTS[itemCode];
  if (!variants) return '最近這種狀態是幾乎每天都有，還是偶爾才會出現？';
  return variants[Math.floor(Math.random() * variants.length)];
}

function pickNextUnlockedItemCode(state) {
  const probe = pickEmergencyProbe(state);
  return probe ? probe.item_code : null;
}

const CLARIFY_FEELING_CUES = [
  { label: '壓力', keywords: ['壓力', '喘不過氣', '扛不住', '被追著跑', '卡住'] },
  { label: '委屈', keywords: ['委屈', '不被理解', '誤會', '吞下去'] },
  { label: '難過', keywords: ['難過', '低落', '想哭', '沮喪', '失落'] },
  { label: '焦慮', keywords: ['焦慮', '緊張', '慌', '不安', '擔心'] },
  { label: '生氣', keywords: ['生氣', '火大', '煩', '煩躁', '不爽'] },
  { label: '自責', keywords: ['自責', '內疚', '都是我', '怪自己'] },
  { label: '疲憊', keywords: ['很累', '疲憊', '撐不住', '沒力', '耗盡'] },
  { label: '孤單', keywords: ['孤單', '孤獨', '一個人', '沒人懂'] }
];

const CLARIFY_PROBE_TEMPLATES_WITH_FEELING = [
  (labels) => `你能多說說你剛剛提到的${labels}嗎？現在最貼近你的，是哪一層感受？`,
  (labels) => `如果我們先不急著解決，只停在你剛剛說的${labels}裡，你覺得最難受的是哪一塊？`,
  (labels) => `剛剛那些${labels}背後，好像還有一個更深的感覺，你願意陪我一起往下說一點嗎？`,
  (labels) => `當${labels}冒出來的那一刻，你心裡最常跳出來的感受或念頭是什麼？`,
  (labels) => `你現在最想被理解的，會是這些${labels}中的哪一個部分？`
];

const CLARIFY_PROBE_TEMPLATES_GENERIC = [
  '你能深入說說你現在的感受嗎？對你來說，最卡住的是哪一塊？',
  '如果我們先不急著找答案，你覺得剛剛那份感受裡，最難受的是什麼？',
  '你願意陪我再往裡面說一點嗎？那個讓你有感覺的點，最像什麼？',
  '當你說這些的時候，你心裡最明顯浮上來的感受是什麼？',
  '如果把剛剛那個瞬間停下來看，你最希望我先理解你的哪一部分？'
];

function pickDeterministicIndex(text, size) {
  const input = String(text || '');
  if (!size || size <= 1) return 0;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash * 31) + input.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash) % size;
}

function buildClarifyingProbe(userText) {
  const t = String(userText || '');
  const seen = new Set();
  const feelingLabels = [];
  for (const cue of CLARIFY_FEELING_CUES) {
    if (cue.keywords.some((kw) => t.includes(kw))) {
      if (!seen.has(cue.label)) {
        feelingLabels.push(cue.label);
        seen.add(cue.label);
      }
    }
  }
  if (feelingLabels.length === 0) {
    const index = pickDeterministicIndex(t, CLARIFY_PROBE_TEMPLATES_GENERIC.length);
    return CLARIFY_PROBE_TEMPLATES_GENERIC[index];
  }
  const labels = feelingLabels.slice(0, 2).join('和');
  const index = pickDeterministicIndex(t, CLARIFY_PROBE_TEMPLATES_WITH_FEELING.length);
  return CLARIFY_PROBE_TEMPLATES_WITH_FEELING[index](labels);
}

function pickScoreableProbe(userText, draft, formalProbe, state) {
  // ① formal_probe 已有問句 → 直接用
  const formalQ = String((formalProbe && formalProbe.probe_question) || '').trim();
  if (formalQ) return formalQ;
  // ② next_item：問下一個未鎖定的 HAM-D 題（推進量表）
  if (state) {
    const nextCode = pickNextUnlockedItemCode(state);
    if (nextCode) return buildProbeFromItem(nextCode);
  }
  // ③ 從症狀關鍵詞抓
  const source = `${String(userText || '')}\n${String(draft || '')}`;
  for (const rule of SYMPTOM_TO_PROBE) {
    if (rule.pattern.test(source)) return rule.probes[Math.floor(Math.random() * rule.probes.length)];
  }
  return '最近這種狀態是幾乎每天都有，還是偶爾才會出現？';
}

function enforceScoreableQuestion(draft, userText, state, formalProbe) {
  const text = String(draft || '').trim();
  if (!text) return text;
  const lastQ = extractLastQuestion(text);
  // 已可評分 → 保留（信任 LLM 寫得自然）
  if (lastQ && isScoreableQuestion(lastQ.question)) return text;
  // 不可評分 → 替換最後一句，優先使用 next_item probe
  const probe = pickScoreableProbe(userText, text, formalProbe, state);
  if (!probe) return text;
  if (!lastQ) return `${text}\n\n${probe}`;
  return lastQ.before ? `${lastQ.before}\n\n${probe}` : probe;
}

// ── 題項症狀關鍵詞映射（用於 isCorrectItem 判斷）──────────────────────────
const ITEM_SYMPTOM_KEYWORDS = {
  depressed_mood: [
    '低落', '提不起勁', '沮喪', '難過', '沒動力', '空虛', '心情不好', '鬱悶', '沒精神',
    '不開心', '悶悶的', '高興不起來', '快樂不起來', '開心不起來', '對什麼都沒興趣',
    '什麼都不想做', '整個人很低', '情緒很低', '心情低落', '很消沉', '消沉', '萎靡',
    '沒興趣', '索然無味', '無趣', '喪', '哀傷', '悲觀', '灰色', '沉重', '心裡很重',
    '覺得很悶', '心情差', '情緒不好', '莫名難過', '提不起精神', '心情很差', '很低落',
    '一點都不想', '怎麼都提不起勁', '感覺很差'
  ],
  guilt: [
    '自責', '內疚', '罪惡感', '怪自己', '都是我的錯', '覺得對不起', '後悔',
    '不應該', '拖累', '對不住', '讓人失望', '沒做好', '覺得自己很差', '沒用',
    '沒有價值', '害了', '責怪自己', '覺得很糟糕', '自我批評', '不夠好',
    '愧疚', '愧對', '羞恥', '慚愧', '丟臉', '都是我害的', '覺得自己是負擔',
    '連累', '不配', '很對不起', '應該更好', '太差了', '對不起自己', '對不起別人',
    '覺得虧欠', '覺得有罪', '懺悔', '無法原諒自己'
  ],
  suicide: [
    '不想活', '想死', '消失', '沒意義', '活著', '結束', '死', '想消失', '撐不下去',
    '活不下去', '人間蒸發', '不如死了', '死了算了', '活夠了', '不想繼續', '沒有意義',
    '人生沒意思', '沒有未來', '看不到未來', '不想撐', '想結束一切', '如果我不在了',
    '如果我走了', '傷害自己', '自傷', '輕生', '了結', '解脫', '沒有希望',
    '放棄活著', '不在乎活著', '消失掉', '不想存在', '存在沒意思', '沒有活下去的理由',
    '活著好累', '活著有什麼意思', '想一睡不起', '不想醒來'
  ],
  insomnia_early: [
    '睡不著', '難入睡', '躺很久', '失眠', '睡前', '入睡', '睡不好', '不好睡',
    '睡眠', '躺著', '睡覺', '翻來覆去', '腦袋轉不停', '一直在想', '腦袋停不下來',
    '眼睛閉不上', '好不容易才睡著', '要很久才能睡', '睡前都在想', '整晚睡不著',
    '凌晨才睡', '想東想西', '腦子停不下來', '躺在床上', '睡不著覺', '沒辦法睡',
    '很難睡著', '閉上眼睛', '靜不下來睡', '睡意', '睡不到', '熬夜', '很晚才睡'
  ],
  insomnia_middle: [
    '半夜醒', '睡一睡', '中途醒', '容易醒', '睡眠中斷', '睡眠', '睡不好',
    '一直醒', '斷斷續續', '睡了又醒', '睡睡醒醒', '一個晚上醒好幾次',
    '睡眠很淺', '淺眠', '一點聲音就醒', '睡不深', '睡得很淺', '做夢', '一直做夢',
    '夢很多', '夢境', '睡到一半', '夜裡醒來', '半夜就醒', '睡不安穩', '不安穩',
    '一直被吵醒', '沒辦法連續睡', '睡眠品質差', '睡眠品質不好'
  ],
  insomnia_late: [
    '早醒', '太早醒', '睡不回去', '天沒亮', '睡眠', '睡不好',
    '醒得很早', '天剛亮就醒', '清晨就醒', '五點就醒', '四點就醒',
    '醒了就睡不著', '再也睡不著', '回不去睡', '醒太早', '比預定時間早醒',
    '早早就醒', '比平常早醒', '天還沒亮就醒', '睡不夠', '睡眠不足',
    '醒來睡不著', '一大早就清醒', '早上很早就醒'
  ],
  work_activities: [
    '做事', '動力', '工作', '上班', '上課', '提不起來', '不想做', '效率',
    '沒心思', '無法專心', '拖', '拖延', '沒有幹勁', '提不起興趣', '不想去',
    '懶得動', '什麼都不想做', '沒有衝勁', '沒辦法做事', '做不下去', '半途而廢',
    '開始不了', '動不了', '興趣', '嗜好', '活動', '出門', '社交', '見朋友',
    '運動', '休閒', '完成', '進度', '拖著', '懶', '提不起勁做', '無法完成',
    '任務', '計畫', '做到一半', '沒辦法持續', '原本喜歡的', '不想出門',
    '不想見人', '推掉', '取消', '沒精力', '力不從心', '應付不來'
  ],
  retardation: [
    '變慢', '思考', '回話', '拖住', '遲鈍', '反應慢', '做事慢',
    '說話變慢', '動作變慢', '腦袋轉得慢', '想不到', '想不出來', '腦霧',
    '模糊', '記性', '記憶', '忘記', '搞不清楚', '思緒混亂', '說不出口',
    '腦袋很重', '走路很慢', '像被拖住', '像在水裡', '反應', '說話',
    '表達', '表達不出來', '腦袋空白', '發呆', '愣住', '停頓', '腦子空空',
    '想半天', '說不清楚', '動作遲緩', '感覺整個人慢下來', '手腳慢'
  ],
  agitation: [
    '坐不住', '煩躁', '靜不下來', '一直動', '不安', '焦躁',
    '暴躁', '煩', '很煩', '脾氣', '發脾氣', '易怒', '容易發火',
    '靜不住', '手腳不停', '抖', '走來走去', '無法靜止', '躁', '急躁',
    '焦急', '很急', '情緒爆發', '一點小事就爆', '忍不住', '心理很煩',
    '控制不住', '爆發', '煩到想爆炸', '很急躁', '焦躁不安', '情緒不穩',
    '容易激動', '一直想動', '手在抖', '腳在抖', '靜不下來', '無法安靜'
  ],
  psychic_anxiety: [
    '緊張', '焦慮', '不安', '擔心', '壓著', '害怕',
    '恐慌', '恐懼', '慌張', '惶惶不安', '提心吊膽', '放不鬆', '無法放鬆',
    '擔心很多', '想很多', '過度擔心', '想到就怕', '患得患失', '坐立不安',
    '忐忑', '無法平靜', '神經很緊', '繃很緊', '很緊張', '容易緊張',
    '預設最壞', '最壞的情況', '一直在擔心', '停不下來的擔心', '控制不了焦慮',
    '腦子一直轉', '停不了', '心裡很不踏實', '不踏實', '心慌', '慌',
    '恐慌感', '好像快崩潰', '快撐不住了', '很不安', '焦慮感很強'
  ],
  somatic_anxiety: [
    '緊繃', '心悸', '頭痛', '胸悶', '身體', '肌肉緊',
    '胸口', '喘不過氣', '呼吸困難', '呼吸急促', '心跳', '心跳很快',
    '顫抖', '發抖', '手抖', '腳軟', '頭暈', '冒汗', '手心出汗',
    '胃痛', '腸胃不舒服', '腹部', '肩頸', '頸部緊', '背痛',
    '身體有反應', '身體不舒服', '手腳冰冷', '身體緊', '肌肉緊繃',
    '呼吸不順', '胸部緊', '很悶', '呼吸', '心臟', '胸口很緊',
    '全身緊', '頭很緊', '脖子緊', '緊到很不舒服', '身體反應'
  ],
  gastrointestinal_somatic: [
    '食慾', '腸胃', '胃口', '吃不下', '吃東西', '噁心',
    '吃飯', '吃不起勁', '沒胃口', '消化', '消化不好', '腹脹', '肚子',
    '胃', '反胃', '消化問題', '排便', '便秘', '腹痛', '胃脹',
    '吃了就不舒服', '不想吃', '吃得少', '食量減少', '不想吃東西',
    '吞不下', '嘔吐', '想吐', '胃不舒服', '腸胃很差', '吃不下飯',
    '沒什麼食慾', '拉肚子', '腸子', '腸胃問題', '胃口很差'
  ],
  general_somatic: [
    '疲累', '痠痛', '沒力', '很累', '身體疲倦',
    '全身無力', '沉', '沉重', '很沉', '頭重', '昏沉', '疲乏',
    '沒勁', '虛', '虛弱', '力氣', '身體沉', '累到動不了', '累到不行',
    '全身累', '提不起力氣', '氣力', '精力', '體力', '身體狀況差',
    '體力不好', '沒體力', '感覺很虛', '身體很沉', '整個人很沉',
    '好累', '累壞了', '疲憊', '精疲力竭', '全身痠', '全身痛',
    '肌肉痠', '關節痛', '身體很差', '感覺快病了', '不舒服'
  ],
  genital_symptoms: [
    '性慾', '生理功能', '性功能',
    '對性', '性方面', '沒有慾望', '生理上', '親密關係', '親密感',
    '夫妻生活', '伴侶之間', '性需求', '冷感', '不感興趣', '興趣減退',
    '那方面', '男女關係', '床事', '欲望', '沒有感覺', '沒慾望',
    '性生活', '不想要', '生理需求'
  ],
  hypochondriasis: [
    '擔心身體', '哪裡出問題', '放不下', '健康焦慮',
    '一直擔心', '怕生病', '怕有病', '檢查', '身體檢查', '看醫生',
    '症狀', '是不是有什麼問題', '萬一生病', '萬一有病', '覺得哪裡不舒服',
    '覺得自己生病', '是不是很嚴重', '覺得身體有問題', '身體出問題',
    '健康', '是不是惡化', '怕是大病', '怕有什麼嚴重的', '一直查',
    '一直看醫生', '擔心健康', '覺得有問題', '注意到症狀', '一直注意身體',
    '覺得哪裡怪怪的', '身體某個地方', '某個症狀', '查了很多'
  ],
  weight_loss: [
    '食量', '體重', '變瘦', '吃少',
    '瘦了', '輕了', '少了幾公斤', '衣服變鬆', '體重掉', '體重下降',
    '胃口差', '吃不多', '吃得比以前少', '食慾很差', '不怎麼吃',
    '根本不想吃', '減輕', '瘦很多', '體重減少', '沒在吃', '吃很少',
    '吃得越來越少', '體型', '身材', '衣服鬆了', '感覺變輕'
  ],
  insight: [
    '看待', '壓力反應', '情緒困擾', '覺得自己', '病識感',
    '覺得沒問題', '覺得是正常的', '只是累', '只是壓力', '不覺得有病',
    '覺得自己還好', '應該沒事', '只是最近', '過一陣子就好', '不需要擔心',
    '不用看醫生', '只是情緒', '別人也這樣', '沒什麼大不了', '算不上',
    '這算什麼問題', '不算什麼', '不嚴重', '沒有到那種程度', '沒那麼嚴重',
    '不用大驚小怪', '還好吧', '大家都這樣', '正常吧', '正常反應',
    '只是暫時', '應該會自己好', '不需要幫助', '自己能處理', '沒問題'
  ]
};

// 具體情境關鍵字（問句必須含至少一個才算「有具體情境」）
const SPECIFIC_CONTEXT_KEYWORDS = [
  // 頻率情境
  '一週', '每天', '幾天', '偶爾', '常常', '幾乎', '幾次',
  // 時間情境
  '多久', '持續', '幾個月', '幾週', '最近',
  // 程度情境
  '輕微', '明顯', '嚴重', '比以前', '差不多',
  // 功能情境
  '影響', '工作', '上班', '上課', '讀書', '睡眠', '吃飯',
  '食慾', '社交', '出門', '完成', '事情', '日常'
];

/**
 * 判斷問句是否命中指定的 HAM-D 題項
 * @param {string} question - 問句文字
 * @param {string} targetItemCode - 目標題項代碼
 * @returns {boolean}
 */
function isCorrectItem(question, targetItemCode) {
  const q = String(question || '');
  if (!q.trim() || !targetItemCode) return false;
  const keywords = ITEM_SYMPTOM_KEYWORDS[targetItemCode];
  if (!keywords || !keywords.length) return false;
  // 必須命中該 item 至少一個症狀關鍵詞
  const hitSymptom = keywords.some((kw) => q.includes(kw));
  if (!hitSymptom) return false;
  // 必須包含至少一個「具體情境」關鍵字
  const hitContext = SPECIFIC_CONTEXT_KEYWORDS.some((kw) => q.includes(kw));
  return hitContext;
}

/**
 * 判斷 AI 問的是否是患者自己在這輪訊息中親口提到的症狀
 * 若是，即使不是 target item，也不應強制替換
 */
function isAskingAboutMentionedSymptom(question, userText) {
  const q = String(question || '');
  const u = String(userText || '');
  if (!q || !u) return false;
  for (const keywords of Object.values(ITEM_SYMPTOM_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw)) && keywords.some((kw) => u.includes(kw))) {
      return true;
    }
  }
  return false;
}

// ── 對話狀態（conversation_mode）─────────────────────────────────────────────
// 三態：clarifying（釐清）/ probing（補問同題）/ switching（換題）
function countMentionedItems(userText) {
  const t = String(userText || '');
  if (!t) return 0;
  let count = 0;
  for (const keywords of Object.values(ITEM_SYMPTOM_KEYWORDS)) {
    if (keywords.some((kw) => t.includes(kw))) count += 1;
  }
  return count;
}

function getItemProbeCount(state, itemCode) {
  if (!state || !itemCode) return 0;
  // 優先讀 formal_assessment 的 probe_count，再 fallback 到 hamd_item_turn_counts
  const assessment = normalizeObjectState(state, 'hamd_formal_assessment', {});
  const items = Array.isArray(assessment.items) ? assessment.items : [];
  const item = items.find((i) => i && i.item_code === itemCode);
  const fromAssessment = item ? Number(item.probe_count || 0) : 0;
  const fromTurnCount = getItemTurnCount(state, itemCode);
  return Math.max(fromAssessment, fromTurnCount);
}

function isItemDataComplete(state, itemCode) {
  if (!state || !itemCode) return false;
  const assessment = normalizeObjectState(state, 'hamd_formal_assessment', {});
  const items = Array.isArray(assessment.items) ? assessment.items : [];
  const item = items.find((i) => i && i.item_code === itemCode);
  if (!item) return false;
  const hasEvidence = Array.isArray(item.evidence_summary) && item.evidence_summary.length > 0;
  const hasScore = item.ai_suggested_score != null;
  // 有滑桿數值 + 文字證據 → 使用者已自評，視為完成（不需再問）
  const hasSlider = item.user_self_rating != null
    && item.user_self_rating.source === 'slider'
    && item.user_self_rating.value != null;
  return (hasEvidence && hasScore) || (hasSlider && hasEvidence);
}

function determineConversationMode(state, userText, targetItemCode) {
  // 沒 target → 必然 clarifying
  if (!targetItemCode) {
    return { mode: 'clarifying', reason: 'no_target_item' };
  }
  // 使用者本輪同時提到 ≥3 個不同 HAM-D 症狀群 → 主軸不明確，先釐清
  // 例外：若目前 target_item 的關鍵詞仍在使用者文字中 → 主軸未散，禁止釐清
  const mentioned = countMentionedItems(userText);
  if (mentioned >= 3) {
    const targetKeywords = ITEM_SYMPTOM_KEYWORDS[targetItemCode] || [];
    const userMentionsTarget = targetKeywords.some((kw) => String(userText || '').includes(kw));
    if (!userMentionsTarget) {
      return { mode: 'clarifying', reason: 'multi_symptom_input', mentioned_count: mentioned };
    }
    // target 語意仍在 → 主軸還在，不釐清
  }
  // 該題已收集到 evidence + score → 換題
  if (isItemDataComplete(state, targetItemCode)) {
    return { mode: 'switching', reason: 'data_complete' };
  }
  // 已對該題探過 ≥1 次 → 換題（問一次就夠，不再黏題）
  const probeCount = getItemProbeCount(state, targetItemCode);
  if (probeCount >= 1) {
    return { mode: 'switching', reason: 'probe_exhausted', probe_count: probeCount };
  }
  // 預設：補問同題
  return { mode: 'probing', reason: 'continue_same_item', probe_count: probeCount };
}

function resolveConversationTarget(state, userText, formalProbe) {
  const nextItemCode = pickNextUnlockedItemCode(state);
  let targetItemCode = nextItemCode || (formalProbe && formalProbe.item_code) || '';
  let targetItemSource = nextItemCode ? 'next_unlocked' : (formalProbe && formalProbe.item_code) ? 'formal_probe' : 'none';
  const decisionNotes = [];

  if (targetItemCode) {
    const lastAsked = String(state.hamd_last_asked_item || '');
    const turnCount = getItemTurnCount(state, targetItemCode);
    const isConsecutive = lastAsked === targetItemCode;
    const consecutiveCount = isConsecutive ? (state._consecutive_same_item_count || 1) : 0;
    const shouldForceSwitch = consecutiveCount >= MAX_CONSECUTIVE_SAME_ITEM || turnCount >= MAX_TURNS_PER_ITEM;
    if (shouldForceSwitch) {
      const altProbe = pickEmergencyProbe(state, userText, [targetItemCode]);
      if (altProbe) {
        decisionNotes.push(`繞題防護: "${targetItemCode}"(連續=${consecutiveCount}, 累計=${turnCount}) → 強制切換 "${altProbe.item_code}"`);
        targetItemCode = altProbe.item_code;
        targetItemSource = 'stuck_override';
        state._consecutive_same_item_count = 0;
      }
    } else {
      state._consecutive_same_item_count = isConsecutive ? consecutiveCount + 1 : 1;
    }
  }

  return {
    targetItemCode,
    targetItemSource,
    decisionNotes
  };
}

function normalizeConversationModeDecision(rawDecision, fallbackDecision, targetItemCode, targetItemSource) {
  const fallback = fallbackDecision && typeof fallbackDecision === 'object'
    ? fallbackDecision
    : { mode: 'clarifying', reason: 'fallback_default' };
  const raw = rawDecision && typeof rawDecision === 'object' ? rawDecision : {};
  const allowedModes = new Set(['clarifying', 'probing', 'switching']);
  const mode = allowedModes.has(String(raw.mode || '').trim())
    ? String(raw.mode || '').trim()
    : fallback.mode;
  const normalized = {
    mode,
    reason: String(raw.reason || '').trim() || fallback.reason || 'llm_judgement',
    topic_clarity: String(raw.topic_clarity || '').trim() || '',
    hamd_ready: String(raw.hamd_ready || '').trim() || '',
    progression: String(raw.progression || '').trim() || '',
    loop_detected: String(raw.loop_detected || '').trim() || '',
    target_item_code: targetItemCode || '',
    target_item_source: targetItemSource || 'none'
  };
  return normalized;
}

function isProbeEligibleItem(state, itemCode) {
  const code = String(itemCode || '').trim();
  if (!code) return false;
  const lockedCodes = getLockedItemCodes(state);
  const skippedCodes = getSkippedItemCodes(state);
  const overTurn = getItemTurnCount(state, code) >= MAX_TURNS_PER_ITEM;
  return !lockedCodes.includes(code) && !skippedCodes.includes(code) && !overTurn;
}

// ── 換題銜接句（switching 模式專用）─────────────────────────────────────────
// 只在 conversation_mode = switching 時，從舊維度跨到新維度才觸發
const DIMENSION_TRANSITION_PHRASES = {
  // from → to → 銜接句
  insomnia:      { default: '你說的睡眠狀況我先記下來了，' },
  depressed_mood:{ default: '心情這塊先放這裡，' },
  guilt:         { default: '你剛才說的那種感覺我有記下來，' },
  work_interest: { default: '動力這件事先放著，' },
  retardation:   { default: '整個人變慢的感覺先記著，' },
  somatic_anxiety:{ default: '身體這塊先記下來，' },
  agitation:     { default: '那種坐不住的感覺先放著，' }
};

// 「換個方向」引導語，接在 from 銜接句後，然後接新題
const TOPIC_SHIFT_CONNECTORS = [
  '我想換個方向了解一下，',
  '我想多問你另一塊，',
  '我換個角度問問你，',
  '讓我換個方向問你，'
];

function buildSwitchingTransition(fromItemCode, toItemCode) {
  if (!fromItemCode || !toItemCode || fromItemCode === toItemCode) return '';
  const fromDef = HAMD_FORMAL_ITEM_MAP[fromItemCode];
  const toDef   = HAMD_FORMAL_ITEM_MAP[toItemCode];
  if (!fromDef || !toDef) return '';
  const fromDim = fromDef.dimension || '';
  // 同 dimension 換題不需要銜接句（只是同類補問）
  if (fromDim === (toDef.dimension || '')) return '';
  const fromPhrases = DIMENSION_TRANSITION_PHRASES[fromDim] || {};
  const ack = fromPhrases.default || '';
  const connector = TOPIC_SHIFT_CONNECTORS[
    Math.abs((fromItemCode + toItemCode).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % TOPIC_SHIFT_CONNECTORS.length
  ];
  return ack + connector;
}

function buildFormalProbeFromItemCode(state, itemCode, reason = 'mode_selected_item') {
  const code = String(itemCode || '').trim();
  const definition = HAMD_FORMAL_ITEM_MAP[code];
  if (!definition) {
    return { should_ask: 'no', item_code: '', item_label: '', question_type: '', probe_question: '', reason: 'invalid_mode_item' };
  }
  const assessment = hydrateFormalAssessment(state.hamd_formal_assessment);
  const item = assessment.items.find((entry) => entry.item_code === code) || {};
  const variants = ITEM_PROBE_TEXTS[code];
  const probeCount = Number(item.probe_count || 0);
  const probeQuestion = (probeCount === 1 && variants && variants[1])
    ? variants[1]
    : ((variants && variants[0]) ? variants[0] : definition.probe_question);
  return {
    should_ask: 'yes',
    item_code: definition.item_code,
    item_label: definition.item_label,
    question_type: getItemDataGap(item) || 'frequency',
    probe_question: probeQuestion,
    reason
  };
}

function resolveConversationTargetByMode(state, userText, formalProbe, mode, baseResolvedTarget) {
  const base = baseResolvedTarget || resolveConversationTarget(state, userText, formalProbe);
  if (mode === 'probing') {
    // ⚡ LLM dominant_dim 已明確選定題項 → 直接信任，不讓 pending/formalProbe 蓋掉
    if (base.targetItemSource && base.targetItemSource.startsWith('llm_dominant_dim')) {
      if (isProbeEligibleItem(state, base.targetItemCode)) {
        return {
          targetItemCode: base.targetItemCode,
          targetItemSource: base.targetItemSource,
          decisionNotes: [...base.decisionNotes, `probing → LLM dominant_dim 優先選 "${base.targetItemCode}"`]
        };
      }
    }
    const assessment = hydrateFormalAssessment(state.hamd_formal_assessment);
    const probingCandidate = [
      assessment.pending_probe_item_code,
      state.hamd_last_asked_item,
      formalProbe && formalProbe.item_code,
      base.targetItemCode
    ].find((code) => isProbeEligibleItem(state, code));
    if (probingCandidate) {
      return {
        targetItemCode: probingCandidate,
        targetItemSource: probingCandidate === base.targetItemCode ? base.targetItemSource : 'probing_same_item',
        decisionNotes: probingCandidate === base.targetItemCode
          ? [...base.decisionNotes]
          : [...base.decisionNotes, `probing → 沿用同題 "${probingCandidate}"`]
      };
    }
    return base;
  }

  if (mode === 'switching') {
    // ⚡ 如果 target 是 LLM dominant_dim 決定的，直接信任它，不要再 re-pick 蓋掉
    if (base.targetItemSource && base.targetItemSource.startsWith('llm_dominant_dim')) {
      return {
        targetItemCode: base.targetItemCode,
        targetItemSource: base.targetItemSource,
        decisionNotes: [...base.decisionNotes, `switching → LLM dominant_dim 直接選 "${base.targetItemCode}"（不重選）`]
      };
    }
    // 一般 switching：排除當前題，重新選
    const excluded = [
      base.targetItemCode,
      state.hamd_last_asked_item,
      formalProbe && formalProbe.item_code
    ].filter(Boolean);
    const altProbe = pickEmergencyProbe(state, userText, excluded);
    if (altProbe && altProbe.item_code) {
      return {
        targetItemCode: altProbe.item_code,
        targetItemSource: 'switching_new_item',
        decisionNotes: [...base.decisionNotes, `switching → 另選新題 "${altProbe.item_code}"`]
      };
    }
  }

  return base;
}

// ── 繞題追蹤 helpers ─────────────────────────────────────────────────────────

function getItemTurnCount(state, itemCode) {
  if (!state || !itemCode) return 0;
  return Number(((state.hamd_item_turn_counts) || {})[itemCode] || 0);
}

function incrementItemTurnCount(state, itemCode) {
  if (!state || !itemCode) return;
  if (!state.hamd_item_turn_counts) state.hamd_item_turn_counts = {};
  state.hamd_item_turn_counts[itemCode] = (state.hamd_item_turn_counts[itemCode] || 0) + 1;
}

// 從問句文字反推屬於哪個 HAM-D 題項（找第一個命中的）
function detectItemFromQuestion(question) {
  const q = String(question || '');
  if (!q) return null;
  for (const [code, keywords] of Object.entries(ITEM_SYMPTOM_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) return code;
  }
  return null;
}

// 在後處理器每個輸出路徑結束時呼叫，更新繞題追蹤 state
function trackAskedItem(state, finalQuestion, fallbackItemCode) {
  if (!state) return;
  const code = detectItemFromQuestion(finalQuestion) || fallbackItemCode || null;
  if (!code) {
    // 問的不是 HAM-D 題 → 重置連續計數
    state.hamd_last_asked_item = '';
    return;
  }
  incrementItemTurnCount(state, code);
  state.hamd_last_asked_item = code;
}

/**
 * 判斷是否需要介入
 * shouldIntervene = 沒有問句 OR 問句不可評分 OR 問錯 item OR 問句為禁止類型
 */
function shouldIntervene(draft, targetItemCode, userText) {
  const lastQ = extractLastQuestion(draft);
  // 沒有問句 → 需要介入（補一題）
  if (!lastQ) return { intervene: true, reason: 'no_question' };
  const q = lastQ.question;
  // 禁止類型檢查（coping、開放反思、安慰邀請）
  if (BAD_QUESTION_PATTERNS.some((pattern) => pattern.test(q))) {
    return { intervene: true, reason: 'banned_question_type' };
  }
  // 不可評分
  if (!isScoreableQuestion(q)) {
    return { intervene: true, reason: 'not_scoreable' };
  }
  // 問錯 item（有 target 但沒命中）
  // 豁免：若 AI 問的是患者這輪自己提到的症狀，屬於自然跟隨脈絡，不強制換題
  if (targetItemCode && !isCorrectItem(q, targetItemCode)) {
    if (userText && isAskingAboutMentionedSymptom(q, userText)) {
      return { intervene: false, reason: 'pass' };
    }
    return { intervene: true, reason: 'wrong_item' };
  }
  // 太空泛的 functional_impact
  if (isVagueFunctionalImpact(q)) {
    return { intervene: true, reason: 'vague_functional' };
  }
  // 所有條件都通過 → 不介入
  return { intervene: false, reason: 'pass' };
}

/**
 * 確保回答中只有一個問句（永遠只保留最後一個）
 * 多問句時只保留最後一個，前面的問號句全部移除
 */
function enforceSingleQuestion(text) {
  const t = String(text || '').trim();
  if (!t) return t;
  // 切割所有句子（標點保留在句尾）
  const segments = t.split(/(?<=[。！？?！\n])/).map((s) => s.trim()).filter(Boolean);
  // 找出所有問句的 index
  const questionIndices = [];
  for (let i = 0; i < segments.length; i++) {
    if (/[？?]/.test(segments[i])) questionIndices.push(i);
  }
  // 0 或 1 個問句 → 不用處理
  if (questionIndices.length <= 1) return t;
  // 多個問句 → 移除前面的，只留最後一個
  const lastQIdx = questionIndices[questionIndices.length - 1];
  const result = [];
  for (let i = 0; i < segments.length; i++) {
    if (questionIndices.includes(i) && i !== lastQIdx) {
      // 把多餘的問句整句移除
      continue;
    }
    result.push(segments[i]);
  }
  return result.join('').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 統一臨床後處理器（Clinical Post-Processor）
 *
 * 架構：LLM（自由生成）→ 後處理器（唯一控制點）→ 最終輸出
 *
 * 規則優先順序：
 * 1. 風險訊號 → 強制安全確認問題
 * 2. 系統閉嘴條件 → 三條件同時成立就不介入
 * 3. shouldIntervene → 判斷是否需要介入
 * 4. 介入策略 → 替換（不是追加）
 * 5. 單問句規則 → 最終確保只有一個問句
 * 6. 防 crash → 任何錯誤一律 fallback
 */
// ── AI Decision Trace ─────────────────────────────────────────────────────
// 收集所有 LLM 任務的決策過程供 debug 用，與 _clinical_trace（系統後處理）並行
function ensureAiTrace(state) {
  if (!state || typeof state !== 'object') return null;
  if (!state._ai_trace) {
    state._ai_trace = {
      timestamp: new Date().toISOString(),
      burden: null,
      hamd_progress: null,
      conversation_mode_judge: null,
      low_energy: null,
      intent: null,
      flow: null,
      probe_selector: null,
      evidence_classifier: null,
      scorer: null,
      smart_hunter: null
    };
  }
  return state._ai_trace;
}

function clinicalPostProcessor(draft, {
  userText = '',
  state = {},
  formalProbe = null,
  atmosphereProtected = false,
  conversationDecision = null,
  resolvedConversationTarget = null
} = {}) {
  // ── Debug Trace Object：每一步決策都記錄 ──
  const debugTrace = {
    timestamp: new Date().toISOString(),
    raw_output: String(draft || '').trim(),
    comfort_stripped: null,
    atmosphere_protected: atmosphereProtected,
    risk_detected: false,
    risk_action: null,
    conversation_mode: null,
    conversation_mode_reason: null,
    target_item: null,
    target_item_source: null,
    llm_dominant_dimension: null,
    llm_target_item: null,
    extracted_question: null,
    is_scoreable: null,
    is_correct_item: null,
    has_specific_context: null,
    should_intervene: null,
    intervention_reason: null,
    intervention_action: null,
    replacement_probe: null,
    final_question: null,
    final_output: null,
    decision_path: [],
    error: null
  };

  try {
    let text = String(draft || '').trim();
    if (!text) {
      debugTrace.final_output = text;
      debugTrace.decision_path.push('empty_input → skip');
      return { text, debugTrace };
    }

    // ── 第 0 層：移除中段安慰／正常化句 ──
    text = stripComfortPhrases(text);
    debugTrace.comfort_stripped = text !== debugTrace.raw_output ? text : null;
    if (debugTrace.comfort_stripped !== null) {
      debugTrace.decision_path.push('comfort_phrases_stripped');
    }

    // ── 氣氛保護：情緒承載模式不介入 ──
    if (atmosphereProtected) {
      text = enforceSingleQuestion(text);
      debugTrace.final_output = text;
      const finalQ = extractLastQuestion(text);
      debugTrace.final_question = finalQ ? finalQ.question : null;
      debugTrace.decision_path.push('atmosphere_protected → no_intervention');
      trackAskedItem(state, debugTrace.final_question, null);
      return { text, debugTrace };
    }

    // ── 第 1 層：風險訊號最高優先 ──
    const lockedCodes = getLockedItemCodes(state);
    debugTrace.risk_detected = detectRiskSignal(userText, state);
    if (debugTrace.risk_detected && !lockedCodes.includes('suicide')) {
      debugTrace.risk_action = 'force_safety_question';
      debugTrace.should_intervene = true;
      debugTrace.intervention_reason = 'risk_override';
      debugTrace.intervention_action = 'replace_question';
      debugTrace.decision_path.push('risk_signal → force RISK_PROBE（最高優先）');
      const lastQ = extractLastQuestion(text);
      debugTrace.extracted_question = lastQ ? lastQ.question : null;
      // RISK_PROBE.probe_question 已自帶「我想確認一件重要的事：」開頭，不再外加 transition
      const riskQ = RISK_PROBE.probe_question;
      if (lastQ && lastQ.before) {
        text = `${lastQ.before}\n\n${riskQ}`;
      } else {
        text = riskQ;
      }
      text = enforceSingleQuestion(text);
      debugTrace.replacement_probe = riskQ;
      debugTrace.final_output = text;
      const finalQ2 = extractLastQuestion(text);
      debugTrace.final_question = finalQ2 ? finalQ2.question : riskQ;
      trackAskedItem(state, debugTrace.final_question, 'suicide');
      return { text, debugTrace };
    }
    if (debugTrace.risk_detected && lockedCodes.includes('suicide')) {
      // suicide 已鎖定（已評分），但仍偵測到風險 → 記錄但不重複問
      debugTrace.risk_action = 'suicide_already_locked';
      debugTrace.should_intervene = true;
      debugTrace.intervention_reason = 'risk_detected_but_locked';
      debugTrace.decision_path.push('risk_signal → suicide_locked → 已問過，不重複');
    }

    // ── 第 2 層：取得 next_item ──
    const resolvedTarget = resolvedConversationTarget || resolveConversationTarget(state, userText, formalProbe);
    let targetItemCode = resolvedTarget.targetItemCode || '';
    debugTrace.target_item_source = resolvedTarget.targetItemSource || 'none';
    resolvedTarget.decisionNotes.forEach((note) => debugTrace.decision_path.push(note));
    debugTrace.target_item = targetItemCode || null;
    debugTrace.decision_path.push(`target_item = ${targetItemCode || 'none'} (${debugTrace.target_item_source})`);

    // ── 第 2.5 層：conversation_mode 三態決策 ──
    // clarifying（釐清）/ probing（補問同題）/ switching（換題）
    const convMode = conversationDecision || determineConversationMode(state, userText, targetItemCode);
    debugTrace.conversation_mode = convMode.mode;
    debugTrace.conversation_mode_reason = convMode.reason;
    // 記錄 LLM 語意判斷結果（供 UI 顯示「來源：LLM / 系統規則」）
    debugTrace.llm_dominant_dimension = convMode.llm_dominant_dimension || null;
    debugTrace.llm_target_item = (resolvedConversationTarget && resolvedConversationTarget.targetItemSource &&
      resolvedConversationTarget.targetItemSource.startsWith('llm_dominant_dim'))
      ? resolvedConversationTarget.targetItemCode : null;
    // 是否被規則強制覆蓋（rule_guard: probe_count >= 1 或 data_complete 觸發 switching）
    const convModeReason = String(convMode.reason || '');
    debugTrace.rule_guard_active = convModeReason.includes('rule_guard');
    debugTrace.rule_guard_reason = debugTrace.rule_guard_active
      ? convModeReason.replace('rule_guard(', '').replace(')→override_llm_probing', '').replace('rule_guard_', '')
      : null;
    debugTrace.decision_path.push(`conversation_mode = ${convMode.mode} (${convMode.reason})`);

    // 🟢 clarifying：主軸不明確 → 直接問「哪個最困擾」，不做 HAM-D 題壓力
    if (convMode.mode === 'clarifying') {
      if (state.hamd_formal_assessment) {
        state.hamd_formal_assessment.pending_probe_item_code = '';
        state.hamd_formal_assessment.pending_probe_question = '';
        state.hamd_formal_assessment.pending_probe_meta = null;
      }
      const clarifyProbe = buildClarifyingProbe(userText);
      const lastQForClarify = extractLastQuestion(text);
      if (lastQForClarify && lastQForClarify.before) {
        text = `${lastQForClarify.before}\n\n${clarifyProbe}`;
      } else {
        text = text ? `${text}\n\n${clarifyProbe}` : clarifyProbe;
      }
      text = enforceSingleQuestion(text);
      debugTrace.intervention_action = 'clarifying_probe';
      debugTrace.replacement_probe = clarifyProbe;
      debugTrace.final_output = text;
      const fqC = extractLastQuestion(text);
      debugTrace.final_question = fqC ? fqC.question : clarifyProbe;
      debugTrace.decision_path.push(`clarifying → "${clarifyProbe.substring(0, 40)}..."`);
      trackAskedItem(state, debugTrace.final_question, null);
      return { text, debugTrace };
    }

    // 🔵 switching：強制換下一個未鎖定 item
    if (convMode.mode === 'switching') {
      const switchedCode = pickNextUnlockedItemCode(state);
      if (switchedCode) {
        targetItemCode = switchedCode;
        debugTrace.target_item = switchedCode;
        debugTrace.target_item_source = 'switching_override';
        debugTrace.decision_path.push(`switching → 強制換題: "${switchedCode}"`);
      }
      // 若因「已拿到答案（滑桿+描述）」而換題，在 AI 文字前補過渡句
      if (convModeReason.includes('data_complete')) {
        const transition = '了解，這部分我大概有概念了，我們可以看看另一個面向。';
        text = text ? `${transition}\n\n${text}` : transition;
        debugTrace.decision_path.push('switching_transition → 已完成，加過渡句');
      }
    }
    // 🟡 probing：繼續同一題，走現有邏輯（不特別處理，讓後面的 shouldIntervene 接管）

    // ── 第 3 層：判斷介入 ──
    const lastQ = extractLastQuestion(text);
    debugTrace.extracted_question = lastQ ? lastQ.question : null;

    if (lastQ) {
      debugTrace.is_scoreable = isScoreableQuestion(lastQ.question);
      debugTrace.is_correct_item = targetItemCode ? isCorrectItem(lastQ.question, targetItemCode) : null;
      debugTrace.has_specific_context = SPECIFIC_CONTEXT_KEYWORDS.some((kw) => lastQ.question.includes(kw));
    } else {
      debugTrace.is_scoreable = false;
      debugTrace.is_correct_item = false;
      debugTrace.has_specific_context = false;
    }

    const decision = shouldIntervene(text, targetItemCode, userText);
    debugTrace.should_intervene = decision.intervene;
    debugTrace.intervention_reason = decision.reason;

    if (!decision.intervene) {
      // LLM 問對了 → 系統完全不介入
      debugTrace.intervention_action = 'none_llm_correct';
      debugTrace.decision_path.push('shouldIntervene=false → LLM 問對了 → 閉嘴');
      text = enforceSingleQuestion(text);
      debugTrace.final_output = text;
      const fq = extractLastQuestion(text);
      debugTrace.final_question = fq ? fq.question : null;
      trackAskedItem(state, debugTrace.final_question, targetItemCode);
      return { text, debugTrace };
    }

    // ── 第 4 層：介入 → 替換 ──
    debugTrace.decision_path.push(`shouldIntervene=true → reason=${decision.reason}`);
    const probe = pickScoreableProbe(userText, text, formalProbe, state);
    debugTrace.replacement_probe = probe || null;

    if (!probe) {
      debugTrace.intervention_action = 'no_probe_available';
      debugTrace.decision_path.push('no_probe_available → keep_original');
      text = enforceSingleQuestion(text);
      debugTrace.final_output = text;
      const fq2 = extractLastQuestion(text);
      debugTrace.final_question = fq2 ? fq2.question : null;
      trackAskedItem(state, debugTrace.final_question, targetItemCode);
      return { text, debugTrace };
    }

    if (decision.reason === 'no_question') {
      debugTrace.intervention_action = 'append_question';
      debugTrace.decision_path.push(`append_probe: "${probe.substring(0, 30)}..."`);
      text = `${text}\n\n${probe}`;
    } else {
      debugTrace.intervention_action = 'replace_question';
      debugTrace.decision_path.push(`replace: "${(debugTrace.extracted_question || '').substring(0, 20)}..." → "${probe.substring(0, 30)}..."`);
      if (lastQ && lastQ.before) {
        text = `${lastQ.before}\n\n${probe}`;
      } else {
        text = probe;
      }
    }

    // ── 第 5 層：單問句 ──
    text = enforceSingleQuestion(text);
    debugTrace.final_output = text;
    const fq3 = extractLastQuestion(text);
    debugTrace.final_question = fq3 ? fq3.question : null;
    debugTrace.decision_path.push('enforce_single_question → done');
    trackAskedItem(state, debugTrace.final_question, targetItemCode);
    return { text, debugTrace };

  } catch (error) {
    // ── 防 crash ──
    debugTrace.error = error.message || 'unknown_error';
    debugTrace.decision_path.push(`CRASH: ${debugTrace.error} → fallback`);
    const fallbackProbe = pickScoreableProbe(userText, draft, formalProbe, state);
    if (fallbackProbe) {
      const safeDraft = stripComfortPhrases(String(draft || ''));
      const safeLastQ = extractLastQuestion(safeDraft);
      let fallbackText;
      if (safeLastQ && safeLastQ.before) {
        fallbackText = `${safeLastQ.before}\n\n${fallbackProbe}`;
      } else {
        fallbackText = safeDraft ? `${safeDraft}\n\n${fallbackProbe}` : fallbackProbe;
      }
      debugTrace.replacement_probe = fallbackProbe;
      debugTrace.intervention_action = 'crash_fallback';
      debugTrace.final_output = fallbackText;
      return { text: fallbackText, debugTrace };
    }
    const finalFallback = String(draft || '').trim() || '最近這種狀態是幾乎每天都有，還是偶爾才會出現？';
    debugTrace.final_output = finalFallback;
    debugTrace.intervention_action = 'crash_last_resort';
    return { text: finalFallback, debugTrace };
  }
}

function enforceQuestionSafety(draft, { probeQuestion, shouldAsk }) {
  const text = String(draft || '').trim();
  const probe = String(probeQuestion || '').trim();
  // 沒有探針任務，或探針已存在於回覆中，直接返回
  if (!shouldAsk || !probe) return text;
  if (text.includes(probe)) return text;
  const lastQ = extractLastQuestion(text);
  if (!lastQ) {
    // 沒有問句，直接附加探針
    return `${text}\n\n${probe}`;
  }
  if (isInvalidQuestionEnding(lastQ.question)) {
    // 最後問句非法，替換掉
    return lastQ.before ? `${lastQ.before}\n\n${probe}` : probe;
  }
  // 最後問句合法，保留原文
  return text;
}

function buildFormalAssessmentProbeFallback(state, userMessage = '') {
  const assessment = hydrateFormalAssessment(state.hamd_formal_assessment);
  const lockedCodes = getLockedItemCodes(state);
  const skippedCodes = getSkippedItemCodes(state);

  // Pending probe：probe_count < 1 才黏著（已問過一次即不重問，直接換題）
  if (assessment.pending_probe_item_code) {
    const pendingCode = assessment.pending_probe_item_code;
    if (!lockedCodes.includes(pendingCode) && !skippedCodes.includes(pendingCode)) {
      const pendingItem = assessment.items.find((i) => i.item_code === pendingCode);
      const probeCount = pendingItem ? (pendingItem.probe_count || 0) : 0;
      if (probeCount < 1) {
        const def = HAMD_FORMAL_ITEM_MAP[pendingCode];
        const variants = ITEM_PROBE_TEXTS[pendingCode];
        const retryQuestion = (probeCount === 1 && variants && variants[1]) ? variants[1] : (def ? def.probe_question : '');
        const qType = getItemDataGap(pendingItem || {}) || 'frequency';
        return {
          should_ask: 'yes',
          item_code: pendingCode,
          item_label: def ? def.item_label : '',
          question_type: qType,
          probe_question: retryQuestion,
          reason: probeCount === 1 ? 'sticky_retry' : 'sticky_first'
        };
      }
    }
  }

  // 動態 dimension 順序：使用者提到的症狀 → next_recommended → 全部
  const progress = normalizeObjectState(state, 'hamd_progress_state', {});
  const mentionedDims = detectMentionedDimensions(userMessage);
  const dimOrder = [...mentionedDims];
  if (progress.next_recommended_dimension && !dimOrder.includes(progress.next_recommended_dimension)) {
    dimOrder.push(progress.next_recommended_dimension);
  }
  HAMD_PROGRESS_DIMENSIONS.forEach((d) => { if (!dimOrder.includes(d)) dimOrder.push(d); });

  let candidateCode = null;
  for (const dim of dimOrder) {
    candidateCode = (HAMD_DIMENSION_TO_ITEM_CODES[dim] || []).find((itemCode) => {
      if (lockedCodes.includes(itemCode) || skippedCodes.includes(itemCode)) return false;
      const item = assessment.items.find((entry) => entry.item_code === itemCode);
      return item && (!item.evidence_summary.length || item.review_required);
    });
    if (candidateCode) break;
  }

  if (!candidateCode) {
    return { should_ask: 'no', item_code: '', item_label: '', probe_question: '', reason: 'no_gap' };
  }

  const definition = HAMD_FORMAL_ITEM_MAP[candidateCode];
  const candidateItem = assessment.items.find((i) => i.item_code === candidateCode);
  const variants = ITEM_PROBE_TEXTS[candidateCode];
  const probeQuestion = (variants && variants[0]) ? variants[0] : definition.probe_question;
  const questionType = getItemDataGap(candidateItem || {}) || 'frequency';
  return {
    should_ask: 'yes',
    item_code: definition.item_code,
    item_label: definition.item_label,
    question_type: questionType,
    probe_question: probeQuestion,
    reason: `gap_in_${mentionedDims.length ? mentionedDims[0] : (progress.next_recommended_dimension || 'global')}`
  };
}

function summarizeHamdEvidenceText(item, text) {
  const normalized = normalizeClinicalNarrativeText(text);
  if (!normalized) return '';
  const code = String(item?.item_code || '').trim();

  if (code === 'depressed_mood' && /(低落|沮喪|難過|提不起勁|沒動力|空虛|沒意義)/i.test(normalized)) {
    return '病人描述近期持續低落，並伴隨明顯提不起勁。';
  }
  if (code === 'guilt' && /(自責|內疚|罪惡感|怪自己|都是我的錯)/i.test(normalized)) {
    return '病人提到反覆自責，並將困境歸咎於自己。';
  }
  if (code === 'suicide' && /(想死|不想活|活著沒有意義|想消失|結束生命|自殺)/i.test(normalized)) {
    return '病人表達消失或不想活的念頭，需持續留意安全風險。';
  }
  if (code === 'insomnia_early' && /(睡不著|難入睡|躺很久|失眠)/i.test(normalized)) {
    return '病人描述近期入睡困難，睡前需花較長時間才能入睡。';
  }
  if (code === 'insomnia_middle' && /(半夜醒|睡一睡醒來|容易醒|中途醒)/i.test(normalized)) {
    return '病人描述夜間睡眠中斷，半夜醒來情況增加。';
  }
  if (code === 'insomnia_late' && /(早醒|太早醒|醒來後睡不回去)/i.test(normalized)) {
    return '病人描述近期早醒，醒後較難再次入睡。';
  }
  if (code === 'work_activities' && /(提不起勁|沒動力|不想做|做不下去|工作|上班|上課|日常)/i.test(normalized)) {
    return '病人描述動力與活動投入下降，已影響工作或日常功能。';
  }
  if (code === 'retardation' && /(變慢|遲鈍|拖住|反應慢|講話慢|做事慢)/i.test(normalized)) {
    return '病人描述近期思考、回應或做事速度變慢。';
  }
  if (code === 'agitation' && /(坐不住|煩躁|一直動|很躁|靜不下來)/i.test(normalized)) {
    return '病人描述身體坐立難安，難以維持放鬆狀態。';
  }
  if (code === 'psychic_anxiety' && /(焦慮|緊張|不安|擔心|壓著你|害怕)/i.test(normalized)) {
    return '病人描述持續性的緊張與焦慮感。';
  }
  if (code === 'somatic_anxiety' && /(心悸|胸悶|胃不舒服|頭痛|緊繃|發抖|腸胃|身體)/i.test(normalized)) {
    return '病人描述焦慮伴隨明顯身體化反應。';
  }
  if (code === 'gastrointestinal_somatic' && /(食慾|吃不下|胃口|腸胃|肚子痛|胃痛|噁心)/i.test(normalized)) {
    return '病人描述情緒困擾伴隨食慾或腸胃症狀變化。';
  }
  if (code === 'general_somatic' && /(疲累|很累|痠痛|沒力|虛弱|身體拖住)/i.test(normalized)) {
    return '病人描述近期疲累與一般身體不適感增加。';
  }
  if (code === 'genital_symptoms' && /(性慾|生理功能|親密|性方面)/i.test(normalized)) {
    return '病人提到近期生理功能或性慾下降。';
  }
  if (code === 'hypochondriasis' && /(擔心.*身體|一直查病|覺得自己生病|很怕自己有病)/i.test(normalized)) {
    return '病人反覆擔心身體狀況，疑病傾向增加。';
  }
  if (code === 'weight_loss' && /(變瘦|瘦了|體重下降|食量變少|吃得更少)/i.test(normalized)) {
    return '病人描述近期食量或體重下降。';
  }
  if (code === 'insight' && /(壓力|情緒|憂鬱|焦慮|自己最近有問題|不太對勁)/i.test(normalized)) {
    return '病人對近期情緒或壓力狀態已有一定察覺。';
  }

  return rewriteObservationText(normalized) || rewriteConcernText(normalized) || normalized;
}

function normalizeHamdEvidenceSummary(item, evidenceSummary = []) {
  return uniqueStrings(
    normalizeArray(evidenceSummary)
      .map((value) => summarizeHamdEvidenceText(item, value))
      .filter(Boolean),
    3
  );
}

function buildFormalRatingRationale(item, evidence, suggestedScore) {
  const score = clampScore(suggestedScore, item?.scale_range);
  if (score == null) return '';
  const max = scoreRangeMax(item?.scale_range);
  const summary = normalizeHamdEvidenceSummary(item, evidence?.evidence_summary || [])[0] || '';
  const evidenceType = String(evidence?.evidence_type || '').trim();
  if (evidenceType === 'direct_answer') {
    return summary
      ? `${summary} 依病人直接描述，先建議 ${score}/${max}。`
      : `依病人直接描述，先建議 ${score}/${max}。`;
  }
  if (evidenceType === 'indirect_observation') {
    return summary
      ? `${summary} 依互動觀察與症狀線索，先建議 ${score}/${max}，仍需人工覆核。`
      : `依互動觀察與症狀線索，先建議 ${score}/${max}，仍需人工覆核。`;
  }
  return summary
    ? `${summary} 綜合病人描述與互動線索，先建議 ${score}/${max}。`
    : `綜合病人描述與互動線索，先建議 ${score}/${max}。`;
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
      evidence_summary: normalizeHamdEvidenceSummary(item, [text]),
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
        rating_rationale: buildFormalRatingRationale(item, evidence, suggested),
        confidence: evidence.confidence || 'medium'
      };
    }).filter(Boolean)
  };
}

function mergeEvidenceClassifierResultWithFallback(result, fallbackResult, targetItems) {
  const resultItems = Array.isArray(result?.items) ? result.items : [];
  const fallbackItems = Array.isArray(fallbackResult?.items) ? fallbackResult.items : [];
  const resultMap = resultItems.reduce((acc, item) => {
    if (!item || !item.item_code) return acc;
    acc[item.item_code] = item;
    return acc;
  }, {});
  const fallbackMap = fallbackItems.reduce((acc, item) => {
    if (!item || !item.item_code) return acc;
    acc[item.item_code] = item;
    return acc;
  }, {});

  const items = targetItems.map((item) => {
    const candidate = resultMap[item.item_code];
    const hasUsableEvidence = Boolean(
      candidate
      && (
        normalizeArray(candidate.evidence_summary).length
        || Object.prototype.hasOwnProperty.call(candidate, 'direct_answer_value')
        || String(candidate.evidence_type || '').trim()
      )
    );
    return hasUsableEvidence
      ? Object.assign({}, fallbackMap[item.item_code] || {}, candidate)
      : (fallbackMap[item.item_code] || candidate || null);
  }).filter(Boolean);

  return {
    assessment_mode: String(result?.assessment_mode || '').trim() || String(fallbackResult?.assessment_mode || 'mixed').trim() || 'mixed',
    items
  };
}

function mergeFormalScoringResultWithFallback(result, fallbackResult, targetItems) {
  const resultItems = Array.isArray(result?.items) ? result.items : [];
  const fallbackItems = Array.isArray(fallbackResult?.items) ? fallbackResult.items : [];
  const resultMap = resultItems.reduce((acc, item) => {
    if (!item || !item.item_code) return acc;
    acc[item.item_code] = item;
    return acc;
  }, {});
  const fallbackMap = fallbackItems.reduce((acc, item) => {
    if (!item || !item.item_code) return acc;
    acc[item.item_code] = item;
    return acc;
  }, {});

  return {
    items: targetItems.map((item) => {
      const candidate = resultMap[item.item_code];
      const hasUsableScore = Boolean(candidate) && Number.isFinite(Number(candidate.ai_suggested_score));
      const fallback = fallbackMap[item.item_code];
      if (hasUsableScore) {
        return Object.assign({}, fallback || {}, candidate);
      }
      return fallback || candidate || null;
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
      evidence_summary: evidence ? normalizeHamdEvidenceSummary(item, evidence.evidence_summary) : normalizeHamdEvidenceSummary(item, item.evidence_summary),
      confidence: score ? score.confidence || item.confidence : (evidence ? evidence.confidence || item.confidence : item.confidence),
      review_required: evidence ? Boolean(evidence.review_required) : item.review_required,
      ai_suggested_score: score && Object.prototype.hasOwnProperty.call(score, 'ai_suggested_score')
        ? clampScore(score.ai_suggested_score, item.scale_range)
        : item.ai_suggested_score,
      rating_rationale: score
        ? String(score.rating_rationale || '').trim() || buildFormalRatingRationale(item, evidence || item, score.ai_suggested_score)
        : buildFormalRatingRationale(item, evidence || item, item.ai_suggested_score)
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

function getFormalTargetItems(state, limit = 2, userMessage = '') {
  const assessment = hydrateFormalAssessment(state.hamd_formal_assessment);
  const lockedCodes = getLockedItemCodes(state);
  const skippedCodes = getSkippedItemCodes(state);
  const excludedCodes = [...new Set([...lockedCodes, ...skippedCodes])];

  // Pending probe：probe_count < 1 才黏著（已問過一次即不重問）
  if (assessment.pending_probe_item_code) {
    const pendingCode = assessment.pending_probe_item_code;
    if (HAMD_FORMAL_ITEM_MAP[pendingCode] && !excludedCodes.includes(pendingCode)) {
      const pendingItem = assessment.items.find((i) => i.item_code === pendingCode);
      const probeCount = pendingItem ? (pendingItem.probe_count || 0) : 0;
      if (probeCount < 1) return [HAMD_FORMAL_ITEM_MAP[pendingCode]];
    }
  }

  // 動態 dimension 順序：使用者提到的症狀優先，再 next_recommended，再補齊全部
  const progress = normalizeObjectState(state, 'hamd_progress_state', {});
  const mentionedDims = detectMentionedDimensions(userMessage);
  const dimensions = [...mentionedDims];
  if (progress.next_recommended_dimension && !dimensions.includes(progress.next_recommended_dimension)) {
    dimensions.push(progress.next_recommended_dimension);
  }
  normalizeArray(progress.supported_dimensions).forEach((d) => {
    if (!dimensions.includes(d)) dimensions.push(d);
  });
  HAMD_PROGRESS_DIMENSIONS.forEach((d) => { if (!dimensions.includes(d)) dimensions.push(d); });

  const targetCodes = [];
  for (const dimension of dimensions) {
    for (const itemCode of (HAMD_DIMENSION_TO_ITEM_CODES[dimension] || [])) {
      if (targetCodes.length >= limit) break;
      if (excludedCodes.includes(itemCode)) continue;
      const current = assessment.items.find((item) => item.item_code === itemCode);
      if (!current) continue;
      if (!current.evidence_summary.length || current.review_required) {
        if (!targetCodes.includes(itemCode)) targetCodes.push(itemCode);
      }
    }
    if (targetCodes.length >= limit) break;
  }

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
  return classifyDraftHistoryItem(item).include;
}

function formatTranscriptEntry(item) {
  if (!item || typeof item !== 'object') return '';
  const role = item.role === 'assistant' ? 'AI' : '使用者';
  const content = String(item.content || '').trim();
  if (!content) return '';
  return `${role}：${content}`;
}

function normalizeClientHistoryForHydration(history = [], limit = 48) {
  return normalizeArray(history)
    .map((item) => {
      const rawRole = String(item?.role || '').trim().toLowerCase();
      const role = rawRole === 'ai' ? 'assistant' : rawRole;
      const content = String(item?.content || '').trim();
      if (!content) return null;
      if (role !== 'user' && role !== 'assistant') return null;
      if (role === 'user' && !isDraftRelevantInstruction(content)) {
        return { role, content, kind: 'output' };
      }
      return { role, content, kind: 'chat' };
    })
    .filter(Boolean)
    .slice(-limit);
}

function hasClinicalNarrativeCue(text = '') {
  return /(失眠|睡不好|睡不著|腹瀉|肚子痛|腹痛|胃痛|發冷|盜汗|心悸|胸悶|焦慮|低落|沮喪|抓狂|易怒|噁心|食慾|頭痛|頭暈|上課|老師|同學|壓力)/i.test(text);
}

function isPureControlLikeInstruction(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) return true;
  if (/^output:/i.test(normalized)) return true;
  if (Object.prototype.hasOwnProperty.call(COMMAND_MAP, normalized.toLowerCase().replace(/^\//, ''))) return true;
  const hasOutputKeyword = OUTPUT_COMMAND_PATTERNS.some((item) => item.patterns.some((pattern) => pattern.test(normalized)))
    || OUTPUT_CONTROL_PATTERNS.some((pattern) => pattern.test(normalized))
    || MODE_SWITCH_PATTERNS.some((pattern) => pattern.test(normalized));
  if (!hasOutputKeyword) return false;
  if (hasClinicalNarrativeCue(normalized)) return false;
  return true;
}

function isDraftRelevantInstruction(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  const normalized = text.toLowerCase().replace(/^\//, '');
  if (Object.prototype.hasOwnProperty.call(COMMAND_MAP, normalized)) {
    return false;
  }
  if (isPureControlLikeInstruction(text)) {
    return false;
  }
  return true;
}

function classifyDraftHistoryItem(item) {
  if (!item || typeof item !== 'object') {
    return { include: false, reason: 'invalid_item', content: '' };
  }
  const kind = String(item.kind || 'chat').trim();
  const role = String(item.role || '').trim();
  const content = String(item.content || '').trim();
  if (!content) {
    return { include: false, reason: 'empty_content', role, content };
  }
  if (kind === 'command' || kind === 'output') {
    return { include: false, reason: 'command_or_output_kind', role, content };
  }
  if (role === 'user' && !isDraftRelevantInstruction(content)) {
    return { include: false, reason: 'output_control_or_mode_switch', role, content };
  }
  return { include: true, reason: 'clinical_candidate', role, content, kind };
}

const GENERIC_DRAFT_PHRASES = [
  '尋求情感支持',
  '自我分析',
  '需求情感支持',
  '希望進行自我分析',
  '需要幫助',
  '需要支持',
  '目前沒有具體的對話內容可供摘要',
  '目前資料還偏少',
  '情緒穩定',
  '目前對話中沒有提供具體的症狀或情況描述'
];

const PATIENT_ANALYSIS_PLACEHOLDER_PATTERNS = [
  '目前資料還偏少，但已經能看出你不是單純想抱怨',
  '目前還需要更多對話，才能整理出更具體的卡點',
  '如果你想要的是被理解，可以繼續補充最近最卡的一件事，讓分析不要只停在表面。',
  '如果你想把這些內容整理成比較正式的看診材料，可以按「整理給醫師」。'
];

const CLINICAL_SIGNAL_RULES = [
  {
    key: 'depression',
    label: '持續低落、空虛或失去意義感',
    signals: ['depressed_mood', 'work_interest'],
    pattern: /(憂鬱|低落|沮喪|難過|沉重|提不起勁|空虛|沒意義|樂趣|開心不起來)/i,
    summarize(message) {
      const details = [];
      if (/(空虛|沒意義|樂趣)/i.test(message)) details.push('反覆描述生活失去意義或樂趣感下降');
      if (/(提不起勁|沒動力|沉重)/i.test(message)) details.push('伴隨動力不足與明顯的情緒沉重感');
      return details.join('，') || '出現持續低落或失去意義感的描述';
    },
    followup: '釐清低落頻率、持續時間，以及是否影響工作、課業或日常活動。'
  },
  {
    key: 'self_image',
    label: '自我評價矛盾與人際敏感',
    signals: ['guilt'],
    pattern: /(自卑|優越|矛盾|不屑|忽略我|對我好|不敢|比較厲害)/i,
    summarize(message) {
      const details = [];
      if (/(自卑|優越|矛盾)/i.test(message)) details.push('自我形象在自卑與優越感之間擺盪');
      if (/(忽略我|不屑|對我好|不敢)/i.test(message)) details.push('在人際互動中對忽略與善意反應明顯不對稱');
      return details.join('，') || '呈現人際敏感與自我評價矛盾';
    },
    followup: '釐清這種自我評價擺盪與人際防衛是否長期存在，以及對關係造成的影響。'
  },
  {
    key: 'avoidance_trauma',
    label: '迴避、盜汗與惡夢等創傷式反應',
    signals: ['somatic_anxiety', 'insomnia'],
    pattern: /(避開|繞路|盜汗|惡夢|靠近.*盜汗|夢魘)/i,
    summarize(message) {
      const details = [];
      if (/(避開|繞路)/i.test(message)) details.push('為避免接觸特定人事地而明顯改變行動路徑');
      if (/(盜汗|惡夢|夢魘)/i.test(message)) details.push('接近相關刺激時出現自律神經反應與夜間惡夢');
      return details.join('，') || '出現迴避與身體化焦慮反應';
    },
    followup: '釐清是否存在創傷相關經驗、觸發情境與迴避造成的功能代價。'
  },
  {
    key: 'somatic_stress_response',
    label: '壓力相關身體化反應（腹部不適／發冷）',
    signals: ['somatic_anxiety'],
    pattern: /(肚子痛|腹痛|胃痛|腸胃不適|胃不舒服|絞痛|脹氣|噁心|發冷|全身發冷|手腳冰冷|發抖)/i,
    summarize(message) {
      const details = [];
      if (/(肚子痛|腹痛|胃痛|腸胃不適|胃不舒服|絞痛|脹氣|噁心)/i.test(message)) {
        details.push('反覆出現腹部不適或腸胃症狀');
      }
      if (/(發冷|全身發冷|手腳冰冷|發抖)/i.test(message)) {
        details.push('伴隨發冷或自律神經亢進反應');
      }
      return details.join('，') || '出現壓力相關的身體化反應';
    },
    followup: '釐清身體症狀的頻率、持續時間與壓力事件關聯，必要時同步評估身體疾病。'
  },
  {
    key: 'sleep_physical',
    label: '睡眠與生理症狀困擾',
    signals: ['insomnia', 'somatic_anxiety'],
    pattern: /(尿床|呼吸中止|睡眠品質|睡不好|惡夢|夜驚)/i,
    summarize(message) {
      const details = [];
      if (/尿床/i.test(message)) details.push('近期出現令人困擾的夜間排尿失控');
      if (/呼吸中止/i.test(message)) details.push('室友觀察到疑似睡眠呼吸中止');
      if (/(睡眠品質|睡不好|惡夢)/i.test(message)) details.push('整體睡眠品質明顯不佳');
      return details.join('，') || '出現睡眠與生理症狀困擾';
    },
    followup: '建議區分精神症狀與可能的睡眠/生理疾患，必要時轉睡眠或身體檢查。'
  },
  {
    key: 'sleep_schedule',
    label: '作息失調與日夜顛倒',
    signals: ['insomnia'],
    pattern: /(深夜|凌晨|三四點|12點才起床|起不來|作息變得很極端)/i,
    summarize(message) {
      const details = [];
      if (/(深夜|凌晨|三四點)/i.test(message)) details.push('入睡時間明顯延後到凌晨');
      if (/(12點才起床|起不來)/i.test(message)) details.push('白天起床困難並影響日常責任');
      return details.join('，') || '作息明顯延後且影響白天功能';
    },
    followup: '釐清作息顛倒持續多久，以及是否伴隨白天疲倦、缺課或工作受損。'
  },
  {
    key: 'substance_sleep',
    label: '依賴菸酒協助入睡',
    signals: ['insomnia', 'somatic_anxiety'],
    pattern: /(一包.*煙|喝一瓶啤酒|靠.*入睡|菸|啤酒.*入睡)/i,
    summarize(message) {
      const details = [];
      if (/煙/i.test(message)) details.push('需要大量吸菸才能幫助入睡');
      if (/啤酒/i.test(message)) details.push('會以酒精作為入睡輔助');
      return details.join('，') || '出現以物質輔助睡眠的情況';
    },
    followup: '釐清菸酒使用頻率、耐受增加與對睡眠品質的反作用。'
  },
  {
    key: 'work_function',
    label: '工作或日常功能受損',
    signals: ['work_interest', 'retardation'],
    pattern: /(工作|上班|被挨罵|麻煩|功能|影響到我|走三四個小時)/i,
    summarize(message) {
      const details = [];
      if (/(工作|上班|被挨罵)/i.test(message)) details.push('睡眠與情緒問題已影響到工作或日常作息');
      if (/(麻煩|影響到我|走三四個小時)/i.test(message)) details.push('為了迴避刺激付出顯著時間與生活成本');
      return details.join('，') || '已有具體功能受損描述';
    },
    followup: '整理功能受損的範圍、頻率與最受影響的生活領域。'
  }
];

function pushUnique(list, value, limit = 6) {
  const text = String(value || '').trim();
  if (!text || list.includes(text) || list.length >= limit) return;
  list.push(text);
}

function buildSignalCategory(signal) {
  const map = {
    depressed_mood: 'mood',
    guilt: 'self_image',
    work_interest: 'function',
    retardation: 'function',
    agitation: 'arousal',
    somatic_anxiety: 'anxiety',
    insomnia: 'sleep'
  };
  return map[signal] || 'patient_report';
}

function summarizeConcernBundle(chiefConcerns = []) {
  const concerns = normalizeArray(chiefConcerns);
  if (!concerns.length) return '';
  if (concerns.length === 1) return concerns[0];
  if (concerns.length === 2) return `${concerns[0]}，並伴隨${concerns[1]}`;
  return `${concerns[0]}、${concerns[1]}，並延伸到${concerns[2]}`;
}

function buildFunctionalImpactSummary(chiefConcerns = []) {
  const concerns = normalizeArray(chiefConcerns);
  const impacts = [];
  if (concerns.includes('工作或日常功能受損')) impacts.push('情緒與身體反應已對工作或日常安排造成實際干擾');
  if (concerns.includes('作息失調與日夜顛倒')) impacts.push('作息延後與白天起床困難已影響責任履行');
  if (concerns.includes('迴避、盜汗與惡夢等創傷式反應')) impacts.push('迴避特定人事地帶來額外時間成本與行動限制');
  if (concerns.includes('依賴菸酒協助入睡')) impacts.push('為了入睡而依賴菸酒，顯示睡眠調節方式已失衡');
  return impacts.join('；');
}

function buildCareGoalSummary(longitudinal) {
  if (longitudinal.returnVisitGoal) {
    return '使用者希望整理目前症狀、功能受損與就醫重點，供回診或醫療端參考。';
  }
  if (longitudinal.followupNeeds.length) {
    return `下一步建議優先補足：${longitudinal.followupNeeds.slice(0, 2).join('；')}`;
  }
  return '';
}

function isGenericDraftText(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  return GENERIC_DRAFT_PHRASES.some((phrase) => text.includes(phrase));
}

function isPatientAnalysisPlaceholderText(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  const matched = PATIENT_ANALYSIS_PLACEHOLDER_PATTERNS.filter((pattern) => text.includes(pattern)).length;
  return matched >= 2;
}

function isPlaceholderSection(value) {
  const text = String(value || '').trim();
  if (!text) return true;
  return /^待補/.test(text) || /^尚待補充/.test(text) || /仍需補足/.test(text);
}

function hasMeaningfulLongitudinalEvidence(longitudinal = {}) {
  return Boolean(
    normalizeArray(longitudinal.chiefConcerns).length ||
    normalizeArray(longitudinal.symptomObservations).length ||
    normalizeArray(longitudinal.hamdSignals).length ||
    normalizeArray(longitudinal.userMessages).length
  );
}

function isEmptyClinicianDraft(draft = {}) {
  if (!draft || typeof draft !== 'object') return true;
  const chiefConcerns = normalizeArray(draft.chief_concerns).filter((item) => !isPlaceholderSection(item));
  const observations = normalizeArray(draft.symptom_observations).filter((item) => !isGenericDraftText(item));
  const summary = String(draft.draft_summary || '').trim();
  return !chiefConcerns.length && !observations.length && isGenericDraftText(summary);
}

function isEmptyPatientAnalysis(output = {}) {
  if (!output || typeof output !== 'object') return true;
  const summary = String(output.plain_summary || output.markdown || '').trim();
  const keyPoints = normalizeArray(output.key_points);
  return isGenericDraftText(summary) && keyPoints.length === 0;
}

function isEmptyFhirDraft(draft = {}) {
  if (!draft || typeof draft !== 'object') return true;
  const narrative = String(draft.narrative_summary || '').trim();
  const sections = normalizeArray(draft.composition_sections);
  const meaningfulSections = sections.filter((item) => item && !isPlaceholderSection(item.focus));
  const observationCandidates = normalizeArray(draft.observation_candidates);
  const questionnaireTargets = normalizeArray(draft.questionnaire_targets);
  return (
    isPlaceholderSection(narrative) &&
    meaningfulSections.length === 0 &&
    observationCandidates.length === 0 &&
    questionnaireTargets.length === 0
  );
}

function normalizeClinicalNarrativeText(value = '') {
  let text = String(value || '').trim();
  if (!text) return '';
  text = text
    .replace(/\b(?:recent_dialogue|recent_weeks|recent_days|recent_session|current_session|this_session|recent_context)\b/gi, '')
    .replace(/(?:對話中提及\s*){2,}/g, '對話中提及')
    .replace(/^對話中提及\s*[，,;；:：\-]*/g, '')
    .replace(/([。．！？!?])\1+/g, '$1')
    .replace(/[。．！？!?]\s*[。．！？!?]+/g, '$1')
    .replace(/，{2,}/g, '，')
    .replace(/，\s*([。．！？!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^對話中提及\s*對話中提及/, '對話中提及')
    .replace(/^\s*[，。；;:\-]+\s*/g, '')
    .replace(/\s*[，。；;:\-]+\s*$/g, '')
    .trim();
  if (!text) return '';
  if (isPureControlLikeInstruction(text)) return '';
  if (/請幫我準備\s*FHIR\s*草稿|請幫我生成\s*FHIR\s*草稿|請分析我|整理給醫(師|生)/i.test(text) && !hasClinicalNarrativeCue(text)) {
    return '';
  }
  return text;
}

function buildNarrativeFingerprint(value = '') {
  const normalized = normalizeClinicalNarrativeText(value);
  return String(normalized || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。；;:：！？!?'"`~\-]/g, '')
    .trim();
}

function normalizeInferenceTimeframe(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/\b(?:recent_dialogue|recent_weeks|recent_days|recent_session|current_session|this_session|recent_context|recent|latest|current)\b/i.test(raw)) {
    return '近期';
  }
  if (/(today|今日|今天)/i.test(raw)) return '今天';
  if (/(this\s*week|本週|這週)/i.test(raw)) return '本週';
  if (/(this\s*month|本月|這個月)/i.test(raw)) return '本月';
  const normalized = normalizeClinicalNarrativeText(raw);
  if (!normalized) return '';
  if (/^[a-z0-9_\- ]+$/i.test(normalized)) return '';
  return normalized;
}

function sanitizeSymptomEvidenceTrack(track = []) {
  const sanitized = normalizeArray(track).map((item, index) => {
    const evidenceId = String(item?.evidence_id || `evidence_${index + 1}`).trim();
    const sourceText = normalizeClinicalNarrativeText(item?.source_text || item?.quote || '');
    const symptomCandidate = normalizeClinicalNarrativeText(item?.symptom_candidate || item?.symptom_label || '');
    return {
      evidence_id: evidenceId,
      speaker: String(item?.speaker || 'user').trim() || 'user',
      source_text: sourceText,
      symptom_candidate: symptomCandidate,
      category: String(item?.category || 'patient_report').trim() || 'patient_report',
      confidence: String(item?.confidence || 'medium').trim() || 'medium'
    };
  }).filter((item) => item.source_text);
  const deduped = [];
  sanitized.forEach((item) => {
    const sourceFingerprint = buildNarrativeFingerprint(item.source_text);
    if (!sourceFingerprint) return;
    const dedupeKey = `${item.speaker}::${sourceFingerprint}`;
    if (deduped.some((entry) => {
      const entryKey = `${entry.speaker}::${buildNarrativeFingerprint(entry.source_text)}`;
      return entryKey === dedupeKey;
    })) {
      return;
    }
    deduped.push(item);
  });
  return deduped;
}

function sanitizeSymptomInferenceTrack(track = []) {
  const sanitized = normalizeArray(track).map((item) => ({
    symptom_label: normalizeClinicalNarrativeText(item?.symptom_label || item?.label || ''),
    summary: normalizeClinicalNarrativeText(item?.summary || item?.focus || ''),
    category: String(item?.category || 'patient_report').trim() || 'patient_report',
    hamd_signal: String(item?.hamd_signal || item?.signal || '').trim(),
    severity_hint: normalizeClinicalNarrativeText(item?.severity_hint || ''),
    functional_impact: normalizeClinicalNarrativeText(item?.functional_impact || ''),
    timeframe: normalizeInferenceTimeframe(item?.timeframe || ''),
    evidence_refs: uniqueStrings(item?.evidence_refs, 6),
    confidence: String(item?.confidence || 'medium').trim() || 'medium'
  })).filter((item) => item.summary || item.symptom_label);
  const deduped = [];
  sanitized.forEach((item) => {
    const dedupeKey = [
      String(item.hamd_signal || '').trim(),
      buildNarrativeFingerprint(item.symptom_label),
      buildNarrativeFingerprint(item.summary),
      buildNarrativeFingerprint(item.functional_impact),
      normalizeInferenceTimeframe(item.timeframe)
    ].join('::');
    if (deduped.some((entry) => {
      const entryKey = [
        String(entry.hamd_signal || '').trim(),
        buildNarrativeFingerprint(entry.symptom_label),
        buildNarrativeFingerprint(entry.summary),
        buildNarrativeFingerprint(entry.functional_impact),
        normalizeInferenceTimeframe(entry.timeframe)
      ].join('::');
      return entryKey === dedupeKey;
    })) {
      return;
    }
    deduped.push(item);
  });
  return deduped;
}

function sanitizeExcludedMessages(track = []) {
  return normalizeArray(track).map((item) => ({
    text: String(item?.text || item?.content || '').trim(),
    reason: String(item?.reason || 'filtered').trim() || 'filtered'
  })).filter((item) => item.text);
}

const OBSERVATION_REWRITE_RULES = [
  {
    pattern: /(害怕|恐懼|緊張|焦慮|不安|怕)/i,
    observation: '對話內容顯示持續性的焦慮與不安感。',
    concern: '焦慮與不安感持續出現'
  },
  {
    pattern: /(食慾|不想吃|吃不下|沒胃口|美食的欲望|進食)/i,
    observation: '近期出現食慾下降與進食動機減弱。',
    concern: '食慾與身體能量狀態下降'
  },
  {
    pattern: /(不喜歡|不再喜歡|失去興趣|沒興趣|一起吃飯|跟其他人一起|社交|喜歡的事情)/i,
    observation: '原本感興趣的活動參與意願下降，並伴隨社交退縮。',
    concern: '興趣下降並影響社交參與'
  },
  {
    pattern: /(肚子痛|腹痛|胃痛|腸胃不適|胃不舒服|絞痛|脹氣|噁心)/i,
    observation: '在壓力情境下反覆出現腹部不適或腸胃症狀。',
    concern: '壓力相關身體化反應（腸胃）'
  },
  {
    pattern: /(發冷|全身發冷|手腳冰冷|發抖)/i,
    observation: '情緒壓力升高時伴隨發冷或自律神經反應。',
    concern: '壓力相關身體化反應（發冷／自律神經）'
  },
  {
    pattern: /(上台|發表|分數|表現|課堂|報告|同學|老師)/i,
    observation: '在課堂表現與評價情境中出現明顯壓力反應。',
    concern: '學業表現與評價壓力造成負擔'
  },
  {
    pattern: /(沒人理解|理解我|委屈|很難過|孤單|孤獨)/i,
    observation: '反覆提到不被理解，呈現明顯的孤立與委屈感。',
    concern: '人際理解不足帶來孤立感'
  }
];

function stripObservationNoise(value = '') {
  return normalizeClinicalNarrativeText(value)
    .replace(/[；;]+/g, '，')
    .replace(/\s+/g, '')
    .replace(/^(我(覺得|發現|知道|自己)?|現在|最近|以前|另外|可是|而且|只是|就是)+/g, '')
    .replace(/^(對話中提及)+/g, '')
    .replace(/(因為|所以|但是|然後|例如|比如|比方說)/g, '，')
    .replace(/，{2,}/g, '，')
    .replace(/^，+|，+$/g, '')
    .trim();
}

function rewriteObservationText(value = '') {
  const text = stripObservationNoise(value);
  if (!text) return '';
  const matchedRules = OBSERVATION_REWRITE_RULES.filter((rule) => rule.pattern.test(text));
  if (matchedRules.length) {
    return uniqueStrings(matchedRules.map((rule) => rule.observation), 2).join('');
  }

  const normalized = text
    .replace(/^會/, '')
    .replace(/^有/, '')
    .replace(/^在/, '')
    .replace(/^自己/, '')
    .replace(/^(對話中提及)+/g, '')
    .trim();
  if (!normalized) return '';
  return normalizeClinicalNarrativeText(`對話中提及${normalized}。`);
}

function rewriteConcernText(value = '') {
  const text = stripObservationNoise(value);
  if (!text) return '';
  const matchedRules = OBSERVATION_REWRITE_RULES.filter((rule) => rule.pattern.test(text));
  if (matchedRules.length) {
    return uniqueStrings(matchedRules.map((rule) => rule.concern), 2).join('、');
  }
  const normalized = normalizeClinicalNarrativeText(text).replace(/[。！？]+$/g, '').trim();
  return normalized || '';
}

function buildStructuredObservationSet(observations = [], inferenceTrack = [], evidenceTrack = [], limit = 8) {
  const fromInference = sanitizeSymptomInferenceTrack(inferenceTrack).map((item) => {
    const normalizedTimeframe = normalizeInferenceTimeframe(item.timeframe);
    const pieces = [
      normalizedTimeframe ? `${normalizedTimeframe}` : '',
      item.summary || item.symptom_label || '',
      item.functional_impact || ''
    ].filter(Boolean);
    return rewriteObservationText(pieces.join('，'));
  });
  const fromEvidence = sanitizeSymptomEvidenceTrack(evidenceTrack).map((item) => rewriteObservationText(item.source_text));
  const fromObservations = normalizeArray(observations).map((item) => rewriteObservationText(item));
  return uniqueStrings([...fromInference, ...fromEvidence, ...fromObservations].filter(Boolean), limit);
}

function buildStructuredConcernSet(concerns = [], observations = [], evidenceTrack = [], limit = 6) {
  const rewrittenConcerns = normalizeArray(concerns).map((item) => rewriteConcernText(item));
  const inferredConcerns = normalizeArray(observations).map((item) => rewriteConcernText(item));
  const evidenceConcerns = sanitizeSymptomEvidenceTrack(evidenceTrack).map((item) => rewriteConcernText(item.source_text));
  return uniqueStrings([...rewrittenConcerns, ...inferredConcerns, ...evidenceConcerns].filter(Boolean), limit);
}

function buildSymptomBridgeFallback(longitudinal) {
  const evidenceTrack = longitudinal.userMessages.slice(0, 8).map((message, index) => ({
    evidence_id: `user_msg_${index + 1}`,
    speaker: 'user',
    source_text: message,
    symptom_candidate: longitudinal.symptomObservations[index] || longitudinal.chiefConcerns[index] || '',
    category: 'patient_report',
    confidence: 'medium'
  }));
  const inferenceTrack = longitudinal.symptomObservations.slice(0, 6).map((summary, index) => ({
    symptom_label: longitudinal.chiefConcerns[index] || summary,
    summary,
    category: longitudinal.hamdSignals[index] ? buildSignalCategory(longitudinal.hamdSignals[index]) : 'patient_report',
    hamd_signal: longitudinal.hamdSignals[index] || '',
    severity_hint: '',
    functional_impact: '',
    timeframe: '近期',
    evidence_refs: evidenceTrack[index] ? [evidenceTrack[index].evidence_id] : [],
    confidence: 'medium'
  }));
  return {
    bridge_version: 'p1_symptom_bridge_v1',
    evidence_track: evidenceTrack,
    inference_track: inferenceTrack,
    excluded_messages: sanitizeExcludedMessages(longitudinal.excludedMessages)
  };
}

function mergeSymptomBridgeState(baseState, generatedState) {
  const generated = generatedState && typeof generatedState === 'object' ? generatedState : {};
  const evidenceTrack = sanitizeSymptomEvidenceTrack([
    ...normalizeArray(baseState.evidence_track),
    ...normalizeArray(generated.evidence_track)
  ]);
  const uniqueEvidenceTrack = [];
  evidenceTrack.forEach((item) => {
    const dedupeKey = `${item.speaker}::${buildNarrativeFingerprint(item.source_text)}::${buildNarrativeFingerprint(item.symptom_candidate)}`;
    if (!dedupeKey.trim()) return;
    if (uniqueEvidenceTrack.some((entry) => {
      const entryKey = `${entry.speaker}::${buildNarrativeFingerprint(entry.source_text)}::${buildNarrativeFingerprint(entry.symptom_candidate)}`;
      return entryKey === dedupeKey;
    })) return;
    uniqueEvidenceTrack.push(item);
  });

  const inferenceTrack = sanitizeSymptomInferenceTrack([
    ...normalizeArray(baseState.inference_track),
    ...normalizeArray(generated.inference_track)
  ]);
  const uniqueInferenceTrack = [];
  inferenceTrack.forEach((item) => {
    const dedupeKey = `${String(item.hamd_signal || '').trim()}::${buildNarrativeFingerprint(item.symptom_label)}::${buildNarrativeFingerprint(item.summary)}::${buildNarrativeFingerprint(item.functional_impact)}::${normalizeInferenceTimeframe(item.timeframe)}`;
    if (!dedupeKey.trim()) return;
    if (uniqueInferenceTrack.some((entry) => {
      const entryKey = `${String(entry.hamd_signal || '').trim()}::${buildNarrativeFingerprint(entry.symptom_label)}::${buildNarrativeFingerprint(entry.summary)}::${buildNarrativeFingerprint(entry.functional_impact)}::${normalizeInferenceTimeframe(entry.timeframe)}`;
      return entryKey === dedupeKey;
    })) return;
    uniqueInferenceTrack.push(item);
  });
  const excludedMessages = sanitizeExcludedMessages([
    ...normalizeArray(baseState.excluded_messages),
    ...normalizeArray(generated.excluded_messages)
  ]);
  return {
    bridge_version: String(generated.bridge_version || baseState.bridge_version || 'p1_symptom_bridge_v1').trim(),
    evidence_track: uniqueEvidenceTrack,
    inference_track: uniqueInferenceTrack,
    excluded_messages: excludedMessages
  };
}

function applySymptomBridgeToLongitudinal(baseLongitudinal, symptomBridgeState = {}) {
  const evidenceTrack = sanitizeSymptomEvidenceTrack(symptomBridgeState.evidence_track);
  const rawInferenceTrack = sanitizeSymptomInferenceTrack(symptomBridgeState.inference_track);
  const excludedMessages = sanitizeExcludedMessages([
    ...normalizeArray(baseLongitudinal.excludedMessages),
    ...normalizeArray(symptomBridgeState.excluded_messages)
  ]);
  if (!rawInferenceTrack.length) {
    return Object.assign({}, baseLongitudinal, {
      symptomEvidenceTrack: evidenceTrack,
      symptomInferenceTrack: [],
      excludedMessages
    });
  }

  const evidenceById = evidenceTrack.reduce((acc, item) => {
    acc[item.evidence_id] = item;
    return acc;
  }, {});
  const inferenceTrack = rawInferenceTrack
    .map((item) => Object.assign({}, item, {
      evidence_refs: uniqueStrings(
        normalizeArray(item.evidence_refs).filter((ref) => Boolean(evidenceById[String(ref).trim()])),
        6
      )
    }))
    .filter((item) => {
      if (!evidenceTrack.length) return true;
      return item.evidence_refs.length > 0;
    });
  if (!inferenceTrack.length) {
    return Object.assign({}, baseLongitudinal, {
      symptomEvidenceTrack: evidenceTrack,
      symptomInferenceTrack: [],
      excludedMessages
    });
  }
  const aiSymptomObservations = uniqueStrings(inferenceTrack.map((item) => item.summary || item.symptom_label), 8);
  const aiChiefConcerns = uniqueStrings(inferenceTrack.map((item) => item.symptom_label || item.summary), 6);
  const aiHamdSignals = uniqueStrings(inferenceTrack.map((item) => item.hamd_signal).filter(Boolean), 6);
  const aiEvidenceBySignal = {};

  inferenceTrack.forEach((item) => {
    if (!item.hamd_signal) return;
    const linkedEvidence = uniqueStrings(item.evidence_refs.map((ref) => evidenceById[ref]?.source_text).filter(Boolean), 4);
    if (linkedEvidence.length) {
      aiEvidenceBySignal[item.hamd_signal] = linkedEvidence;
    }
  });

  const draftSummary = aiSymptomObservations.length
    ? `AI 已根據原句證據整理出：${aiSymptomObservations.slice(0, 3).join('；')}。`
    : baseLongitudinal.draftSummary;

  return Object.assign({}, baseLongitudinal, {
    chiefConcerns: aiChiefConcerns.length ? aiChiefConcerns : baseLongitudinal.chiefConcerns,
    symptomObservations: aiSymptomObservations.length ? aiSymptomObservations : baseLongitudinal.symptomObservations,
    hamdSignals: aiHamdSignals.length ? aiHamdSignals : baseLongitudinal.hamdSignals,
    evidenceBySignal: Object.keys(aiEvidenceBySignal).length
      ? Object.assign({}, baseLongitudinal.evidenceBySignal, aiEvidenceBySignal)
      : baseLongitudinal.evidenceBySignal,
    draftSummary: chooseStructuredText(draftSummary, baseLongitudinal.draftSummary),
    symptomEvidenceTrack: evidenceTrack,
    symptomInferenceTrack: inferenceTrack,
    excludedMessages
  });
}

function buildLongitudinalEvidence(session, symptomBridgeState = {}) {
  const history = Array.isArray(session?.history) ? session.history : [];
  const classifiedHistory = history.map((item) => Object.assign({}, classifyDraftHistoryItem(item), { item }));
  const userMessages = classifiedHistory
    .filter((entry) => entry.include && entry.role === 'user')
    .map((entry) => entry.content)
    .filter(Boolean)
    .slice(-24);
  const excludedMessages = classifiedHistory
    .filter((entry) => !entry.include && entry.role === 'user' && entry.content)
    .map((entry) => ({ text: entry.content, reason: entry.reason }))
    .slice(-12);

  const chiefConcerns = [];
  const symptomObservations = [];
  const hamdSignals = [];
  const evidenceMap = new Map();
  const followupNeeds = [];
  const riskFlags = [];
  const matchedRuleKeys = [];

  userMessages.forEach((message) => {
    CLINICAL_SIGNAL_RULES.forEach((rule) => {
      if (!rule.pattern.test(message)) return;
      pushUnique(matchedRuleKeys, rule.key, 10);
      pushUnique(chiefConcerns, rule.label, 6);
      rule.signals.forEach((signal) => pushUnique(hamdSignals, signal, 8));
      pushUnique(symptomObservations, rule.summarize(message), 10);
      pushUnique(followupNeeds, rule.followup, 6);
      rule.signals.forEach((signal) => {
        if (!evidenceMap.has(signal)) {
          evidenceMap.set(signal, []);
        }
        pushUnique(evidenceMap.get(signal), rule.summarize(message), 3);
      });
    });
    if (/(不想活|想死|自傷|傷害自己|想消失)/i.test(message)) {
      pushUnique(riskFlags, '對話中出現需進一步釐清的自傷或消失念頭線索。', 3);
    }
  });

  const hasReturnVisitGoal = userMessages.some((message) => /(回診|看診|醫師|醫生)/i.test(message));
  const tone = chiefConcerns.includes('持續低落、空虛或失去意義感')
    ? 'low_energy_distressed'
    : chiefConcerns.includes('迴避、盜汗與惡夢等創傷式反應')
      ? 'distressed'
      : 'guarded';

  const draftSummaryParts = [];
  if (chiefConcerns.length) {
    draftSummaryParts.push(`本次對話主要聚焦於${chiefConcerns.slice(0, 3).join('、')}。`);
  }
  if (symptomObservations.length) {
    draftSummaryParts.push(`具體表現包括${symptomObservations.slice(0, 2).join('；')}。`);
  }
  if (hasReturnVisitGoal) {
    draftSummaryParts.push('使用者明確提到回診或醫療整理需求。');
  }
  if (hamdSignals.length) {
    draftSummaryParts.push(`目前已觸及的 HAM-D 線索包含 ${hamdSignals.slice(0, 4).join('、')}。`);
  }

  return applySymptomBridgeToLongitudinal({
    userMessages,
    matchedRuleKeys,
    chiefConcerns,
    symptomObservations,
    hamdSignals,
    evidenceBySignal: Object.fromEntries(evidenceMap),
    followupNeeds,
    riskFlags,
    returnVisitGoal: hasReturnVisitGoal,
    patientTone: tone,
    draftSummary: draftSummaryParts.join(' ').trim(),
    excludedMessages,
    symptomEvidenceTrack: [],
    symptomInferenceTrack: []
  }, symptomBridgeState);
}

function enrichHamdProgressState(progress, longitudinal) {
  const next = progress && typeof progress === 'object' ? Object.assign({}, progress) : {};
  const coveredDimensions = longitudinal.hamdSignals
    .filter((item, index, arr) => item && arr.indexOf(item) === index && HAMD_PROGRESS_DIMENSIONS.includes(item))
    .slice(0, HAMD_PROGRESS_DIMENSIONS.length);
  next.covered_dimensions = coveredDimensions;
  next.supported_dimensions = coveredDimensions;
  next.missing_dimensions = HAMD_PROGRESS_DIMENSIONS.filter((item) => !coveredDimensions.includes(item));
  next.recent_evidence = longitudinal.symptomObservations.slice(0, 8);
  next.current_focus = coveredDimensions[0] || next.current_focus || 'depressed_mood';
  if (coveredDimensions.length >= 5) {
    next.progress_stage = 'advanced';
  } else if (coveredDimensions.length >= 3) {
    next.progress_stage = 'focused';
  } else if (coveredDimensions.length >= 1) {
    next.progress_stage = 'initial';
  } else {
    next.progress_stage = next.progress_stage || 'initial';
  }
  // ⚠️ 移除硬編碼 somatic_anxiety→guilt 規則（會讓系統卡在罪惡感）
  // next_recommended_dimension 交給 LLM tracker 的優先規則決定
  if (coveredDimensions.includes('insomnia') && !coveredDimensions.includes('work_interest')) {
    next.next_recommended_dimension = 'work_interest';
  } else {
    next.next_recommended_dimension = coveredDimensions[1] || coveredDimensions[0] || next.next_recommended_dimension || 'depressed_mood';
  }
  if (!String(next.status_summary || '').trim()) {
    if (!coveredDimensions.length) {
      next.status_summary = '尚未收斂出足夠的 HAM-D 維度線索。';
    } else {
      next.status_summary = `目前已收斂 ${coveredDimensions.length}/${HAMD_PROGRESS_DIMENSIONS.length} 個 HAM-D 維度。`;
    }
  }
  return next;
}

function buildSummaryDraftState(state, longitudinal, message = '') {
  const redFlags = normalizeObjectState(state, 'red_flag_payload', {});
  const latestTags = normalizeObjectState(state, 'latest_tag_payload', {});
  const progress = normalizeObjectState(state, 'hamd_progress_state', {});
  const phq9 = buildPhq9AssessmentSummary(normalizeObjectState(state, 'phq9_assessment', {}));
  const draftSummary = !isGenericDraftText(longitudinal.draftSummary)
    ? longitudinal.draftSummary
    : String(message || '').trim() || phq9.phq9_summary;

  return {
    active_mode: state.active_mode,
    risk_flag: state.risk_flag,
    followup_status: state.followup_status,
    latest_tags: latestTags,
    red_flags: redFlags,
    hamd_progress: progress,
    phq9_assessment: phq9.phq9_assessment,
    phq9_total_score: phq9.phq9_total_score,
    phq9_severity_band: phq9.phq9_severity_band,
    phq9_severity_label: phq9.phq9_severity_label,
    phq9_summary: phq9.phq9_summary,
    phq9_completed_at: phq9.phq9_completed_at,
    phq9_answer_count: phq9.phq9_answer_count,
    phq9_narrative_count: phq9.phq9_narrative_count,
    phq9_answers: phq9.phq9_answers,
    draft_summary: draftSummary || phq9.phq9_summary
  };
}

function buildPatientReviewPacket(clinicianDraft) {
  const concerns = normalizeArray(clinicianDraft.chief_concerns).slice(0, 4);
  const followupNeeds = normalizeArray(clinicianDraft.followup_needs).slice(0, 3);
  const confirmItems = Array.from(new Set([
    ...concerns.map((item) => `主要困擾是否包含：${item}`),
    ...followupNeeds.map((item) => `後續需補充：${item}`)
  ])).slice(0, 5);

  return {
    packet_version: 'p3_patient_review_v1',
    status: 'draft_review',
    patient_facing_summary: clinicianDraft.draft_summary || '已依照目前對話整理出可供審閱的重點。',
    confirm_items: confirmItems,
    editable_items: [],
    remove_if_wrong: [],
    authorization_needed: 'yes',
    authorization_prompt: '請先確認整理內容是否正確，再決定是否提供給醫師。'
  };
}

function buildPatientAuthorizationState(clinicianDraft, patientReviewPacket) {
  const reviewBlockers = [];
  if (isEmptyClinicianDraft(clinicianDraft)) {
    reviewBlockers.push('目前整理內容仍不足，尚未適合直接提供給醫師。');
  }
  reviewBlockers.push('病人需要確認對話內容的正確性');

  return {
    state_version: 'p3_authorization_state_v1',
    authorization_status: 'review_required',
    share_with_clinician: 'no',
    review_blockers: Array.from(new Set(reviewBlockers)),
    patient_actions: [
      '確認整理的內容是否正確',
      '授權醫師查看資訊'
    ],
    restricted_sections: [],
    consent_note: patientReviewPacket.authorization_prompt || '請在審閱後授權我們將這些資訊提供給你的醫師。'
  };
}

function buildDeliveryReadinessState(fhirDraft, patientAuthorizationState) {
  const blockers = normalizeArray(patientAuthorizationState.review_blockers);
  return {
    state_version: 'p3_delivery_readiness_v1',
    readiness_status: 'ready_for_backend_mapping',
    primary_blockers: blockers.length ? blockers : ['病人尚未完成審閱或同意'],
    next_step: '請病人審閱並確認內容後授權醫師查看資訊。',
    provenance_requirements: [
      '病人對話內容的確認',
      '病人授權醫師查看資訊'
    ],
    handoff_note: isEmptyFhirDraft(fhirDraft)
      ? 'FHIR 草稿仍需依對話重新整理後再送出。'
      : '請病人確認內容後再進行下一步。'
  };
}

function chooseStructuredText(candidate, fallback) {
  const candidateText = String(candidate || '').trim();
  if (!candidateText || isGenericDraftText(candidateText) || isPlaceholderSection(candidateText)) {
    return String(fallback || '').trim();
  }
  return candidateText;
}

function mergeUniqueTexts(primary, secondary, limit = 8) {
  const merged = [];
  [...normalizeArray(primary), ...normalizeArray(secondary)].forEach((item) => {
    const text = String(item || '').trim();
    if (!text || merged.includes(text) || merged.length >= limit) return;
    merged.push(text);
  });
  return merged;
}

function normalizeClinicianObservationItems(primary, secondary, evidenceTrack, limit = 8) {
  return buildStructuredObservationSet(
    mergeUniqueTexts(primary, secondary, limit),
    [],
    evidenceTrack,
    limit
  );
}

function normalizeClinicianConcernItems(primary, secondary, observations, evidenceTrack, limit = 6) {
  return buildStructuredConcernSet(
    mergeUniqueTexts(primary, secondary, limit),
    observations,
    evidenceTrack,
    limit
  );
}

function normalizeFhirCompositionSections(sections = []) {
  return normalizeArray(sections)
    .map((section) => ({
      section: String(section?.section || '').trim(),
      focus: normalizeClinicalNarrativeText(section?.focus || '')
    }))
    .filter((section) => section.section && section.focus && !isPlaceholderSection(section.focus));
}

function normalizeObservationCandidates(candidates = [], evidenceTrack = []) {
  return normalizeArray(candidates)
    .map((candidate) => ({
      focus: rewriteObservationText(candidate?.focus || ''),
      category: String(candidate?.category || 'patient_report').trim() || 'patient_report',
      signal: String(candidate?.signal || '').trim(),
      status: String(candidate?.status || 'preliminary').trim() || 'preliminary',
      evidence_refs: uniqueStrings(candidate?.evidence_refs, 6),
      inference_basis: normalizeClinicalNarrativeText(candidate?.inference_basis || '')
    }))
    .filter((candidate) => candidate.focus)
    .slice(0, 8);
}

function normalizeQuestionnaireTargets(targets = []) {
  return normalizeArray(targets)
    .map((target) => {
      if (typeof target === 'string') {
        const text = String(target).trim();
        if (!text) return '';
        const [label, detail] = text.split('：');
        const normalizedDetail = rewriteObservationText(detail || label || '');
        return normalizedDetail ? `${label || '觀察'}：${normalizedDetail}` : '';
      }
      const dimension = String(target?.dimension || '').trim();
      const reason = rewriteObservationText(target?.reason || '');
      if (!dimension || !reason) return '';
      return `${dimension}：${reason}`;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function mergeSummaryDraftState(baseDraft, generatedDraft) {
  const generated = generatedDraft && typeof generatedDraft === 'object' ? generatedDraft : {};
  return Object.assign({}, baseDraft, generated, {
    latest_tags: generated.latest_tags && typeof generated.latest_tags === 'object' ? generated.latest_tags : baseDraft.latest_tags,
    red_flags: generated.red_flags && typeof generated.red_flags === 'object' ? generated.red_flags : baseDraft.red_flags,
    hamd_progress: generated.hamd_progress && typeof generated.hamd_progress === 'object' ? generated.hamd_progress : baseDraft.hamd_progress,
    draft_summary: chooseStructuredText(generated.draft_summary, baseDraft.draft_summary)
  });
}

function mergeClinicianSummaryDraft(baseDraft, generatedDraft, formalAssessment) {
  const generated = generatedDraft && typeof generatedDraft === 'object' ? generatedDraft : {};
  const evidenceTrack = sanitizeSymptomEvidenceTrack([
    ...normalizeArray(baseDraft.symptom_evidence_track),
    ...normalizeArray(generated.symptom_evidence_track)
  ]);
  const inferenceTrack = sanitizeSymptomInferenceTrack([
    ...normalizeArray(baseDraft.symptom_inference_track),
    ...normalizeArray(generated.symptom_inference_track)
  ]);
  const normalizedObservations = normalizeClinicianObservationItems(
    baseDraft.symptom_observations,
    generated.symptom_observations,
    evidenceTrack,
    8
  );
  const normalizedConcerns = normalizeClinicianConcernItems(
    baseDraft.chief_concerns,
    generated.chief_concerns,
    normalizedObservations,
    evidenceTrack,
    6
  );
  const merged = Object.assign({}, baseDraft, generated, {
    chief_concerns: normalizedConcerns,
    symptom_observations: normalizedObservations,
    hamd_signals: mergeUniqueTexts(baseDraft.hamd_signals, generated.hamd_signals, 6),
    followup_needs: mergeUniqueTexts(baseDraft.followup_needs, generated.followup_needs, 5),
    safety_flags: mergeUniqueTexts(baseDraft.safety_flags, generated.safety_flags, 4),
    draft_summary: chooseStructuredText(generated.draft_summary, baseDraft.draft_summary),
    patient_tone: String(generated.patient_tone || '').trim() || baseDraft.patient_tone,
    hamd_item_scores: normalizeArray(generated.hamd_item_scores).length ? normalizeArray(generated.hamd_item_scores) : normalizeArray(baseDraft.hamd_item_scores),
    hamd_evidence_table: normalizeArray(generated.hamd_evidence_table).length ? normalizeArray(generated.hamd_evidence_table) : normalizeArray(baseDraft.hamd_evidence_table),
    hamd_review_required_items: normalizeArray(generated.hamd_review_required_items).length
      ? normalizeArray(generated.hamd_review_required_items)
      : normalizeArray(baseDraft.hamd_review_required_items),
    hamd_total_score_ai: typeof generated.hamd_total_score_ai === 'number' ? generated.hamd_total_score_ai : baseDraft.hamd_total_score_ai,
    hamd_total_score_clinician: typeof generated.hamd_total_score_clinician === 'number' ? generated.hamd_total_score_clinician : baseDraft.hamd_total_score_clinician,
    hamd_severity_band: String(generated.hamd_severity_band || '').trim() || baseDraft.hamd_severity_band,
    symptom_evidence_track: evidenceTrack,
    symptom_inference_track: inferenceTrack
  });
  return Object.assign({}, merged, buildFormalClinicianFields(formalAssessment), {
    chief_concerns: merged.chief_concerns.length ? merged.chief_concerns : normalizeArray(baseDraft.chief_concerns),
    symptom_observations: merged.symptom_observations.length ? merged.symptom_observations : normalizeArray(baseDraft.symptom_observations)
  });
}

function mergePatientReviewPacket(basePacket, generatedPacket) {
  const generated = generatedPacket && typeof generatedPacket === 'object' ? generatedPacket : {};
  return Object.assign({}, basePacket, generated, {
    patient_facing_summary: chooseStructuredText(generated.patient_facing_summary, basePacket.patient_facing_summary),
    confirm_items: mergeUniqueTexts(basePacket.confirm_items, generated.confirm_items, 6),
    editable_items: normalizeArray(generated.editable_items).length ? normalizeArray(generated.editable_items) : normalizeArray(basePacket.editable_items),
    remove_if_wrong: normalizeArray(generated.remove_if_wrong).length ? normalizeArray(generated.remove_if_wrong) : normalizeArray(basePacket.remove_if_wrong),
    authorization_prompt: chooseStructuredText(generated.authorization_prompt, basePacket.authorization_prompt)
  });
}

function normalizeDecisionToken(value) {
  return String(value == null ? '' : value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function isAuthorizationStatusAllowingShare(status) {
  const token = normalizeDecisionToken(status);
  return [
    'authorized',
    'ready_for_consent',
    'patient_authorized_manual_submit',
    'consented',
    'share_allowed',
    'approved',
    'allow_share'
  ].includes(token);
}

function normalizeShareWithClinicianValue(value, authorizationStatus, fallback = 'no') {
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }

  const raw = String(value == null ? '' : value).trim();
  const token = normalizeDecisionToken(raw);
  const allowTokens = new Set([
    'yes',
    'y',
    'true',
    '1',
    'allow',
    'allowed',
    'authorized',
    'approved',
    'consented',
    'share_allowed'
  ]);
  const denyTokens = new Set([
    'no',
    'n',
    'false',
    '0',
    'deny',
    'denied',
    'blocked',
    'rejected',
    'disallow'
  ]);

  if (allowTokens.has(token)) return 'yes';
  if (denyTokens.has(token)) return 'no';

  if (raw) {
    if (/不同意|拒絕|不允許/.test(raw)) return 'no';
    if (/同意|允許|可以/.test(raw)) return 'yes';
  }

  if (isAuthorizationStatusAllowingShare(authorizationStatus)) {
    return 'yes';
  }
  return fallback === 'yes' ? 'yes' : 'no';
}

function normalizeReadinessStatusValue(value, shareWithClinician, fallback = 'ready_for_backend_mapping') {
  if (typeof value === 'boolean') {
    return value ? 'ready_for_backend_mapping' : 'blocked';
  }
  const token = normalizeDecisionToken(value);
  if (!token) {
    return shareWithClinician === 'yes' ? 'ready_for_backend_mapping' : fallback;
  }

  const readyTokens = new Set([
    'ready_for_backend_mapping',
    'ready_for_mapping',
    'ready_for_delivery',
    'ready_to_deliver',
    'ready_to_export',
    'ready_for_handoff',
    'ready',
    'deliverable'
  ]);
  const blockedTokens = new Set([
    'blocked',
    'not_ready',
    'review_required',
    'pending',
    'pending_review',
    'hold',
    'waiting_for_consent',
    'wait_for_consent'
  ]);

  if (readyTokens.has(token)) return 'ready_for_backend_mapping';
  if (blockedTokens.has(token)) return 'blocked';
  return shareWithClinician === 'yes' ? 'ready_for_backend_mapping' : fallback;
}

function mergePatientAuthorizationState(baseState, generatedState) {
  const generated = generatedState && typeof generatedState === 'object' ? generatedState : {};
  const authorizationStatus = String(generated.authorization_status || '').trim() || baseState.authorization_status;
  const shareWithClinician = normalizeShareWithClinicianValue(
    Object.prototype.hasOwnProperty.call(generated, 'share_with_clinician') ? generated.share_with_clinician : '',
    authorizationStatus,
    baseState.share_with_clinician
  );
  return Object.assign({}, baseState, generated, {
    review_blockers: mergeUniqueTexts(baseState.review_blockers, generated.review_blockers, 6),
    patient_actions: mergeUniqueTexts(baseState.patient_actions, generated.patient_actions, 6),
    consent_note: chooseStructuredText(generated.consent_note, baseState.consent_note),
    share_with_clinician: shareWithClinician,
    authorization_status: authorizationStatus
  });
}

function mergeFhirDeliveryDraft(baseDraft, generatedDraft) {
  const generated = generatedDraft && typeof generatedDraft === 'object' ? generatedDraft : {};
  const evidenceTrack = sanitizeSymptomEvidenceTrack([
    ...normalizeArray(baseDraft.symptom_evidence_track),
    ...normalizeArray(generated.symptom_evidence_track)
  ]);
  const mergedSections = normalizeFhirCompositionSections(
    Array.isArray(baseDraft.composition_sections)
      ? baseDraft.composition_sections.map((section, index) => {
          const generatedSection = normalizeArray(generated.composition_sections)[index] || {};
          return {
            section: section.section,
            focus: chooseStructuredText(generatedSection.focus, section.focus)
          };
        })
      : []
  );
  const observationCandidates = normalizeObservationCandidates(
    normalizeArray(generated.observation_candidates).length
      ? generated.observation_candidates
      : baseDraft.observation_candidates,
    evidenceTrack
  );
  const questionnaireTargets = normalizeQuestionnaireTargets(
    normalizeArray(generated.questionnaire_targets).length
      ? generated.questionnaire_targets
      : baseDraft.questionnaire_targets
  );
  const phq9QuestionnaireTargets = normalizeArray(baseDraft.phq9_questionnaire_targets).length
    ? normalizeArray(baseDraft.phq9_questionnaire_targets)
    : normalizeArray(generated.phq9_questionnaire_targets);
  const narrativeSummaryRaw = chooseStructuredText(generated.narrative_summary, baseDraft.narrative_summary);
  const narrativeSummary = normalizeClinicalNarrativeText(narrativeSummaryRaw) || narrativeSummaryRaw;
  const clinicalAlerts = mergeUniqueTexts(baseDraft.clinical_alerts, generated.clinical_alerts, 6);
  const exportBlockers = mergeUniqueTexts(baseDraft.export_blockers, generated.export_blockers, 6);
  const notesRaw = chooseStructuredText(generated.notes, baseDraft.notes);
  const notes = normalizeClinicalNarrativeText(notesRaw) || notesRaw;

  return Object.assign({}, baseDraft, generated, {
    narrative_summary: narrativeSummary,
    composition_sections: mergedSections.length ? mergedSections : normalizeArray(baseDraft.composition_sections),
    observation_candidates: observationCandidates,
    questionnaire_targets: questionnaireTargets,
    phq9_questionnaire_targets: phq9QuestionnaireTargets,
    clinical_alerts: clinicalAlerts,
    export_blockers: exportBlockers,
    notes,
    hamd_formal_targets: normalizeArray(generated.hamd_formal_targets).length
      ? normalizeArray(generated.hamd_formal_targets)
      : normalizeArray(baseDraft.hamd_formal_targets),
    resources: buildControlledFhirResourceList({
      includeQuestionnaire: questionnaireTargets.length || phq9QuestionnaireTargets.length || normalizeArray(baseDraft.hamd_formal_targets).length,
      includeObservation: observationCandidates.length,
      includeClinicalImpression: clinicalAlerts.length || String(narrativeSummary || '').trim() || mergedSections.length,
      includeDocumentReference: String(narrativeSummary || '').trim() || String(notes || '').trim()
    }),
    symptom_evidence_track: evidenceTrack,
    symptom_inference_track: sanitizeSymptomInferenceTrack([
      ...normalizeArray(baseDraft.symptom_inference_track),
      ...normalizeArray(generated.symptom_inference_track)
    ])
  });
}

function mergeDeliveryReadinessState(baseState, generatedState) {
  const generated = generatedState && typeof generatedState === 'object' ? generatedState : {};
  const shareWithClinician = normalizeShareWithClinicianValue(
    baseState.share_with_clinician,
    baseState.authorization_status,
    baseState.share_with_clinician
  );
  return Object.assign({}, baseState, generated, {
    readiness_status: normalizeReadinessStatusValue(
      generated.readiness_status,
      shareWithClinician,
      baseState.readiness_status
    ),
    primary_blockers: mergeUniqueTexts(baseState.primary_blockers, generated.primary_blockers, 6),
    next_step: chooseStructuredText(generated.next_step, baseState.next_step),
    provenance_requirements: mergeUniqueTexts(baseState.provenance_requirements, generated.provenance_requirements, 6),
    handoff_note: chooseStructuredText(generated.handoff_note, baseState.handoff_note)
  });
}

function buildClinicianSummaryDraft(longitudinal, state, formalAssessment, previousDraft = {}) {
  const reviewFlags = normalizeArray(formalAssessment.review_flags);
  const explicitRiskFlags = normalizeArray(normalizeObjectState(state, 'red_flag_payload', {}).warning_tags);
  const riskLevel = longitudinal.riskFlags.length || explicitRiskFlags.length
    ? 'watch'
    : 'none';
  const phq9 = buildPhq9AssessmentSummary(normalizeObjectState(state, 'phq9_assessment', {}));
  const structuredObservations = buildStructuredObservationSet(
    longitudinal.symptomObservations,
    longitudinal.symptomInferenceTrack,
    longitudinal.symptomEvidenceTrack,
    8
  );
  const structuredConcerns = buildStructuredConcernSet(
    longitudinal.chiefConcerns,
    structuredObservations,
    longitudinal.symptomEvidenceTrack,
    6
  );

  return Object.assign(
    {
      summary_version: 'p3_clinician_draft_v3',
      active_mode: state.active_mode,
      risk_level: riskLevel,
      chief_concerns: structuredConcerns.length ? structuredConcerns : longitudinal.chiefConcerns.slice(0, 6),
      symptom_observations: structuredObservations.length
        ? structuredObservations
        : longitudinal.symptomObservations.filter((item) => !isGenericDraftText(item)).slice(0, 8),
      symptom_evidence_track: sanitizeSymptomEvidenceTrack(longitudinal.symptomEvidenceTrack).slice(0, 8),
      symptom_inference_track: sanitizeSymptomInferenceTrack(longitudinal.symptomInferenceTrack).slice(0, 8),
      hamd_signals: longitudinal.hamdSignals.slice(0, 6),
      followup_needs: longitudinal.followupNeeds.slice(0, 5),
      safety_flags: [...longitudinal.riskFlags, ...explicitRiskFlags].slice(0, 4),
      patient_tone: longitudinal.patientTone,
      draft_summary: longitudinal.draftSummary || phq9.phq9_summary || '已根據整段對話整理出主要症狀、功能影響與後續釐清方向。',
      phq9_assessment: phq9.phq9_assessment,
      phq9_total_score: phq9.phq9_total_score,
      phq9_severity_band: phq9.phq9_severity_band,
      phq9_severity_label: phq9.phq9_severity_label,
      phq9_summary: phq9.phq9_summary,
      phq9_completed_at: phq9.phq9_completed_at,
      phq9_answer_count: phq9.phq9_answer_count,
      phq9_narrative_count: phq9.phq9_narrative_count,
      phq9_answers: phq9.phq9_answers,
      phq9_questionnaire_targets: phq9.phq9_questionnaire_targets
    },
    buildFormalClinicianFields(formalAssessment),
    previousDraft && typeof previousDraft === 'object'
      ? {
          hamd_item_scores: normalizeArray(previousDraft.hamd_item_scores),
          hamd_evidence_table: normalizeArray(previousDraft.hamd_evidence_table),
          hamd_review_required_items: reviewFlags.length ? reviewFlags : normalizeArray(previousDraft.hamd_review_required_items),
          hamd_total_score_ai: typeof previousDraft.hamd_total_score_ai === 'number' ? previousDraft.hamd_total_score_ai : 0,
          hamd_total_score_clinician: typeof previousDraft.hamd_total_score_clinician === 'number' ? previousDraft.hamd_total_score_clinician : null,
          hamd_severity_band: previousDraft.hamd_severity_band || 'unrated'
        }
      : {}
  );
}

function buildFhirDeliveryDraft(clinicianDraft, longitudinal, state, formalAssessment) {
  const phq9 = buildPhq9AssessmentSummary(normalizeObjectState(state, 'phq9_assessment', {}));
  const symptomObservations = buildStructuredObservationSet(
    normalizeArray(longitudinal?.symptomObservations).length
      ? normalizeArray(longitudinal.symptomObservations)
      : normalizeArray(clinicianDraft?.symptom_observations),
    normalizeArray(longitudinal?.symptomInferenceTrack).length
      ? longitudinal.symptomInferenceTrack
      : clinicianDraft?.symptom_inference_track,
    normalizeArray(longitudinal?.symptomEvidenceTrack).length
      ? longitudinal.symptomEvidenceTrack
      : clinicianDraft?.symptom_evidence_track,
    8
  );
  const symptomEvidenceTrack = sanitizeSymptomEvidenceTrack(
    normalizeArray(longitudinal?.symptomEvidenceTrack).length
      ? longitudinal.symptomEvidenceTrack
      : clinicianDraft?.symptom_evidence_track
  );
  const symptomInferenceTrack = sanitizeSymptomInferenceTrack(
    normalizeArray(longitudinal?.symptomInferenceTrack).length
      ? longitudinal.symptomInferenceTrack
      : clinicianDraft?.symptom_inference_track
  );
  const hamdSignals = normalizeArray(longitudinal?.hamdSignals).length
    ? normalizeArray(longitudinal.hamdSignals)
    : normalizeArray(clinicianDraft?.hamd_signals);
  const chiefConcerns = buildStructuredConcernSet(
    normalizeArray(longitudinal?.chiefConcerns).length
      ? normalizeArray(longitudinal.chiefConcerns)
      : normalizeArray(clinicianDraft?.chief_concerns),
    symptomObservations,
    normalizeArray(longitudinal?.symptomEvidenceTrack).length
      ? longitudinal.symptomEvidenceTrack
      : clinicianDraft?.symptom_evidence_track,
    6
  );
  const evidenceBySignal = longitudinal.evidenceBySignal && typeof longitudinal.evidenceBySignal === 'object'
    ? longitudinal.evidenceBySignal
    : {};
  const observationCandidates = symptomInferenceTrack.length
    ? symptomInferenceTrack.map((item) => ({
        focus: rewriteObservationText(item.summary || item.symptom_label),
        category: item.category || buildSignalCategory(item.hamd_signal),
        signal: item.hamd_signal || '',
        status: 'preliminary',
        evidence_refs: uniqueStrings(item.evidence_refs, 6),
        inference_basis: item.symptom_label || item.summary
      }))
    : hamdSignals.map((signal) => ({
        focus: (evidenceBySignal[signal] || []).join('；') || `已捕捉 ${signal} 相關對話線索`,
        category: buildSignalCategory(signal),
        signal,
        status: 'preliminary',
        evidence_refs: [],
        inference_basis: signal
      }));
  symptomObservations.forEach((item) => {
    if (observationCandidates.length >= 8) return;
    if (observationCandidates.some((entry) => entry.focus === item)) return;
    observationCandidates.push({
      focus: item,
      category: 'patient_report',
      signal: '',
      status: 'preliminary',
      evidence_refs: [],
      inference_basis: item
    });
  });
  const questionnaireTargets = symptomInferenceTrack.length
    ? symptomInferenceTrack.map((item) => {
        const label = item.hamd_signal || item.symptom_label || item.summary;
        const summary = rewriteObservationText(item.summary || item.symptom_label);
        return summary ? `${label}：${summary}` : '';
      }).filter(Boolean).slice(0, 8)
    : hamdSignals.map((signal) => ({
        dimension: signal,
        reason: (evidenceBySignal[signal] || []).join('；') || `需補足 ${signal} 的正式量表資訊`
      })).filter((item) => item.reason);
  const phq9QuestionnaireTargets = normalizeArray(phq9.phq9_questionnaire_targets).map((item) => ({
    item_code: item.item_code,
    item_label: item.item_label,
    score: item.score,
    narrative: item.narrative,
    status: item.status
  }));

  const narrativeSummaryRaw = hasMeaningfulLongitudinalEvidence(longitudinal)
    ? (longitudinal.draftSummary || clinicianDraft?.draft_summary || summarizeConcernBundle(chiefConcerns))
    : '';
  const narrativeSummary = normalizeClinicalNarrativeText(narrativeSummaryRaw) || narrativeSummaryRaw;

  const compositionSections = [];
  if (chiefConcerns.length) {
    compositionSections.push({
      section: 'chief_concerns',
      focus: summarizeConcernBundle(chiefConcerns)
    });
  }
  if (symptomObservations.length) {
    compositionSections.push({
      section: 'symptom_timeline',
      focus: symptomObservations.slice(0, 3).join('；')
    });
  }
  const functionalImpact = buildFunctionalImpactSummary(chiefConcerns) || longitudinal.followupNeeds[0] || '';
  if (functionalImpact) {
    compositionSections.push({
      section: 'functional_impact',
      focus: functionalImpact
    });
  }
  const careGoal = hasMeaningfulLongitudinalEvidence(longitudinal) ? buildCareGoalSummary(longitudinal) : '';
  if (careGoal) {
    compositionSections.push({
      section: 'care_goal',
      focus: careGoal
    });
  }

  const hasClinicalImpressionContent = Boolean(
    narrativeSummary
    || chiefConcerns.length
    || symptomObservations.length
    || phq9QuestionnaireTargets.length
    || normalizeArray(normalizeObjectState(state, 'red_flag_payload', {}).warning_tags).length
  );

  const resources = buildControlledFhirResourceList({
    includeQuestionnaire: questionnaireTargets.length || phq9QuestionnaireTargets.length || normalizeArray(buildFormalFhirTargets(formalAssessment)).length,
    includeObservation: observationCandidates.length,
    includeClinicalImpression: hasClinicalImpressionContent,
    includeDocumentReference: narrativeSummary
  });

  const formalTargets = buildFormalFhirTargets(formalAssessment);
  const clinicalAlerts = [...longitudinal.riskFlags, ...normalizeArray(normalizeObjectState(state, 'red_flag_payload', {}).warning_tags)].slice(0, 4);
  const exportBlockers = normalizeArray(normalizeObjectState(state, 'patient_authorization_state', {}).review_blockers);

  return {
    draft_version: 'p5_fhir_delivery_v3',
    delivery_status: 'pre_review_or_ready_for_mapping_orblocked',
    consent_gate: 'review_required_or_ready_for_consent_orblocked',
    narrative_summary: narrativeSummary,
    phq9_assessment: phq9.phq9_assessment,
    phq9_total_score: phq9.phq9_total_score,
    phq9_severity_band: phq9.phq9_severity_band,
    phq9_severity_label: phq9.phq9_severity_label,
    phq9_summary: phq9.phq9_summary,
    phq9_completed_at: phq9.phq9_completed_at,
    phq9_answers: phq9.phq9_answers,
    phq9_questionnaire_targets: phq9QuestionnaireTargets,
    resources,
    composition_sections: compositionSections,
    observation_candidates: observationCandidates,
    symptom_evidence_track: symptomEvidenceTrack,
    symptom_inference_track: symptomInferenceTrack,
    clinical_alerts: clinicalAlerts,
    questionnaire_targets: [...questionnaireTargets, ...phq9QuestionnaireTargets],
    hamd_formal_targets: formalTargets,
    patient_review_required: 'yes',
    export_blockers: exportBlockers,
    notes: normalizeClinicalNarrativeText(longitudinal.draftSummary || phq9.phq9_summary || '')
  };
}

function buildPatientAnalysis(state, fallbackMessage = '') {
  const clinician = normalizeObjectState(state, 'clinician_summary_draft', {});
  const patientReview = normalizeObjectState(state, 'patient_review_packet', {});
  const latestTags = normalizeObjectState(state, 'latest_tag_payload', {});
  const burden = normalizeObjectState(state, 'burden_level_state', {});
  const hamdProgress = normalizeObjectState(state, 'hamd_progress_state', {});
  const therapeuticProfile = normalizeObjectState(state, 'therapeutic_profile', {});
  const symptomBridge = normalizeObjectState(state, 'symptom_bridge_state', {});
  const phq9 = buildPhq9AssessmentSummary(normalizeObjectState(state, 'phq9_assessment', {}));
  const conversationEvidence = sanitizeSymptomEvidenceTrack(symptomBridge.evidence_track)
    .map((item) => String(item.source_text || '').trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .slice(0, 3);
  const evidenceHighlights = conversationEvidence.map((item) => {
    const clipped = item.length > 38 ? `${item.slice(0, 38)}...` : item;
    return `「${clipped}」`;
  });
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
    phq9.phq9_summary ||
    fallbackMessage ||
    '目前還沒有足夠內容可以整理成給病人的分析。';
  const hasStructuredEvidence = Boolean(
    concerns.length ||
    observations.length ||
    followupNeeds.length ||
    stressors.length ||
    keyThemes.length ||
    supportedDimensions.length ||
    recentEvidence.length ||
    sentimentTags.length ||
    cognitiveTags.length ||
    behavioralTags.length ||
    evidenceHighlights.length
  );
  const stateUnderstanding = [];
  if (sentimentTags.length) stateUnderstanding.push(`你最近的情緒線索比較靠近「${sentimentTags.join('、')}」`);
  if (burden.burden_level === 'high') stateUnderstanding.push('你現在的互動負擔偏高，可能不太適合一次處理太多問題');
  if (burden.burden_level === 'medium') stateUnderstanding.push('你現在還撐得住對話，但可能已經有點疲累，需要比較溫和的整理節奏');
  if (supportedDimensions.length) stateUnderstanding.push(`目前對話已經碰到的狀態面向包含 ${supportedDimensions.map(humanizeHamdDimension).join('、')}`);
  if (phq9.phq9_summary) stateUnderstanding.push(`你這次的 PHQ-9 自評是 ${phq9.phq9_summary}`);
  if (keyThemes.length) stateUnderstanding.push(`這段對話反覆繞著 ${keyThemes.join('、')} 這幾個主題`);
  if (!stateUnderstanding.length && evidenceHighlights.length) {
    stateUnderstanding.push(`我有抓到你提過的內容，像是 ${evidenceHighlights.join('、')}，可以再往這些線索深入。`);
  }
  if (!stateUnderstanding.length) stateUnderstanding.push('我目前沒有拿到足夠的「一般對話內容」來做分析（目前看起來多半是操作指令）。');

  const pressurePoints = [];
  if (concerns.length) pressurePoints.push(...concerns.map((item) => `你明顯在意的事包括：${item}`));
  if (stressors.length) pressurePoints.push(...stressors.map((item) => `可能正在拉扯你的壓力來源之一是：${item}`));
  if (observations.length) pressurePoints.push(...observations.map((item) => `我注意到一個具體表現是：${item}`));
  if (recentEvidence.length) pressurePoints.push(...recentEvidence.map((item) => `最近浮出的線索像是：${item}`));
  if (phq9.phq9_summary) pressurePoints.push(`最新 PHQ-9 自評顯示：${phq9.phq9_summary}`);
  if (evidenceHighlights.length) pressurePoints.push(`你最近提到的原始線索包含：${evidenceHighlights.join('、')}`);
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
    supportSuggestions.push(`下一步如果要更理解你的狀態，可以再補一點和「${humanizeHamdDimension(hamdProgress.next_recommended_dimension)}」有關的感受或例子。`);
  }
  if (positiveAnchors.length) {
    supportSuggestions.push(`你不是只有困住的部分，像 ${positiveAnchors.join('、')} 這些也可能是幫你穩住自己的資源。`);
  }
  if (phq9.phq9_narrative_count > 0) {
    supportSuggestions.push('你已經把 PHQ-9 寫得很完整，這會讓後續整理更接近你的真實感受。');
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
  if (!hasStructuredEvidence) {
    nextSteps.unshift('先補一段「一般對話」再按分析：例如「我最近最卡的是___，它影響到___」。');
  }

  const bullets = Array.from(new Set([
    ...concerns,
    ...observations,
    ...stressors,
    ...keyThemes,
    ...evidenceHighlights
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

function mergePatientAnalysis(baseOutput, generatedOutput) {
  const base = baseOutput && typeof baseOutput === 'object' ? baseOutput : {};
  const generated = generatedOutput && typeof generatedOutput === 'object' ? generatedOutput : {};
  const merged = Object.assign({}, base, generated);
  merged.version = String(generated.version || base.version || 'p4_patient_analysis_v3').trim();
  merged.status = String(generated.status || base.status || 'ready').trim() || 'ready';
  merged.plain_summary = String(generated.plain_summary || base.plain_summary || '').trim();
  merged.reminder = String(generated.reminder || base.reminder || '這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。').trim();
  merged.key_points = Array.from(new Set(normalizeArray(generated.key_points).concat(normalizeArray(base.key_points)))).slice(0, 6);
  const markdown = String(generated.markdown || '').trim();
  merged.markdown = markdown && !isPatientAnalysisPlaceholderText(markdown) ? markdown : String(base.markdown || '').trim();
  return merged;
}

function buildPatientAnalysisFromRawModelText(rawText, baseOutput) {
  const base = baseOutput && typeof baseOutput === 'object' ? baseOutput : {};
  const text = String(rawText || '').trim();
  if (!text || isPatientAnalysisPlaceholderText(text)) {
    return Object.assign({}, base, {
      status: String(base.status || 'ready').trim() || 'ready'
    });
  }
  const markdown = text.includes('## ')
    ? text
    : ['## 給你的分析', '', text, '', '### 提醒', '這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。'].join('\n');
  const plainSummary = String(base.plain_summary || '').trim() && !isGenericDraftText(base.plain_summary)
    ? String(base.plain_summary || '').trim()
    : text.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 2).join(' ');
  return Object.assign({}, base, {
    version: 'p4_patient_analysis_v3',
    status: 'ready',
    plain_summary: plainSummary || String(base.plain_summary || '').trim(),
    markdown: markdown
  });
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

  syncPatientProfile(session, profile) {
    if (!session || !profile || typeof profile !== 'object') return;
    session.state.patient_profile = normalizePatientProfile(profile);
  }

  syncPhq9Assessment(session, assessment) {
    if (!session || !assessment || typeof assessment !== 'object') return;
    session.state.phq9_assessment = normalizePhq9Assessment(assessment);
  }

  buildKnowYouMemoryPrefix(session, message = '') {
    const profile = normalizeTherapeuticProfile(session?.state?.therapeutic_profile || {}, session?.user || '');
    const memoryBlock = KnowYouMemory.buildMemoryContextString(profile);
    if (!memoryBlock) {
      return '';
    }
    const meter = KnowYouMemory.buildMemoryMeterState({
      profile,
      history: Array.isArray(session?.history) ? session.history : [],
      pendingMessage: message,
      tokenLimit: profile.memoryStats?.tokenLimit || KNOW_YOU_TOKEN_LIMIT,
      recentItems: KNOW_YOU_RECENT_ITEMS
    });
    const meterLine = `【即時上下文條】${meter.estimatedTokens}/${meter.tokenLimit} tokens，${meter.shouldCompress ? '快滿了，準備壓縮' : '尚未滿載'}`;
    return `${memoryBlock}\n${meterLine}`;
  }

  buildKnowYouMemoryMeter(session, pendingMessage = '') {
    const profile = normalizeTherapeuticProfile(session?.state?.therapeutic_profile || {}, session?.user || '');
    return KnowYouMemory.buildMemoryMeterState({
      profile,
      history: Array.isArray(session?.history) ? session.history : [],
      pendingMessage,
      tokenLimit: profile.memoryStats?.tokenLimit || KNOW_YOU_TOKEN_LIMIT,
      recentItems: KNOW_YOU_RECENT_ITEMS
    });
  }

  buildKnowYouCompressionWindow(session) {
    const history = Array.isArray(session?.history) ? session.history : [];
    const { older, recent } = KnowYouMemory.splitTranscript(history, KNOW_YOU_RECENT_ITEMS);
    return {
      older,
      recent,
      older_text: older.map(formatTranscriptEntry).filter(Boolean).join('\n'),
      recent_text: recent.map(formatTranscriptEntry).filter(Boolean).join('\n')
    };
  }

  mergeTherapeuticMemoryUpdates(session, updates = {}, meter = null) {
    if (!session || !session.state) return null;
    const baseProfile = normalizeTherapeuticProfile(session.state.therapeutic_profile || {}, session.user);
    const nextProfile = KnowYouMemory.normalizeTherapeuticProfile(baseProfile);

    const stressors = Array.isArray(updates.stressors) ? updates.stressors : [];
    stressors.forEach((item) => {
      const label = typeof item === 'string' ? item : item?.label;
      if (!label) return;
      if (!nextProfile.stressors.find((entry) => entry.label === label)) {
        nextProfile.stressors.push({ label });
      }
    });

    const triggers = Array.isArray(updates.triggers) ? updates.triggers : [];
    triggers.forEach((item) => {
      const keyword = typeof item === 'string' ? item : item?.keyword;
      if (!keyword) return;
      if (!nextProfile.triggers.find((entry) => entry.keyword === keyword)) {
        nextProfile.triggers.push({
          keyword,
          reaction: item?.reaction || '',
          severity: item?.severity || 'medium'
        });
      }
    });

    const keyThemes = Array.isArray(updates.keyThemes) ? updates.keyThemes : [];
    keyThemes.forEach((theme) => {
      if (typeof theme !== 'string' || !theme.trim()) return;
      if (!nextProfile.keyThemes.includes(theme.trim())) {
        nextProfile.keyThemes.push(theme.trim());
      }
    });

    const positiveAnchors = Array.isArray(updates.positiveAnchors) ? updates.positiveAnchors : [];
    positiveAnchors.forEach((item) => {
      const label = typeof item === 'string' ? item : item?.label;
      if (!label) return;
      if (!nextProfile.positiveAnchors.find((entry) => entry.label === label)) {
        nextProfile.positiveAnchors.push({
          label,
          category: item?.category || 'other'
        });
      }
    });

    if (typeof updates.copingStyleHint === 'string' && updates.copingStyleHint.trim()) {
      nextProfile.copingProfile.preferredStyle = updates.copingStyleHint.trim();
    }

    const memoryChunks = Array.isArray(updates.memory_chunks) ? updates.memory_chunks : Array.isArray(updates.memoryChunks) ? updates.memoryChunks : [];
    memoryChunks.forEach((chunk) => {
      const merged = KnowYouMemory.mergeMemoryChunk(nextProfile, chunk);
      nextProfile.memoryChunks = merged.memoryChunks;
      nextProfile.memoryStats = merged.memoryStats;
    });

    if (!memoryChunks.length && typeof updates.summary === 'string' && updates.summary.trim()) {
      const merged = KnowYouMemory.mergeMemoryChunk(nextProfile, {
        title: '對話壓縮摘要',
        category: 'context',
        summary: updates.summary.trim(),
        detail: typeof updates.detail === 'string' ? updates.detail.trim() : '',
        tokenEstimate: meter?.estimatedTokens || 0
      });
      nextProfile.memoryChunks = merged.memoryChunks;
      nextProfile.memoryStats = merged.memoryStats;
    }

    nextProfile.memoryStats = Object.assign({}, nextProfile.memoryStats, {
      tokenLimit: meter?.tokenLimit || nextProfile.memoryStats?.tokenLimit || KNOW_YOU_TOKEN_LIMIT,
      estimatedTokens: meter?.estimatedTokens || nextProfile.memoryStats?.estimatedTokens || 0,
      compressionProgress: meter ? meter.compressionProgress : nextProfile.memoryStats?.compressionProgress || 0,
      shouldCompress: Boolean(meter?.shouldCompress),
      memoryChunksCount: nextProfile.memoryChunks.length,
      lastCompressedAt: meter?.lastCompressedAt || nextProfile.memoryStats?.lastCompressedAt || ''
    });
    nextProfile.lastUpdatedAt = new Date().toISOString();
    session.state.therapeutic_profile = normalizeTherapeuticProfile(nextProfile, session.user);
    return session.state.therapeutic_profile;
  }

  async compressTherapeuticMemory(session, message, options = {}) {
    const meter = this.buildKnowYouMemoryMeter(session, message);
    if (!options.force && !meter.shouldCompress && !meter.isFull) {
      return null;
    }

    const window = this.buildKnowYouCompressionWindow(session);
    const compressionSource = window.older.length ? window.older : (Array.isArray(session.history) ? session.history : []);
    if (!compressionSource.length) {
      session.state.therapeutic_profile = normalizeTherapeuticProfile(session.state.therapeutic_profile || {}, session.user);
      session.state.therapeutic_profile.memoryStats = Object.assign({}, session.state.therapeutic_profile.memoryStats, meter, {
        shouldCompress: false,
        memoryChunksCount: Array.isArray(session.state.therapeutic_profile.memoryChunks) ? session.state.therapeutic_profile.memoryChunks.length : 0
      });
      return null;
    }

    const fallbackSummary = {
      summary: compressionSource
        .slice(-4)
        .map((item) => formatTranscriptEntry(item))
        .filter(Boolean)
        .join('；') || '這段對話包含一些可延續的長期記憶。',
      memory_chunks: [],
      stressors: [],
      triggers: [],
      keyThemes: [],
      positiveAnchors: [],
      copingStyleHint: '',
      retainedTurnCount: window.recent.length
    };

    const result = await this.runJsonTask('memoryCompressionBuilder', session, message, {
      includeMemoryContext: false,
      fallback: fallbackSummary,
      historyOverride: [],
      extraContext: {
        memory: {
          current_memory: KnowYouMemory.buildMemoryContextString(session.state.therapeutic_profile || {})
        },
        compression_window: {
          memory_meter: JSON.stringify(meter, null, 2),
          recent_chat_history_text: window.recent_text,
          longitudinal_dialogue: window.older_text || compressionSource.map(formatTranscriptEntry).filter(Boolean).join('\n'),
          retained_turn_count: window.recent.length,
          older_turn_count: window.older.length || compressionSource.length
        }
      },
      userPromptOverride: window.older_text || compressionSource.map(formatTranscriptEntry).filter(Boolean).join('\n') || message
    });

    const mergedProfile = this.mergeTherapeuticMemoryUpdates(session, result || {}, meter);
    if (mergedProfile) {
      mergedProfile.memoryStats = Object.assign({}, mergedProfile.memoryStats, {
        lastCompressionReason: meter.shouldCompress ? 'threshold' : 'forced',
        lastCompressedAt: new Date().toISOString(),
        shouldCompress: false,
        memoryChunksCount: Array.isArray(mergedProfile.memoryChunks) ? mergedProfile.memoryChunks.length : 0,
        tokenLimit: meter.tokenLimit,
        estimatedTokens: meter.estimatedTokens,
        compressionProgress: meter.compressionProgress
      });
      session.state.therapeutic_profile = mergedProfile;
    }

    return result;
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
    this.syncPatientProfile(session, payload.patient_profile);
    this.syncPhq9Assessment(session, payload.phq9_assessment);
    if (payload.user_self_rating && typeof payload.user_self_rating === 'object') {
      state._pending_user_self_rating = payload.user_self_rating;
    }

    if (payload.force_memory_compression) {
      const result = await this.compressTherapeuticMemory(session, message || '測試壓縮', { force: true });
      const compressionResult = result || {
        summary: '目前資料還不夠多，但已完成一次模擬壓縮流程。',
        memory_chunks: [],
        stressors: [],
        triggers: [],
        keyThemes: [],
        positiveAnchors: [],
        copingStyleHint: '',
        retainedTurnCount: Array.isArray(session.history) ? session.history.length : 0,
        lastCompressedAt: new Date().toISOString()
      };
      this.persistSessions();
      return {
        conversation_id: session.id,
        answer: compressionResult.summary || '已執行記憶壓縮測試。',
        state: deepClone(session.state),
        session_export: defaultSessionExport(session),
        metadata: {
          active_mode: state.active_mode,
          route: 'memory_compression_test',
          risk_flag: state.risk_flag,
          memory_meter: this.buildKnowYouMemoryMeter(session, message || '測試壓縮'),
          compression_result: compressionResult
        }
      };
    }

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
      state.risk_flag = 'false';
      state.red_flag_payload = 'none';
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

    const isManualModeLocked = state.routing_mode_override && state.routing_mode_override !== 'auto';
    if (this.isHighRisk(message) && !isManualModeLocked) {
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
        instruction: message,
        force_refresh: true
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

    try {
      await this.compressTherapeuticMemory(session, message);
    } catch (error) {
      // Memory compression is best-effort; a failure should not block the reply.
    }
    await this.updateSharedState(session, message);

    // ── Console debug 輸出（白話版）──
    if (process.env.DEBUG_CLINICAL === 'true' && state._clinical_trace) {
      const t = state._clinical_trace;
      const actionLabel = {
        none_llm_correct: '✅ 系統閉嘴（AI 已經精準問出重點了）',
        append_question: '➕ 補了一題（AI 沒問到關鍵項目，系統幫忙補上）',
        replace_question: '🔄 替換問句（AI 問的方向偏了，系統幫忙導正）',
        no_probe_available: '⚠️ 沒有適合的追問選項',
        crash_fallback: '💥 系統處理過程出現小插曲，改用安全備用題',
        crash_last_resort: '💥💥 系統嚴重故障，硬塞保險題目確保對話繼續'
      }[t.intervention_action] || t.intervention_action;

      const reasonLabel = {
        pass: '一切完美，AI 表現良好',
        no_question: 'AI 剛才沒問任何問題',
        banned_question_type: 'AI 問了禁止類型（如：過度解釋、安慰、反思）',
        not_scoreable: 'AI 問句無法量化（缺少頻率、程度或功能影響）',
        wrong_item: `AI 問錯重點（目前該關心「${t.target_item}」，但問了別的）`,
        vague_functional: '問得太籠統（提到了影響，但不明確）'
      }[t.intervention_reason] || t.intervention_reason;

      const itemLabel = HAMD_FORMAL_ITEM_MAP[t.target_item]
        ? `${HAMD_FORMAL_ITEM_MAP[t.target_item].item_label}（${t.target_item}）`
        : t.target_item || '無';

      console.log('\n┌──────────────────────────────────────────────┐');
      console.log('│           🧠 臨床分析官 決策紀要            │');
      console.log('├──────────────────────────────────────────────┤');
      console.log(`│ 📝 AI 原說：「${(t.raw_output || '').substring(0, 30)}…」`);
      console.log(`│ ❓ 原本問：「${t.extracted_question || '（沒問問題）'}」`);
      console.log('│');
      console.log(`│ 🎯 當前關注：${itemLabel}`);
      console.log(`│ 🎯 問對重點嗎？ ${t.is_correct_item === null ? '⬜ 未檢測' : t.is_correct_item ? '✅ 問對了' : '❌ 問錯了'}`);
      console.log('│');
      console.log(`│ 🤔 是否需介入？ ${t.should_intervene ? '👉 需要' : '🤫 不用，維持原樣'}`);
      console.log(`│ 💬 判定原因：${reasonLabel}`);
      console.log(`│ 🔧 採取的動作：${actionLabel}`);
      if (t.replacement_probe) {
        console.log(`│ 🔁 修改為：「${t.replacement_probe.substring(0, 30)}…」`);
      }
      console.log('│');
      console.log(`│ ✨ 最終送出：「${t.final_question || '（沒問句）'}」`);
      console.log('└──────────────────────────────────────────────┘\n');
    }

    if (state.pending_question !== 'none' && state.pending_question) {
      const answer = await this.handleFollowup(session, message);
      session.history.push({ role: 'assistant', content: answer, kind: 'chat' });
      this.updateMemorySnapshot(session, answer);
      const _aiTraceFollowup = state._ai_trace || null;
      delete state._ai_trace;
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
          burden_level_state: normalizeObjectState(state, 'burden_level_state', {}),
          ai_trace: _aiTraceFollowup
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
    // 暫存 trace 給 API 回傳用，然後清掉避免持久化
    const _traceSnapshot = state._clinical_trace || null;
    const _aiTraceSnapshot = state._ai_trace || null;
    delete state._clinical_trace;
    delete state._ai_trace;
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
        burden_level_state: normalizeObjectState(state, 'burden_level_state', {}),
        clinical_trace: _traceSnapshot,
        ai_trace: _aiTraceSnapshot,
        probe_meta: (state.hamd_formal_assessment && state.hamd_formal_assessment.pending_probe_meta) || null
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
    const currentBridge = normalizeObjectState(state, 'symptom_bridge_state', {});

    const burden = await this.runJsonTask('burdenLevelBuilder', session, message, {
      fallback: {
        burden_level: message.length < 12 ? 'high' : 'medium',
        response_style: message.length < 12 ? 'option_first' : 'natural',
        followup_budget: message.length < 12 ? '0' : '1',
        burden_note: 'Fallback burden estimate.'
      }
    });
    state.burden_level_state = burden;
    ensureAiTrace(state).burden = {
      burden_level: burden.burden_level,
      response_style: burden.response_style,
      followup_budget: burden.followup_budget,
      burden_note: burden.burden_note
    };

    const hamd = await this.runJsonTask('hamdProgressTracker', session, message, {
      fallback: {
        progress_stage: 'initial',
        current_focus: 'depressed_mood',
        items: [],
        supported_dimensions: [],
        covered_dimensions: [],
        missing_dimensions: [
          'depressed_mood', 'guilt', 'suicide',
          'insomnia_early', 'insomnia_middle', 'insomnia_late',
          'work_activities', 'retardation', 'agitation',
          'somatic_anxiety', 'appetite_weight'
        ],
        next_recommended_dimension: 'depressed_mood',
        next_question_hint: '',
        completion: 0,
        recent_evidence: [message],
        needs_clarification: 'yes',
        status_summary: 'Fallback HAM-D state.'
      }
    });
    state.hamd_progress_state = enrichHamdProgressState(hamd, buildLongitudinalEvidence(session, currentBridge));
    ensureAiTrace(state).hamd_progress = {
      progress_stage: hamd.progress_stage,
      current_focus: hamd.current_focus,
      next_recommended_dimension: hamd.next_recommended_dimension,
      next_question_hint: hamd.next_question_hint,
      completion: hamd.completion,
      status_summary: hamd.status_summary,
      needs_clarification: hamd.needs_clarification,
      item_status: Array.isArray(hamd.items)
        ? hamd.items.reduce((acc, it) => {
            if (it && it.item) acc[it.item] = it.status || 'missing';
            return acc;
          }, {})
        : {},
      covered_dimensions: Array.isArray(hamd.covered_dimensions) ? hamd.covered_dimensions : [],
      missing_dimensions: Array.isArray(hamd.missing_dimensions) ? hamd.missing_dimensions : []
    };
    await this.updateFormalAssessment(session, message);
  }

  async resolveActiveMode(session, message) {
    const state = session.state;

    // ── A. 使用者明確手動覆寫模式（mission/void/soulmate/option 指令）
    //    這是使用者主動切換，保留原有獨立 handler 行為
    if (state.routing_mode_override && state.routing_mode_override !== 'auto') {
      return state.routing_mode_override;
    }

    // ── B. Auto 模式：所有分流都在 Smart Hunter 內部處理
    //    分類器只用來建構 flow_state，不做外部路由跳轉

    // B-1. 低能量/情緒偵測 → 決定 Smart Hunter 的子模式
    const lowEnergy = await this.runClassifier('lowEnergyDetector', session, message, [
      'degrade_option',
      'degrade_soulmate',
      'continue_auto'
    ], 'continue_auto');
    ensureAiTrace(state).low_energy = lowEnergy;

    // B-2. 意圖分類 → 決定 Smart Hunter 的子模式（不路由離開）
    const intent = await this.runClassifier('intentClassifier', session, message, [
      'mode_1_void',
      'mode_2_soulmate',
      'mode_3_mission',
      'mode_4_option',
      'mode_5_natural',
      'mode_6_clarify'
    ], 'mode_5_natural');
    ensureAiTrace(state).intent = intent;

    // B-3. 合成 flow_state（供 Smart Hunter 內部使用）
    const hamd = normalizeObjectState(state, 'hamd_progress_state', {});
    const burden = normalizeObjectState(state, 'burden_level_state', {});
    const prevFlow = normalizeObjectState(state, 'flow_state', {});
    const consecutiveProbes = Number(prevFlow.consecutive_probes || 0);
    const isHighBurden = burden.burden_level === 'high';

    // 子模式判斷（優先低能量偵測器的結果）
    let subMode = 'flow_conversation';
    if (lowEnergy === 'degrade_soulmate' || intent === 'mode_2_soulmate') {
      subMode = 'emotional_holding';
    } else if (lowEnergy === 'degrade_option' || intent === 'mode_4_option') {
      subMode = 'choice_prompting';
    } else if (intent === 'mode_3_mission') {
      subMode = 'clinical_probing';
    } else if (intent === 'mode_5_natural' || intent === 'mode_6_clarify') {
      subMode = consecutiveProbes >= 2 ? 'flow_conversation' : 'clinical_probing';
    }

    // 能否插入 HAM-D 追問
    const canProbeHamd = !isHighBurden
      && subMode !== 'emotional_holding'
      && subMode !== 'choice_prompting'
      && consecutiveProbes < 2
      && hamd.needs_clarification !== 'no';

    this.updateFlowState(state, {
      sub_mode: subMode,
      can_probe_hamd: canProbeHamd,
      consecutive_probes: consecutiveProbes
    });
    ensureAiTrace(state).flow = {
      sub_mode: subMode,
      can_probe_hamd: canProbeHamd,
      consecutive_probes: consecutiveProbes,
      is_high_burden: isHighBurden,
      atmosphere_protection: subMode === 'emotional_holding'
    };

    // ── C. 永遠路由到 Smart Hunter（mode_5_natural）
    //    唯一例外：真正空白/無效輸入（mode_1_void）
    if (intent === 'mode_1_void') return 'mode_1_void';
    return 'mode_5_natural';
  }

  async judgeConversationMode(session, message, formalProbe) {
    const state = session.state;
    const baseResolvedTarget = resolveConversationTarget(state, message, formalProbe);
    const fallbackDecision = determineConversationMode(state, message, baseResolvedTarget.targetItemCode);
    const baseDefinition = HAMD_FORMAL_ITEM_MAP[baseResolvedTarget.targetItemCode] || null;
    const baseTargetDimension = baseDefinition ? baseDefinition.dimension : '';
    const baseTargetDimensionLabel = baseTargetDimension ? humanizeHamdDimension(baseTargetDimension) : '';

    const rawDecision = await this.runJsonTask('conversationModeJudge', session, message, {
      extraContext: {
        conversation_mode: {
          target_item_code: baseResolvedTarget.targetItemCode,
          target_item_label: baseDefinition ? baseDefinition.item_label : '',
          target_item_source: baseResolvedTarget.targetItemSource,
          target_dimension: baseTargetDimension,
          target_dimension_label: baseTargetDimensionLabel,
          fallback_mode: fallbackDecision.mode,
          fallback_reason: fallbackDecision.reason,
          followup_turn_count: Number(state.followup_turn_count || '0'),
          probe_count: baseResolvedTarget.targetItemCode ? getItemProbeCount(state, baseResolvedTarget.targetItemCode) : 0,
          current_focus: normalizeObjectState(state, 'hamd_progress_state', {}).current_focus || '',
          next_recommended_dimension: normalizeObjectState(state, 'hamd_progress_state', {}).next_recommended_dimension || '',
          previous_mode_state: normalizeObjectState(state, 'conversation_mode_state', {})
        }
      },
      fallback: {
        mode: fallbackDecision.mode,
        reason: fallbackDecision.reason,
        topic_clarity: 'fallback',
        hamd_ready: baseResolvedTarget.targetItemCode ? 'yes' : 'no',
        progression: 'fallback',
        loop_detected: fallbackDecision.mode === 'switching' ? 'yes' : 'no'
      }
    });

    const decision = normalizeConversationModeDecision(
      rawDecision,
      fallbackDecision,
      baseResolvedTarget.targetItemCode,
      baseResolvedTarget.targetItemSource
    );

    // ── 硬規則守門（Rules > LLM，僅限 switching 強制）─────────────────────────
    // LLM 負責「方向」，但下列兩種情況必須強制換題，LLM 無法阻止：
    // 1. probe_count >= 1（已問過一次，不重問）
    // 2. isItemDataComplete（已有完整 evidence + score 或 slider + evidence）
    // 其餘情況：LLM wins
    if (decision.mode === 'probing' && fallbackDecision.mode === 'switching') {
      decision.mode = 'switching';
      decision.reason = `rule_guard(${fallbackDecision.reason})→override_llm_probing`;
      decision.decision_path_note = `LLM 說繼續追問，但規則強制換題（${fallbackDecision.reason}）`;
    }

    // ── LLM 語意維度引導（dominant_dimension）──────────────────────────────
    // 若 LLM 判斷 dominant_dimension 明確（不是 unclear），系統從該 dimension 選 target
    // 這讓「累、睡不好、沒動力」這種語意同屬一個群的輸入不會錯誤觸發 clarifying
    const llmDominantDim = String(rawDecision.dominant_dimension || '').trim();
    // 對應 LLM dominant_dimension 輸出值 → 實際 HAMD item codes
    // item codes 必須存在於 HAMD_FORMAL_ITEM_MAP（見 HAMD_FORMAL_ITEMS 定義）
    const DIMENSION_MAP = {
      depressed_mood:  ['depressed_mood', 'suicide'],
      guilt:           ['guilt', 'insight'],
      suicide:         ['suicide'],
      insomnia:        ['insomnia_early', 'insomnia_middle', 'insomnia_late'],
      low_energy:      ['work_activities', 'retardation', 'general_somatic'], // work_activities.dimension='work_interest', retardation.dimension='retardation'
      psychomotor:     ['retardation', 'agitation'],
      anxiety:         ['psychic_anxiety', 'somatic_anxiety', 'gastrointestinal_somatic'],
      somatic:         ['gastrointestinal_somatic', 'general_somatic', 'genital_symptoms', 'hypochondriasis', 'weight_loss']
    };
    if (llmDominantDim && llmDominantDim !== 'unclear' && DIMENSION_MAP[llmDominantDim]) {
      const lockedCodes = getLockedItemCodes(state);
      const candidateCodes = DIMENSION_MAP[llmDominantDim];
      const firstUnlocked = candidateCodes.find((c) => !lockedCodes.includes(c));
      if (firstUnlocked) {
        // 取得目前 pending probe 的 item 來比對 dimension
        const pendingAssessment = normalizeObjectState(state, 'hamd_formal_assessment', {});
        const pendingCode = String(pendingAssessment.pending_probe_item_code || '').trim();
        // 判斷 pending probe 是否屬於 LLM 選定的同一個 dimension
        const pendingInSameDim = !pendingCode || candidateCodes.includes(pendingCode);

        if (decision.mode === 'clarifying') {
          // 語意已夠明確 → 改為 probing
          decision.mode = 'probing';
          decision.reason = `llm_dominant_dim(${llmDominantDim})→item(${firstUnlocked})`;
        } else if (decision.mode === 'probing' && pendingCode && !pendingInSameDim) {
          // ⚠️ LLM 說的維度 ≠ 目前 pending probe 的維度
          // → 強制 switching，讓 LLM 的語意判斷贏過 pending_probe 黏題
          decision.mode = 'switching';
          decision.reason = `llm_dim(${llmDominantDim})≠pending(${pendingCode})→switch`;
          decision.decision_path_note = `dominant_dimension override: ${pendingCode} → ${firstUnlocked}`;
        }
        baseResolvedTarget.targetItemCode = firstUnlocked;
        baseResolvedTarget.targetItemSource = `llm_dominant_dim:${llmDominantDim}`;
      }
    }
    decision.llm_dominant_dimension = llmDominantDim || 'unclear';

    // ── 硬規則：target_item 存在且使用者回應包含相關語意 → 禁止 clarifying ──
    // 只要主軸還在（probing > switching > clarifying），不釐清
    if (decision.mode === 'clarifying' && baseResolvedTarget.targetItemCode) {
      const targetKws = ITEM_SYMPTOM_KEYWORDS[baseResolvedTarget.targetItemCode] || [];
      const userMentionsTarget = targetKws.some((kw) => String(message || '').includes(kw));
      if (userMentionsTarget) {
        decision.mode = 'probing';
        decision.reason = 'target_semantic_present→force_probing';
      }
    }

    const resolvedTarget = resolveConversationTargetByMode(state, message, formalProbe, decision.mode, baseResolvedTarget);
    decision.target_item_code = resolvedTarget.targetItemCode || '';
    decision.target_item_source = resolvedTarget.targetItemSource || 'none';
    const itemDefinition = HAMD_FORMAL_ITEM_MAP[decision.target_item_code] || null;
    const targetDimension = itemDefinition ? itemDefinition.dimension : '';
    const targetDimensionLabel = targetDimension ? humanizeHamdDimension(targetDimension) : '';

    if ((decision.mode === 'probing' || decision.mode === 'switching') && targetDimension) {
      decision.hamd_dimension = targetDimension;
      decision.hamd_dimension_label = targetDimensionLabel;
      decision.target_item_label = itemDefinition ? itemDefinition.item_label : '';
    } else {
      decision.hamd_dimension = '';
      decision.hamd_dimension_label = '';
      decision.target_item_label = itemDefinition ? itemDefinition.item_label : '';
    }
    decision.fallback_mode = fallbackDecision.mode;
    decision.fallback_reason = fallbackDecision.reason;

    ensureAiTrace(state).conversation_mode_judge = {
      mode: decision.mode,
      reason: decision.reason,
      topic_clarity: decision.topic_clarity,
      hamd_ready: decision.hamd_ready,
      progression: decision.progression,
      loop_detected: decision.loop_detected,
      llm_dominant_dimension: decision.llm_dominant_dimension || 'unclear',
      target_item_code: decision.target_item_code,
      target_item_label: decision.target_item_label,
      target_item_source: decision.target_item_source,
      hamd_dimension: decision.hamd_dimension,
      hamd_dimension_label: decision.hamd_dimension_label,
      fallback_mode: decision.fallback_mode,
      fallback_reason: decision.fallback_reason
    };

    // ── 持久化：把本輪決策存到 state，讓下一輪 LLM 知道「上一輪我們在哪一題、哪個模式」
    state.conversation_mode_state = JSON.stringify({
      mode: decision.mode,
      reason: decision.reason,
      dominant_dimension: decision.llm_dominant_dimension || 'unclear',
      target_item_code: decision.target_item_code || '',
      target_item_label: decision.target_item_label || '',
      hamd_dimension: decision.hamd_dimension || '',
      hamd_dimension_label: decision.hamd_dimension_label || '',
      updatedAt: new Date().toISOString()
    });

    return {
      decision,
      resolvedTarget
    };
  }

  updateFlowState(state, updates = {}) {
    const prev = normalizeObjectState(state, 'flow_state', {});
    const prevProbes = Number(prev.consecutive_probes || 0);

    const newProbes = updates.can_probe_hamd
      ? Math.min(prevProbes + 1, 3)
      : 0;

    state.flow_state = {
      sub_mode: updates.sub_mode || prev.sub_mode || 'flow_conversation',
      can_probe_hamd: Boolean(updates.can_probe_hamd),
      consecutive_probes: updates.consecutive_probes !== undefined ? updates.consecutive_probes : newProbes,
      atmosphere_protection: updates.sub_mode === 'emotional_holding',
      updatedAt: new Date().toISOString()
    };
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
    const targetItems = getFormalTargetItems(state, 2, message);
    if (!targetItems.length) {
      state.hamd_formal_assessment = assessment;
      return;
    }
    const pendingProbe = assessment.pending_probe_item_code
      ? {
          item_code: assessment.pending_probe_item_code,
          probe_question: assessment.pending_probe_question
        }
      : {};
    const evidenceFallback = buildEvidenceClassifierFallback(targetItems, pendingProbe, message);
    const rawEvidenceResult = await this.runJsonTask('hamdEvidenceClassifier', session, message, {
      extraContext: {
        formal_assessment: {
          target_items: targetItems,
          pending_probe: pendingProbe
        }
      },
      fallback: evidenceFallback
    });
    const evidenceResult = mergeEvidenceClassifierResultWithFallback(rawEvidenceResult, evidenceFallback, targetItems);
    ensureAiTrace(state).evidence_classifier = {
      assessment_mode: evidenceResult.assessment_mode,
      items: Array.isArray(evidenceResult.items)
        ? evidenceResult.items.map((it) => ({
            item_code: it.item_code,
            evidence_type: it.evidence_type,
            confidence: it.confidence,
            evidence_summary: normalizeArray(it.evidence_summary).slice(0, 3)
          }))
        : []
    };
    const scoreFallback = buildFormalScoringFallback(targetItems, evidenceResult);
    const rawScoreResult = await this.runJsonTask('hamdFormalItemScorer', session, message, {
      extraContext: {
        formal_assessment: {
          target_items: targetItems,
          evidence_result: evidenceResult
        }
      },
      fallback: scoreFallback
    });
    const scoreResult = mergeFormalScoringResultWithFallback(rawScoreResult, scoreFallback, targetItems);

    // Hybrid 評分：若使用者有拖滑桿，以 0.7 NLP + 0.3 user 混合
    const pendingRating = state._pending_user_self_rating || null;
    if (pendingRating && assessment.pending_probe_item_code && Array.isArray(scoreResult.items)) {
      const targetCode = assessment.pending_probe_item_code;
      scoreResult.items = scoreResult.items.map((it) => {
        if (it.item_code !== targetCode || typeof it.ai_suggested_score !== 'number') return it;
        const uVal = Number(pendingRating.value);
        if (isNaN(uVal)) return it;
        const nlpVal = it.ai_suggested_score;
        const blended = Math.round(0.7 * nlpVal + 0.3 * uVal);
        return Object.assign({}, it, {
          ai_suggested_score: blended,
          user_self_rating: pendingRating,
          rating_rationale: `${it.rating_rationale || ''} [hybrid: NLP=${nlpVal}, user=${uVal}, final=${blended}]`.trim()
        });
      });
      // 把 user_self_rating 也寫進 assessment item
      const assessmentItem = assessment.items.find((i) => i.item_code === targetCode);
      if (assessmentItem) assessmentItem.user_self_rating = pendingRating;
    }
    delete state._pending_user_self_rating;

    ensureAiTrace(state).scorer = {
      items: Array.isArray(scoreResult.items)
        ? scoreResult.items.map((it) => ({
            item_code: it.item_code,
            ai_suggested_score: it.ai_suggested_score,
            rating_rationale: it.rating_rationale
          }))
        : []
    };
    state.hamd_formal_assessment = mergeFormalAssessmentUpdates(assessment, evidenceResult, scoreResult);
    if (assessment.pending_probe_item_code) {
      const pendingCode = assessment.pending_probe_item_code;
      const pendingItem = state.hamd_formal_assessment.items.find((item) => item.item_code === pendingCode);
      const hasEvidence = pendingItem && normalizeArray(pendingItem.evidence_summary).length > 0;
      const probeCount = pendingItem ? (pendingItem.probe_count || 0) : 0;
      if (hasEvidence) {
        // 使用者有回答 → 正常清除 pending
        state.hamd_formal_assessment.pending_probe_item_code = '';
        state.hamd_formal_assessment.pending_probe_question = '';
        state.hamd_formal_assessment.pending_probe_meta = null;
      } else if (probeCount >= 1) {
        // 問了 1 次仍沒答 → 清除 pending，換題（skipped 由 computeHamdItemLockState 自動計算）
        state.hamd_formal_assessment.pending_probe_item_code = '';
        state.hamd_formal_assessment.pending_probe_question = '';
        state.hamd_formal_assessment.pending_probe_meta = null;
      }
      // probe_count == 0（不應發生）→ 保留 pending
    }
    // Recompute completion locks after evidence/score update
    const prevLockedCodes = getLockedItemCodes(state);
    const progressItems = normalizeObjectState(state, 'hamd_progress_state', {}).items || [];
    const updatedAssessment = hydrateFormalAssessment(state.hamd_formal_assessment);
    state.hamd_item_lock_state = computeHamdItemLockState(progressItems, updatedAssessment.items);
    // 評分完成中斷點偵測：本輪新被鎖定的題項（純偵測，不影響探針流程）
    const newLockedCodes = getLockedItemCodes(state);
    state.hamd_just_locked = newLockedCodes.filter((c) => !prevLockedCodes.includes(c));
  }

  async buildNaturalResponse(session, message) {
    const state = session.state;
    const flowState = normalizeObjectState(state, 'flow_state', {});

    // 氣氛保護：情緒承載模式時不插入正式探針
    const atmosphereProtected = Boolean(flowState.atmosphere_protection);
    let canProbeHamd = Boolean(flowState.can_probe_hamd) && !atmosphereProtected;

    // 結束鎖：取得目前已鎖定的題項
    const lockedItemCodes = getLockedItemCodes(state);

    // ── 風險訊號最高優先：直接覆寫一切，跳過 probe selector / lock / question_type 檢查 ──
    const riskOverride = !atmosphereProtected
      && detectRiskSignal(message, state)
      && !lockedItemCodes.includes('suicide');

    let formalProbe;
    if (riskOverride) {
      formalProbe = { ...RISK_PROBE, should_ask: 'yes' };
      canProbeHamd = true;
      ensureAiTrace(state).probe_selector = {
        should_ask: 'yes',
        item_code: RISK_PROBE.item_code,
        item_label: RISK_PROBE.item_label,
        question_type: RISK_PROBE.question_type,
        reason: 'risk_signal_override_skip_selector',
        probe_question: RISK_PROBE.probe_question,
        probe_status: 'risk_override',
        skipped_items: getSkippedItemCodes(state)
      };
    } else {
      formalProbe = buildFormalAssessmentProbeFallback(state, message);
      if (canProbeHamd) {
        formalProbe = await this.runJsonTask('hamdFormalProbeSelector', session, message, {
          extraContext: {
            formal_probe: {
              items: getFormalTargetItems(state, 4, message)
            }
          },
          fallback: formalProbe
        });
      } else {
        // 氣氛保護：強制關閉探針
        formalProbe = { ...formalProbe, should_ask: 'no' };
      }
      // 循環偵測：判斷本次探針是 fresh / rescued / circling_skipped
      const _skippedCodes = getSkippedItemCodes(state);
      const _circlingStatus = (() => {
        if (formalProbe.should_ask !== 'yes') return 'no_probe';
        if (_skippedCodes.includes(formalProbe.item_code)) return 'circling_skipped';
        if (formalProbe.reason === 'sticky_retry') return 'rescued';
        if (formalProbe.reason === 'sticky_first') return 'sticky';
        return 'fresh';
      })();
      ensureAiTrace(state).probe_selector = {
        should_ask: formalProbe.should_ask,
        item_code: formalProbe.item_code,
        item_label: formalProbe.item_label,
        question_type: formalProbe.question_type,
        reason: formalProbe.reason,
        probe_question: formalProbe.probe_question,
        probe_status: _circlingStatus,
        skipped_items: _skippedCodes
      };

      // 若探針選到已鎖定題項，強制取消
      if (formalProbe.should_ask === 'yes' && lockedItemCodes.includes(formalProbe.item_code)) {
        formalProbe = { ...formalProbe, should_ask: 'no', reason: 'item_locked' };
      }

      // 確保 question_type 在允許清單內
      if (formalProbe.should_ask === 'yes' && !ALLOWED_QUESTION_TYPES.includes(formalProbe.question_type)) {
        formalProbe = { ...formalProbe, question_type: 'frequency' };
      }
    }

    const conversationModeResult = await this.judgeConversationMode(session, message, formalProbe);
    if (!riskOverride) {
      if (conversationModeResult.decision.mode === 'clarifying') {
        formalProbe = { ...formalProbe, should_ask: 'no', reason: 'mode_clarifying_hold_hamd' };
      } else if (conversationModeResult.decision.mode === 'probing' && conversationModeResult.decision.target_item_code) {
        const probingProbe = buildFormalProbeFromItemCode(state, conversationModeResult.decision.target_item_code, 'mode_probing_same_item');
        if (probingProbe.should_ask === 'yes') formalProbe = probingProbe;
      } else if (conversationModeResult.decision.mode === 'switching' && conversationModeResult.decision.target_item_code) {
        const switchingProbe = buildFormalProbeFromItemCode(state, conversationModeResult.decision.target_item_code, 'mode_switching_new_item');
        if (switchingProbe.should_ask === 'yes') {
          // 跨維度換題 → 插入銜接句
          const lastAskedItem = String(state.hamd_last_asked_item || '').trim();
          const transition = buildSwitchingTransition(lastAskedItem, conversationModeResult.decision.target_item_code);
          if (transition) {
            switchingProbe.probe_question = transition + switchingProbe.probe_question;
            switchingProbe.has_transition = true;
          }
          formalProbe = switchingProbe;
        }
      }

      const _skippedCodes = getSkippedItemCodes(state);
      const _circlingStatus = (() => {
        if (formalProbe.should_ask !== 'yes') return 'no_probe';
        if (_skippedCodes.includes(formalProbe.item_code)) return 'circling_skipped';
        if (formalProbe.reason === 'sticky_retry' || formalProbe.reason === 'mode_probing_same_item') return 'rescued';
        if (formalProbe.reason === 'sticky_first') return 'sticky';
        return 'fresh';
      })();
      ensureAiTrace(state).probe_selector = {
        should_ask: formalProbe.should_ask,
        item_code: formalProbe.item_code,
        item_label: formalProbe.item_label,
        question_type: formalProbe.question_type,
        reason: formalProbe.reason,
        probe_question: formalProbe.probe_question,
        probe_status: _circlingStatus,
        skipped_items: _skippedCodes
      };
    }

    let answer = await this.runTextTask('smartHunter', session, message, {
      extraContext: {
        formal_probe: formalProbe,
        flow_state: flowState
      }
    });
    ensureAiTrace(state).smart_hunter = {
      sub_mode: flowState.sub_mode,
      can_probe_hamd: canProbeHamd,
      formal_probe_received: {
        should_ask: formalProbe.should_ask,
        item_code: formalProbe.item_code,
        question_type: formalProbe.question_type,
        probe_question: formalProbe.probe_question
      },
      raw_output: String(answer || '').slice(0, 500)
    };

    // ── 統一後處理器（取代散落三層）────────────────────────────────────────────
    const postProcessResult = clinicalPostProcessor(answer, {
      userText: message,
      state,
      formalProbe: (canProbeHamd && formalProbe.should_ask === 'yes') ? formalProbe : null,
      atmosphereProtected,
      conversationDecision: conversationModeResult.decision,
      resolvedConversationTarget: conversationModeResult.resolvedTarget
    });
    answer = postProcessResult.text;
    const clinicalTrace = postProcessResult.debugTrace;
    const clarifyingInterventionActive = clinicalTrace && clinicalTrace.intervention_action === 'clarifying_probe';

    if (clarifyingInterventionActive) {
      formalProbe = {
        should_ask: 'no',
        item_code: '',
        item_label: '',
        question_type: '',
        probe_question: '',
        reason: 'clarifying_override'
      };
    }

    // ── 存 debug trace 到 state（API 可讀）──
    state._clinical_trace = clinicalTrace;


    // 後處理完成後：重建 probeActive 狀態（供後續 probe_count 追蹤用）
    let normalizedProbeQuestion = String(formalProbe.probe_question || '').trim();
    let probeActive = canProbeHamd && formalProbe.should_ask === 'yes' && Boolean(normalizedProbeQuestion);

    // 若統一後處理器替換了問句，且非氣氛保護模式，視為 probe active
    if (!probeActive && !atmosphereProtected && !clarifyingInterventionActive) {
      const postLastQ = extractLastQuestion(answer);
      if (postLastQ && isScoreableQuestion(postLastQ.question)) {
        // 找到後處理器注入的可評分問題 → 自動關聯到 next_item
        const nextCode = pickNextUnlockedItemCode(state);
        if (nextCode) {
          const def = HAMD_FORMAL_ITEM_MAP[nextCode];
          if (def) {
            formalProbe = {
              should_ask: 'yes',
              item_code: nextCode,
              item_label: def.item_label,
              question_type: 'frequency',
              probe_question: postLastQ.question,
              reason: 'post_processor_injected'
            };
            normalizedProbeQuestion = postLastQ.question;
            probeActive = true;
          }
        }
      }
    }

    // 評分完成中斷點：已停用（meta block 不對使用者顯示）
    // 仍保留 turn 計數 / hamd_just_locked 偵測邏輯以供 trace / 未來重啟用
    state.hamd_turn_count = Number(state.hamd_turn_count || 0) + 1;
    const maybeAppendCompletionNote = (text) => text;

    if (probeActive && formalProbe.item_code) {
      const assessment = hydrateFormalAssessment(state.hamd_formal_assessment);
      // 累積該題項的探針次數（結束鎖 probe_count）
      const probeItem = assessment.items.find((i) => i.item_code === formalProbe.item_code);
      if (probeItem) probeItem.probe_count = (probeItem.probe_count || 0) + 1;
      assessment.pending_probe_item_code = formalProbe.item_code;
      assessment.pending_probe_question = normalizedProbeQuestion;
      assessment.assessment_mode = 'smart_hunter_probe';
      assessment.pending_probe_meta = {
        item_code: formalProbe.item_code,
        type: formalProbe.question_type || 'frequency'
      };
      state.hamd_formal_assessment = assessment;
      // 重新計算鎖定狀態（probe_count 可能剛達到 2）
      const progressItems2 = normalizeObjectState(state, 'hamd_progress_state', {}).items || [];
      state.hamd_item_lock_state = computeHamdItemLockState(progressItems2, assessment.items);

      // 遞增 consecutive_probes
      this.updateFlowState(state, {
        mode: flowState.mode,
        can_probe_hamd: true,
        consecutive_probes: Number(flowState.consecutive_probes || 0)
      });

      const finalAnswer = maybeAppendCompletionNote(answer);
      state.hamd_just_locked = [];
      return finalAnswer;
    }

    // 沒有插入探針：重置連續追問計數
    if (!atmosphereProtected) {
      this.updateFlowState(state, {
        mode: flowState.mode,
        can_probe_hamd: false,
        consecutive_probes: 0
      });
    }

    const finalAnswer = maybeAppendCompletionNote(answer);
    state.hamd_just_locked = [];
    return finalAnswer;
  }

  async updateSummaryChain(session, message, options = {}) {
    const strictAi = Boolean(options.strictAi);
    const includePatientAnalysis = options.includePatientAnalysis !== false;
    const state = session.state;
    const baseLongitudinal = buildLongitudinalEvidence(session);
    const phq9Context = buildPhq9AssessmentSummary(state.phq9_assessment);
    const hasPhq9Evidence = hasMeaningfulPhq9Assessment(state.phq9_assessment);
    const bridgeBase = buildSymptomBridgeFallback(baseLongitudinal);
    if (strictAi && baseLongitudinal.userMessages.length === 0 && !hasPhq9Evidence) {
      const error = new Error('目前沒有可供分析的臨床對話內容，無法執行 AI 症狀對接。');
      error.code = 'no_clinical_messages_for_ai';
      error.status = 422;
      throw error;
    }
    if (baseLongitudinal.userMessages.length > 0) {
      let generatedBridge = bridgeBase;
      try {
        generatedBridge = await this.runJsonTask('symptomBridgeBuilder', session, message, {
          fallback: bridgeBase,
          requireValidJson: strictAi,
          extraContext: {
            deterministic_longitudinal: baseLongitudinal,
            transcript_window: this.buildTranscriptWindow(session)
          }
        });
      } catch (error) {
        generatedBridge = bridgeBase;
        state.symptom_bridge_error = error && error.message ? error.message : 'symptomBridgeBuilder_failed';
      }
      if (generatedBridge !== bridgeBase && Object.prototype.hasOwnProperty.call(state, 'symptom_bridge_error')) {
        delete state.symptom_bridge_error;
      }
      state.symptom_bridge_state = mergeSymptomBridgeState(bridgeBase, generatedBridge);
    } else {
      if (Object.prototype.hasOwnProperty.call(state, 'symptom_bridge_error')) {
        delete state.symptom_bridge_error;
      }
      state.symptom_bridge_state = bridgeBase;
    }
    const longitudinal = buildLongitudinalEvidence(session, state.symptom_bridge_state);
    
    // JS Fallbacks / Base states (ensure safe structure)
    state.hamd_progress_state = enrichHamdProgressState(
      normalizeObjectState(state, 'hamd_progress_state', {}),
      longitudinal
    );
    const formalAssessment = hydrateFormalAssessment(state.hamd_formal_assessment);
    const baseSummaryDraft = buildSummaryDraftState(state, longitudinal, message);
    const baseClinicianSummary = buildClinicianSummaryDraft(
      longitudinal,
      state,
      formalAssessment,
      normalizeObjectState(state, 'clinician_summary_draft', {})
    );
    const basePatientReview = buildPatientReviewPacket(baseClinicianSummary);
    const basePatientAnalysis = buildPatientAnalysis(state, message);
    const basePatientAuth = buildPatientAuthorizationState(baseClinicianSummary, basePatientReview);
    const baseFhirDelivery = buildFhirDeliveryDraft(baseClinicianSummary, longitudinal, state, formalAssessment);
    const baseDeliveryReadiness = buildDeliveryReadinessState(baseFhirDelivery, basePatientAuth);

    const shouldBuildStructuredOutputs = longitudinal.userMessages.length > 0 || hasPhq9Evidence;
    if (shouldBuildStructuredOutputs) {
      const generatedSummaryDraft = await this.runJsonTask('summaryDraftBuilder', session, message, {
        fallback: baseSummaryDraft,
        requireValidJson: strictAi,
        extraContext: {
          deterministic_summary: baseSummaryDraft,
          longitudinal_evidence: longitudinal,
          phq9_assessment: phq9Context.phq9_assessment,
          phq9_summary: phq9Context.phq9_summary,
          phq9_total_score: phq9Context.phq9_total_score,
          phq9_severity_band: phq9Context.phq9_severity_band,
          phq9_severity_label: phq9Context.phq9_severity_label,
          phq9_answers: phq9Context.phq9_answers,
          phq9_questionnaire_targets: phq9Context.phq9_questionnaire_targets
        }
      });
      state.summary_draft_state = mergeSummaryDraftState(baseSummaryDraft, generatedSummaryDraft);

      const generatedClinicianSummary = await this.runJsonTask('clinicianSummaryBuilder', session, message, {
        fallback: baseClinicianSummary,
        requireValidJson: strictAi,
        extraContext: {
          deterministic_summary: state.summary_draft_state,
          longitudinal_evidence: longitudinal,
          clinician_base: baseClinicianSummary,
          phq9_assessment: phq9Context.phq9_assessment,
          phq9_summary: phq9Context.phq9_summary,
          phq9_total_score: phq9Context.phq9_total_score,
          phq9_severity_band: phq9Context.phq9_severity_band,
          phq9_severity_label: phq9Context.phq9_severity_label,
          phq9_answers: phq9Context.phq9_answers,
          phq9_questionnaire_targets: phq9Context.phq9_questionnaire_targets
        }
      });
      state.clinician_summary_draft = mergeClinicianSummaryDraft(
        baseClinicianSummary,
        generatedClinicianSummary,
        formalAssessment
      );

      const reviewBase = buildPatientReviewPacket(state.clinician_summary_draft);
      const generatedReviewPacket = await this.runJsonTask('patientReviewBuilder', session, message, {
        fallback: reviewBase,
        requireValidJson: strictAi,
        extraContext: {
          clinician_summary_draft: state.clinician_summary_draft,
          longitudinal_evidence: longitudinal,
          phq9_assessment: phq9Context.phq9_assessment,
          phq9_summary: phq9Context.phq9_summary,
          phq9_total_score: phq9Context.phq9_total_score,
          phq9_severity_band: phq9Context.phq9_severity_band,
          phq9_severity_label: phq9Context.phq9_severity_label
        }
      });
      state.patient_review_packet = mergePatientReviewPacket(reviewBase, generatedReviewPacket);

      const authBase = buildPatientAuthorizationState(state.clinician_summary_draft, state.patient_review_packet);
      const generatedAuthState = await this.runJsonTask('patientAuthorizationBuilder', session, message, {
        fallback: authBase,
        requireValidJson: strictAi,
        extraContext: {
          clinician_summary_draft: state.clinician_summary_draft,
          patient_review_packet: state.patient_review_packet,
          phq9_assessment: phq9Context.phq9_assessment,
          phq9_summary: phq9Context.phq9_summary
        }
      });
      state.patient_authorization_state = mergePatientAuthorizationState(authBase, generatedAuthState);

      const fhirBase = buildFhirDeliveryDraft(state.clinician_summary_draft, longitudinal, state, formalAssessment);
      const generatedFhirDraft = await this.runJsonTask('fhirDeliveryBuilder', session, message, {
        fallback: fhirBase,
        requireValidJson: strictAi,
        extraContext: {
          clinician_summary_draft: state.clinician_summary_draft,
          patient_review_packet: state.patient_review_packet,
          patient_authorization_state: state.patient_authorization_state,
          longitudinal_evidence: longitudinal,
          phq9_assessment: phq9Context.phq9_assessment,
          phq9_summary: phq9Context.phq9_summary,
          phq9_total_score: phq9Context.phq9_total_score,
          phq9_severity_band: phq9Context.phq9_severity_band,
          phq9_severity_label: phq9Context.phq9_severity_label,
          phq9_answers: phq9Context.phq9_answers,
          phq9_questionnaire_targets: phq9Context.phq9_questionnaire_targets
        }
      });
      state.fhir_delivery_draft = mergeFhirDeliveryDraft(fhirBase, generatedFhirDraft);

      if (includePatientAnalysis) {
        const basePatientAnalysisOutput = buildPatientAnalysis(state, message);
        const generatedPatientAnalysisText = await this.runTextTask('patientAnalysisBuilder', session, message, {
          model: this.model,
          fetchImpl: this.fetchImpl,
          apiKey: this.apiKey,
          baseUrl: this.baseUrl,
          extraContext: {
          clinician_summary_draft: state.clinician_summary_draft,
          patient_review_packet: state.patient_review_packet,
          hamd_progress_state: state.hamd_progress_state,
          burden_level_state: state.burden_level_state,
          longitudinal_evidence: longitudinal,
          phq9_assessment: phq9Context.phq9_assessment,
          phq9_summary: phq9Context.phq9_summary,
          phq9_total_score: phq9Context.phq9_total_score,
          phq9_severity_band: phq9Context.phq9_severity_band,
          phq9_severity_label: phq9Context.phq9_severity_label
        }
      });
        const generatedPatientAnalysis = tryParseJson(generatedPatientAnalysisText, null);
        state.patient_analysis = generatedPatientAnalysis && typeof generatedPatientAnalysis === 'object'
          ? mergePatientAnalysis(basePatientAnalysisOutput, generatedPatientAnalysis)
          : buildPatientAnalysisFromRawModelText(generatedPatientAnalysisText, basePatientAnalysisOutput);
      }

      const readinessBase = buildDeliveryReadinessState(state.fhir_delivery_draft, state.patient_authorization_state);
      const generatedReadiness = await this.runJsonTask('deliveryReadinessBuilder', session, message, {
        fallback: readinessBase,
        requireValidJson: strictAi,
        extraContext: {
          clinician_summary_draft: state.clinician_summary_draft,
          patient_authorization_state: state.patient_authorization_state,
          fhir_delivery_draft: state.fhir_delivery_draft,
          phq9_assessment: phq9Context.phq9_assessment,
          phq9_summary: phq9Context.phq9_summary
        }
      });
      state.delivery_readiness_state = mergeDeliveryReadinessState(readinessBase, generatedReadiness);
    } else {
      state.summary_draft_state = baseSummaryDraft;
      state.clinician_summary_draft = baseClinicianSummary;
      state.patient_review_packet = basePatientReview;
      if (includePatientAnalysis) {
        state.patient_analysis = basePatientAnalysis;
      }
      state.patient_authorization_state = basePatientAuth;
      state.fhir_delivery_draft = baseFhirDelivery;
      state.delivery_readiness_state = baseDeliveryReadiness;
    }
  }

  async ensureStructuredOutputs(session, instruction = '', options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);
    if (!forceRefresh && session.structured_revision === session.revision) {
      return;
    }
    const normalizedInstruction = String(instruction || '').trim();
    const triggerMessage =
      (isDraftRelevantInstruction(normalizedInstruction) ? normalizedInstruction : '') ||
      session.memory_snapshot.last_user_message ||
      session.history.slice().reverse().find((item) => item.role === 'user' && isDraftRelevantHistoryItem(item))?.content ||
      '';
    await this.updateSummaryChain(session, triggerMessage, {
      strictAi: Boolean(options.strictAi),
      includePatientAnalysis: options.includePatientAnalysis !== false
    });
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
    this.syncPatientProfile(session, payload.patient_profile);
    this.syncPhq9Assessment(session, payload.phq9_assessment);
    if (Array.isArray(payload.client_history) && payload.client_history.length && (!Array.isArray(session.history) || session.history.length === 0)) {
      const hydratedHistory = normalizeClientHistoryForHydration(payload.client_history, MAX_TRANSCRIPT_TURNS_FOR_RETRIEVAL);
      if (hydratedHistory.length) {
        session.history = hydratedHistory;
        const lastUserMessage = hydratedHistory.slice().reverse().find((item) => item.role === 'user' && item.kind === 'chat');
        if (lastUserMessage) {
          session.memory_snapshot.last_user_message = lastUserMessage.content;
        }
        const userChatCount = hydratedHistory.filter((item) => item.role === 'user' && item.kind === 'chat').length;
        session.revision = Math.max(Number(session.revision || 0), userChatCount);
      }
    }
    const outputType = String(payload.output_type || '').trim();
    const instruction = String(payload.instruction || '').trim();
    if (!outputType) {
      const error = new Error('output_type is required.');
      error.status = 400;
      error.code = 'missing_output_type';
      throw error;
    }
    const cacheKey = outputType;
    const cached = session.output_cache[cacheKey];
    const shouldBypassCache = outputType === 'patient_analysis' || outputType === 'clinician_summary' || outputType === 'fhir_delivery';
    const forceRefresh = Boolean(payload.force_refresh) || shouldBypassCache;
    const currentLongitudinal = buildLongitudinalEvidence(
      session,
      normalizeObjectState(session.state, 'symptom_bridge_state', {})
    );
    const currentClinicianDraft = normalizeObjectState(session.state, 'clinician_summary_draft', {});
    const currentPatientAnalysis = normalizeObjectState(session.state, 'patient_analysis', {});
    const currentFhirDraft = normalizeObjectState(session.state, 'fhir_delivery_draft', {});
    const currentSummaryDraft = normalizeObjectState(session.state, 'summary_draft_state', {});
    const hasInvalidStructuredState = (
      (hasMeaningfulLongitudinalEvidence(currentLongitudinal) && isGenericDraftText(currentSummaryDraft.draft_summary)) ||
      (outputType === 'clinician_summary' && isEmptyClinicianDraft(currentClinicianDraft)) ||
      (outputType === 'patient_analysis' && isEmptyPatientAnalysis(currentPatientAnalysis)) ||
      (outputType === 'fhir_delivery' && isEmptyFhirDraft(currentFhirDraft))
    );

    if (!forceRefresh && cached && cached.revision === session.revision && !hasInvalidStructuredState) {
      const cachedValue = Object.assign({}, cached.value || {});
      cachedValue.metadata = Object.assign({}, cachedValue.metadata || {}, { output_source: 'cache' });
      return cachedValue;
    }
    if (hasInvalidStructuredState || forceRefresh) {
      delete session.output_cache[cacheKey];
    }

    await this.ensureStructuredOutputs(session, instruction, {
      forceRefresh: forceRefresh || hasInvalidStructuredState,
      strictAi: outputType === 'clinician_summary' || outputType === 'patient_analysis' || outputType === 'fhir_delivery',
      includePatientAnalysis: outputType === 'patient_analysis'
    });

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
        output_source: 'fresh',
        active_mode: session.state.active_mode,
        risk_flag: session.state.risk_flag,
        latest_tag_payload: normalizeObjectState(session.state, 'latest_tag_payload', {}),
        burden_level_state: normalizeObjectState(session.state, 'burden_level_state', {}),
        hamd_formal_assessment: normalizeObjectState(session.state, 'hamd_formal_assessment', {})
      }
    };

    const shouldCacheResponse = !(
      (outputType === 'clinician_summary' && isEmptyClinicianDraft(output)) ||
      (outputType === 'patient_analysis' && isEmptyPatientAnalysis(output)) ||
      (outputType === 'fhir_delivery' && isEmptyFhirDraft(output))
    );
    if (shouldCacheResponse) {
      session.output_cache[cacheKey] = {
        revision: session.revision,
        value: response
      };
    } else {
      delete session.output_cache[cacheKey];
    }
    this.persistSessions();

    return response;
  }

  buildPromptContext(session, message, extraContext = {}) {
    const transcriptWindow = this.buildTranscriptWindow(session);
    const therapeuticProfile = normalizeTherapeuticProfile(session?.state?.therapeutic_profile || {}, session?.user || '');
    return Object.assign(
      {
        sys: {
          query: message
        },
        conversation: session.state,
        retrieval: transcriptWindow,
        memory: {
          current_memory: KnowYouMemory.buildMemoryContextString(therapeuticProfile),
          meter: this.buildKnowYouMemoryMeter(session, message),
          profile: therapeuticProfile
        }
      },
      extraContext || {}
    );
  }

  buildDraftRelevantHistory(session) {
    return session.history.filter((item) => classifyDraftHistoryItem(item).include);
  }

  buildTranscriptWindow(session) {
    const classifiedHistory = (Array.isArray(session?.history) ? session.history : [])
      .map((item) => Object.assign({}, classifyDraftHistoryItem(item), { item }));
    const relevantHistory = classifiedHistory.filter((entry) => entry.include).map((entry) => entry.item);
    const excludedMessages = classifiedHistory
      .filter((entry) => !entry.include && entry.content)
      .map((entry) => ({ role: entry.role, content: entry.content, reason: entry.reason }))
      .slice(-12);
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
      excluded_messages: excludedMessages,
      context_rule: 'Ignore mode-switch, command, and output-control turns. Treat only real chat content as clinical draft evidence.'
    };
  }

  buildHistory(session) {
    return this.buildDraftRelevantHistory(session).slice(-MAX_CHAT_HISTORY_FOR_MODEL);
  }

  async runTextTask(promptKey, session, message, options = {}) {
    const includeMemoryContext = options.includeMemoryContext !== false;
    const memoryPrefix = includeMemoryContext ? this.buildKnowYouMemoryPrefix(session, message) : '';
    const systemPrompt = interpolateTemplate(
      this.prompts[promptKey],
      this.buildPromptContext(session, message, options.extraContext)
    );
    const finalSystemPrompt = memoryPrefix ? `${memoryPrefix}\n\n${systemPrompt}` : systemPrompt;
    const result = await this.modelClient(
      {
        systemPrompt: finalSystemPrompt,
        userPrompt: options.userPromptOverride || message,
        history: Array.isArray(options.historyOverride) ? options.historyOverride : this.buildHistory(session),
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
    if (!parsed && options.requireValidJson) {
      if (options.fallback != null) {
        console.warn(`AI task ${promptKey} did not return valid JSON; using fallback.`);
        return options.fallback;
      }
      const error = new Error(`AI task ${promptKey} did not return valid JSON.`);
      error.code = 'ai_invalid_json_output';
      error.status = 502;
      error.prompt_key = promptKey;
      throw error;
    }
    return parsed || options.fallback || {};
  }

  async runClassifier(promptKey, session, message, allowedValues, fallback, options = {}) {
    const includeMemoryContext = options.includeMemoryContext !== false;
    const memoryPrefix = includeMemoryContext ? this.buildKnowYouMemoryPrefix(session, message) : '';
    const systemPrompt = interpolateTemplate(
      this.prompts[promptKey],
      this.buildPromptContext(session, message, options.extraContext)
    );
    const finalSystemPrompt = memoryPrefix ? `${memoryPrefix}\n\n${systemPrompt}` : systemPrompt;
    const result = await this.modelClient(
      {
        systemPrompt: finalSystemPrompt,
        userPrompt: options.userPromptOverride || message,
        history: Array.isArray(options.historyOverride) ? options.historyOverride : [],
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
  buildClarifyingProbe,
  createDefaultState,
  createSimpleRetriever,
  defaultSessionExport,
  tryParseJson
};

