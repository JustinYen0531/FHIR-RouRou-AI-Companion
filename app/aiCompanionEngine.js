const fs = require('fs');
const path = require('path');
const { completeChat, DEFAULT_GROQ_MODEL, DEFAULT_GOOGLE_MODEL } = require('./llmChatClient');

const ROOT_DIR = path.join(__dirname, '..');
const STATE_SCHEMA_PATH = path.join(ROOT_DIR, 'flowise', 'FLOWISE_STATE_SCHEMA.json');
const PROMPTS_DIR = path.join(ROOT_DIR, 'flowise', 'prompts');
const RAG_DIR = path.join(__dirname, 'rag');
const RAG_TEXT_PATH = path.join(RAG_DIR, 'CompanionAI_RAG資料.txt');
const DEFAULT_AUTHOR = 'AI Companion Node Engine';

const PROMPT_FILES = {
  missionRetrievalAudit: 'mission-retrieval-audit.md',
  riskStructurer: 'risk-structurer.md',
  safetyResponse: 'safety-response.md',
  summaryDraftBuilder: 'summary-draft-builder.md',
  clinicianSummaryBuilder: 'clinician-summary-builder.md',
  patientReviewBuilder: 'patient-review-builder.md',
  patientAuthorizationBuilder: 'patient-authorization-builder.md',
  fhirDeliveryBuilder: 'fhir-delivery-builder.md',
  deliveryReadinessBuilder: 'delivery-readiness-builder.md',
  tagStructurer: 'tag-structurer.md',
  burdenLevelBuilder: 'burden-level-builder.md',
  intentClassifier: 'intent-classifier.md',
  lowEnergyDetector: 'low-energy-detector.md',
  overrideRouter: 'override-router.md',
  voidBox: 'void-box.md',
  soulMate: 'soul-mate.md',
  hamdProgressTracker: 'ham-d-progress-tracker.md',
  missionGuide: 'mission-guide.md',
  optionRetrievalAudit: 'option-retrieval-audit.md',
  optionSelector: 'option-selector.md',
  smartHunter: 'smart-hunter.md',
  followupOutputClassifier: 'follow-up-output-classifier.md',
  followupResolver: 'follow-up-resolver.md',
  followupFinalizer: 'follow-up-finalizer.md',
  clarifyQuestion: 'clarify-question.md'
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
    red_flag_payload: normalizeObjectState(session.state, 'red_flag_payload', {}),
    patient_authorization_state: normalizeObjectState(session.state, 'patient_authorization_state', {}),
    delivery_readiness_state: normalizeObjectState(session.state, 'delivery_readiness_state', {}),
    patient_review_packet: normalizeObjectState(session.state, 'patient_review_packet', {}),
    fhir_delivery_draft: normalizeObjectState(session.state, 'fhir_delivery_draft', {}),
    summary_draft_state: normalizeObjectState(session.state, 'summary_draft_state', {})
  };
}

function buildPatientAnalysis(state, fallbackMessage = '') {
  const clinician = normalizeObjectState(state, 'clinician_summary_draft', {});
  const patientReview = normalizeObjectState(state, 'patient_review_packet', {});
  const concerns = normalizeArray(clinician.chief_concerns).slice(0, 3);
  const observations = normalizeArray(clinician.symptom_observations).slice(0, 3);
  const summary =
    patientReview.patient_facing_summary ||
    clinician.draft_summary ||
    fallbackMessage ||
    '目前還沒有足夠內容可以整理成給病人的分析。';

  const bullets = [...concerns, ...observations].slice(0, 4);
  const markdown = [
    '## 給你的分析',
    '',
    summary,
    '',
    '### 我目前注意到的重點',
    ...(bullets.length ? bullets.map((item) => `- ${item}`) : ['- 目前還需要更多對話，才能整理出更完整的重點。']),
    '',
    '### 接下來可以怎麼做',
    '- 如果你願意，可以繼續聊最近最卡的一件事。',
    '- 如果你想整理成醫療用摘要，可以按「整理給醫師」。',
    '',
    '### 提醒',
    '這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。'
  ].join('\\n');

  return {
    version: 'p3_patient_analysis_v1',
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
    this.model = options.model || (this.provider === 'google' ? DEFAULT_GOOGLE_MODEL : DEFAULT_GROQ_MODEL);
    this.baseUrl = options.baseUrl;
    this.apiKey = options.apiKey || '';
    this.fetchImpl = options.fetchImpl;
    this.sessions = options.sessions || new Map();
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

  getOrCreateSession(id, user) {
    const sessionId = id || `conv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
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
    }
    const session = this.sessions.get(sessionId);
    session.user = user || session.user;
    session.updatedAt = this.now();
    return session;
  }

  async handleMessage(payload, options = {}) {
    const session = this.getOrCreateSession(payload.conversation_id, payload.user);
    const state = session.state;
    const message = String(payload.message || '').trim();
    if (!message) {
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

    session.history.push({ role: 'user', content: message });
    session.revision += 1;
    session.memory_snapshot.last_user_message = message;

    const command = this.detectCommand(message);
    if (command) {
      Object.assign(state, COMMAND_MAP[command]);
      const answer = state.command_feedback;
      session.history.push({ role: 'assistant', content: answer });
      this.updateMemorySnapshot(session, answer);
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

    const outputType = this.detectOutputCommand(message);
    if (outputType) {
      const outputResult = await this.generateOutput({
        conversation_id: session.id,
        user: session.user,
        output_type: outputType,
        instruction: message
      });
      session.history.push({ role: 'assistant', content: outputResult.formatted_text });
      this.updateMemorySnapshot(session, outputResult.formatted_text);
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
      session.history.push({ role: 'assistant', content: answer });
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
      answer = await this.runTextTask('smartHunter', session, message);
      }

    session.history.push({ role: 'assistant', content: answer });
    this.updateMemorySnapshot(session, answer);

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
        draft_summary: message
      }
    });
    state.clinician_summary_draft = await this.runJsonTask('clinicianSummaryBuilder', session, message, {
      fallback: {
        summary_version: 'p1_clinician_draft_v1',
        active_mode: state.active_mode,
        risk_level: state.risk_flag === 'true' ? 'high' : 'watch',
        chief_concerns: [message],
        symptom_observations: normalizeArray(normalizeObjectState(state, 'hamd_progress_state', {}).recent_evidence),
        hamd_signals: normalizeArray(normalizeObjectState(state, 'hamd_progress_state', {}).covered_dimensions),
        followup_needs: [],
        safety_flags: normalizeArray(normalizeObjectState(state, 'red_flag_payload', {}).warning_tags),
        patient_tone: 'unknown',
        draft_summary: typeof state.summary_draft_state === 'object' ? state.summary_draft_state.draft_summary || message : message
      }
    });
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
        narrative_summary: typeof state.clinician_summary_draft === 'object' ? state.clinician_summary_draft.draft_summary || message : message
      }
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
    const triggerMessage =
      String(instruction || '').trim() ||
      session.memory_snapshot.last_user_message ||
      session.history.slice().reverse().find((item) => item.role === 'user')?.content ||
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
    const session = this.getOrCreateSession(payload.conversation_id, payload.user);
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
        burden_level_state: normalizeObjectState(session.state, 'burden_level_state', {})
      }
    };

    session.output_cache[cacheKey] = {
      revision: session.revision,
      value: response
    };

    return response;
  }

  buildPromptContext(session, message, extraContext = {}) {
    return Object.assign(
      {
        sys: {
          query: message
        },
        conversation: session.state,
        retrieval: {}
      },
      extraContext || {}
    );
  }

  buildHistory(session) {
    return session.history.slice(-8);
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
