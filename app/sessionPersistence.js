const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_SESSION_STORE_PATH = process.env.VERCEL
  ? path.join(os.tmpdir(), 'ai-companion-sessions.json')
  : path.join(__dirname, '..', '.data', 'ai-companion-sessions.json');
const DEFAULT_DEMO_PATIENT_AUTH_ID = 'patient_1ed3aee1b6f1';
const DEMO_SESSION_USER_IDS = [
  DEFAULT_DEMO_PATIENT_AUTH_ID,
  'competition-showcase-user',
  'web-demo-user',
  'demo-user',
  'patient-001'
];
const COMPETITION_SHOWCASE_SESSION_ID = 'competition-showcase-session';

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

function createCompetitionShowcaseSession() {
  const startedAt = '2026-05-01T14:33:27.990Z';
  const updatedAt = '2026-05-01T15:23:55.846Z';
  const user = 'competition-showcase-user';
  const sessionId = COMPETITION_SHOWCASE_SESSION_ID;
  const clinicianSummary = {
    summary_version: 'p3_clinician_draft_v3',
    active_mode: 'safety',
    risk_level: 'urgent_watch',
    draft_summary: '使用者描述近一至兩週明顯情緒低落、睡眠中斷、做事動力下降與注意力困難，並提到「每次都在天台想東西，有種想跳下的衝動」。AI 已先進入安全陪伴與降載回應，建議臨床端優先評估自傷風險、保護因子、睡眠與憂鬱症狀嚴重度。',
    chief_concerns: [
      '近一至兩週明顯低落與空掉感',
      '睡眠中斷，躺著會一直想事情',
      '做事拖很久才開始，動力與效率下降',
      '在天台出現想跳下的衝動，需要立即安全評估'
    ],
    symptom_observations: [
      '憂鬱心情',
      '興趣與動力下降',
      '失眠與睡眠中斷',
      '注意力下降',
      '自傷衝動與危機情境'
    ],
    symptom_evidence_track: [
      { symptom: 'depressed_mood', evidence: '「整個狀態很空，好像快崩潰了。」' },
      { symptom: 'work_interest', evidence: '「事情不難，但就是提不起勁，會拖很久才開始。」' },
      { symptom: 'insomnia', evidence: '「晚上也不太好睡，躺著會一直想，中間也會醒來。」' },
      { symptom: 'suicidal_ideation', evidence: '「我每次都在天台想東西，有種想跳下的衝動。」' }
    ],
    safety_flags: [
      '出現具體危險場域：天台',
      '描述跳下衝動',
      '需要確認是否仍在高處、是否獨處、是否能離開危險位置',
      '建議立即連結可信任的人或當地緊急資源'
    ],
    followup_needs: [
      '立即確認目前所在位置與身邊是否有人',
      '評估自傷意念頻率、強度、計畫、可近性與保護因子',
      '追蹤睡眠、食慾、注意力、活動量與學業/工作功能',
      '若仍在危險場域，優先安全移動與真人支援'
    ],
    hamd_signals: [
      'depressed_mood',
      'work_interest',
      'insomnia',
      'suicide',
      'psychic_anxiety'
    ]
  };
  const patientAnalysis = {
    plain_summary: '這段對話最重要的是安全：你提到在天台有想跳下的衝動，這不是普通壓力，而是需要先把人從危險位置帶回來的訊號。其他線索包含睡不好、腦袋停不下來、做事提不起勁、覺得自己快撐不住。',
    key_points: [
      '目前最優先：離開天台或任何高處，找到一位真人陪你',
      '你不是在亂想，而是身心壓力已經高到需要被接住',
      '可以把這段整理給醫師或輔導資源，重點放在安全與睡眠',
      'FHIR 草稿已把風險、症狀與回診摘要拆成可交換資料'
    ],
    grounding_questions: [
      '你現在還在天台或高處嗎？',
      '身邊有沒有一個可以立刻打給他的人？',
      '你願不願意先往有人的地方移動？'
    ]
  };
  const patientReview = {
    review_summary: '這份報告可給醫師或校內輔導資源看。請優先確認「天台與想跳下衝動」是否描述正確，因為這會影響安全處置優先順序。',
    confirm_items: [
      '曾在天台想事情，並有想跳下的衝動',
      '近一至兩週睡眠中斷與反覆思考',
      '做事動力下降，開始任務變困難',
      '希望有人一步一步引導'
    ],
    optional_edits: [
      '補充目前是否仍會靠近天台或高處',
      '補充是否曾告訴朋友、家人、老師或醫師',
      '補充最近是否有飲酒、藥物或其他衝動升高因素'
    ]
  };
  const hamdAssessment = {
    scaleVersion: 'HAM-D17 draft',
    totalScore: 18,
    severityBand: 'moderate',
    scoredItems: [
      { id: 'depressed_mood', score: 3, evidence: '明顯低落、空掉感與快崩潰感' },
      { id: 'suicide', score: 3, evidence: '天台情境與想跳下衝動' },
      { id: 'insomnia_middle', score: 2, evidence: '睡眠中斷，半夜醒來' },
      { id: 'work_interest', score: 3, evidence: '提不起勁，拖很久才開始' },
      { id: 'psychic_anxiety', score: 2, evidence: '腦袋停不下來、反覆想事情' }
    ],
    clinicalNote: 'AI 草稿分數僅供臨床訪談前參考，不能取代醫師評估。'
  };
  const fhirDelivery = {
    delivery_status: 'pre_review_ready',
    narrative_summary: 'Pre-visit AI companion draft for urgent safety review: depressive symptoms, insomnia, impaired motivation, and suicidal impulse in rooftop context.',
    questionnaire_targets: [
      'HAM-D depressed mood',
      'HAM-D suicide',
      'HAM-D insomnia',
      'HAM-D work and activities',
      'PHQ-9 item 9 safety follow-up'
    ],
    observation_candidates: [
      { code: 'depressed_mood', display: 'Depressed mood', evidence: '近一至兩週低落、空掉感' },
      { code: 'suicidal_ideation', display: 'Suicidal impulse', evidence: '天台想跳下的衝動' },
      { code: 'insomnia', display: 'Sleep disturbance', evidence: '躺著會一直想，中間會醒來' },
      { code: 'reduced_motivation', display: 'Reduced motivation', evidence: '事情不難但提不起勁' }
    ],
    composition_sections: [
      { title: 'Immediate Safety', focus: 'Rooftop context and impulse to jump require urgent safety assessment.' },
      { title: 'Chief Concerns', focus: 'Low mood, insomnia, impaired motivation, cognitive rumination.' },
      { title: 'Patient Review', focus: 'Patient should confirm wording before sharing unless immediate safety escalation is needed.' }
    ],
    resources: [
      { resource_type: 'Patient', purpose: '病人識別與基本資料' },
      { resource_type: 'Encounter', purpose: 'AI 陪伴對話情境' },
      { resource_type: 'QuestionnaireResponse', purpose: 'HAM-D/PHQ-9 草稿題項' },
      { resource_type: 'Observation', purpose: '症狀與風險線索' },
      { resource_type: 'ClinicalImpression', purpose: '臨床前摘要與風險印象' },
      { resource_type: 'Composition', purpose: '可交付醫師摘要文件' },
      { resource_type: 'DocumentReference', purpose: '完整 AI 報告附件' },
      { resource_type: 'Provenance', purpose: 'AI 生成與病人審閱來源紀錄' }
    ]
  };
  const deliveryResult = {
    delivery_status: 'delivered',
    fhir_base_url: 'https://hapi.fhir.org/baseR4',
    created_resources: {
      Patient: 'Patient/131998314',
      Encounter: 'Encounter/131998315',
      QuestionnaireResponse: 'QuestionnaireResponse/131998316',
      Observation: 'Observation/131998317',
      ClinicalImpression: 'ClinicalImpression/131998321',
      Composition: 'Composition/131998322',
      DocumentReference: 'DocumentReference/131998323',
      Provenance: 'Provenance/131998324'
    },
    validation_report: { valid: true, issue_count: 0, errors: 0, warnings: 0 }
  };
  const sessionExport = {
    patient: {
      key: 'patient-mobqdjl4-y30j5c',
      name: '閻星澄',
      gender: 'unknown',
      birthDate: '2005-05-31',
      phone: '0930775566',
      email: '114307052@g.nccu.edu.tw'
    },
    session: {
      encounterKey: sessionId,
      startedAt,
      endedAt: updatedAt
    },
    author: 'AI Companion Node Engine',
    active_mode: 'safety',
    risk_flag: 'true',
    latest_tag_payload: {
      summary: '使用者描述在天台有想跳下的衝動，並伴隨低落、睡眠中斷與動力下降。',
      sentiment_tags: ['危機', '低落', '失眠', '自傷衝動'],
      stressors: ['學業與生活壓力', '長期疲累', '獨處時反覆思考']
    },
    clinician_summary_draft: clinicianSummary,
    patient_analysis: patientAnalysis,
    patient_review_packet: patientReview,
    fhir_delivery_draft: fhirDelivery,
    fhir_delivery_result: deliveryResult,
    hamd_progress_state: {
      covered_dimensions: ['depressed_mood', 'suicide', 'insomnia', 'work_interest', 'psychic_anxiety'],
      supported_dimensions: ['depressed_mood', 'suicide', 'insomnia', 'work_interest', 'psychic_anxiety'],
      recent_evidence: clinicianSummary.symptom_evidence_track.map((item) => item.evidence),
      next_recommended_dimension: 'protective_factors_and_immediate_safety'
    },
    hamd_formal_assessment: hamdAssessment,
    phq9_assessment: {
      totalScore: 18,
      severity: '中重度',
      item9: 2,
      note: '需追問自傷意念與立即安全。'
    },
    red_flag_payload: {
      warning_tags: ['suicidal_impulse', 'rooftop_context', 'urgent_safety_check'],
      signals: ['天台', '想跳下的衝動', '希望被引導'],
      escalation_recommendation: '立即確認位置，降低獨處與高處風險。'
    },
    patient_authorization_state: {
      authorization_status: 'ready_for_consent',
      share_with_clinician: 'yes'
    },
    delivery_readiness_state: {
      readiness_status: 'ready_for_backend_mapping',
      missing_items: []
    }
  };

  return {
    id: sessionId,
    user,
    startedAt,
    updatedAt,
    history: [
      { role: 'user', content: '我最近真的快撐不住，晚上也不太好睡，躺著會一直想事情，中間也會醒來。' },
      { role: 'assistant', content: '我先陪你把速度放慢。你不用一次講完整，我會一步一步問，先確認你現在是安全的。' },
      { role: 'user', content: '事情明明不難，但我就是提不起勁，會拖很久才開始，整個人很空。' },
      { role: 'assistant', content: '我聽到的是低落、睡眠中斷、動力下降，這些不是你懶，而是身心正在超載。我會先整理成可以給醫師看的重點。' },
      { role: 'user', content: '我每次都在天台想東西，有種想跳下的衝動。你可以引導我嗎？' },
      { role: 'assistant', content: '可以，我現在先把安全放第一位。請你先離開天台邊緣，往有人的地方走，或立刻打給一個你信任的人。你可以只回我：我離開了，或我旁邊有人。' },
      { role: 'user', content: '分析我，然後幫我整理可以給醫師看的 FHIR 報告。' },
      { role: 'assistant', content: '我已整理出病人分析、醫師摘要、HAM-D/PHQ-9 草稿、FHIR Observation/Composition/DocumentReference 與交付紀錄。這份報告的第一重點是立即安全，其次才是症狀追蹤。' }
    ],
    state: {
      active_mode: 'safety',
      risk_flag: 'true',
      latest_tag_payload: sessionExport.latest_tag_payload,
      clinician_summary_draft: clinicianSummary,
      patient_analysis: patientAnalysis,
      patient_review_packet: patientReview,
      fhir_delivery_draft: fhirDelivery,
      fhir_delivery_result: deliveryResult,
      hamd_progress_state: sessionExport.hamd_progress_state,
      hamd_formal_assessment: hamdAssessment,
      phq9_assessment: sessionExport.phq9_assessment,
      red_flag_payload: sessionExport.red_flag_payload,
      patient_authorization_state: sessionExport.patient_authorization_state,
      delivery_readiness_state: sessionExport.delivery_readiness_state,
      therapeutic_profile: {
        version: '1.0',
        userId: user,
        stressors: [{ label: '學業與生活壓力', confidence: 0.8 }],
        triggers: [{ keyword: '天台', reaction: '自傷衝動升高', severity: 'high' }],
        keyThemes: ['安全危機', '睡眠中斷', '動力下降', '反覆思考'],
        positiveAnchors: [{ label: '願意求助並接受引導', category: 'support' }],
        memoryChunks: []
      }
    },
    revision: 8,
    memory_snapshot: {
      note_history: ['天台想跳下的衝動', '睡眠中斷', '動力下降', '希望被引導'],
      last_user_message: '分析我，然後幫我整理可以給醫師看的 FHIR 報告。',
      last_assistant_message: '我已整理出病人分析、醫師摘要、HAM-D/PHQ-9 草稿、FHIR Observation/Composition/DocumentReference 與交付紀錄。',
      active_mode: 'safety',
      risk_flag: 'true',
      latest_tag_summary: sessionExport.latest_tag_payload.summary,
      hamd_focus: 'suicide'
    },
    output_cache: {
      'ui_report_bundle.v1': {
        conversationId: sessionId,
        savedAt: updatedAt,
        reportOutputs: {
          clinician_summary: clinicianSummary,
          patient_analysis: patientAnalysis,
          patient_review: patientReview,
          fhir_delivery: fhirDelivery,
          fhir_delivery_result: deliveryResult,
          session_export: sessionExport,
          updatedAt
        },
        fhirReportHistory: [
          {
            id: 'fhir-1777649035846-4kej2z',
            conversationId: sessionId,
            type: 'delivery',
            createdAt: '2026-05-01T15:23:55.846Z',
            summary: 'AI FHIR 交付已完成，產生 Patient、Encounter、QuestionnaireResponse、Observation、ClinicalImpression、Composition、DocumentReference、Provenance。',
            deliveryStatus: 'delivered',
            targetUrl: 'https://hapi.fhir.org/baseR4',
            resourceCount: 8,
            createdResources: deliveryResult.created_resources
          }
        ]
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
  let changed = false;
  sessions.set(COMPETITION_SHOWCASE_SESSION_ID, normalizeSessionRecord(createCompetitionShowcaseSession()));
  changed = true;
  return changed;
}

function getAuthorizedSessionUserIds(authUser = null) {
  if (!authUser) return [];
  const authId = String(authUser.id || authUser).trim();
  if (!authId) return [];
  return Array.from(new Set([authId, 'competition-showcase-user']));
}

function sessionBelongsToAuthorizedUser(session, authUser = null) {
  if (!authUser) return true;
  if (String(session?.id || '').trim() === COMPETITION_SHOWCASE_SESSION_ID) return true;
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
