const assert = require('assert');
const { AICompanionEngine, defaultSessionExport } = require('./aiCompanionEngine');
const { loadSessionsFromFile, saveSessionsToFile } = require('./sessionPersistence');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createStubModelClient() {
  return async ({ systemPrompt, userPrompt }) => {
    if (systemPrompt.includes('肉肉認識你壓縮器')) {
      return {
        text: JSON.stringify({
          summary: '最近的對話主要集中在工作壓力、睡眠不足與被追著跑的感覺。',
          memory_chunks: [
            {
              title: '工作與睡眠壓力',
              category: 'context',
              summary: '使用者反覆提到工作壓力很大，並伴隨睡不好與疲憊。',
              detail: '可在後續對話中優先記住這是一段長期壓力來源。',
              confidence: 'high'
            }
          ],
          stressors: ['工作壓力'],
          triggers: [{ keyword: '被追著跑', reaction: '容易焦慮', severity: 'medium' }],
          keyThemes: ['工作', '睡眠'],
          positiveAnchors: ['散步'],
          copingStyleHint: '先慢慢說，不要一次塞太多',
          retainedTurnCount: 4
        })
      };
    }
    if (systemPrompt.includes('低能量與認知負擔偵測器')) {
      return { text: 'continue_auto' };
    }
    if (systemPrompt.includes('你是意圖分類器')) {
      return { text: 'mode_5_natural' };
    }
    if (systemPrompt.includes('根據本輪使用者輸入，輸出簡短 JSON 字串')) {
      return {
        text: JSON.stringify({
          route_type: 'normal',
          source_mode: 'mode_5_natural',
          followup_status: 'resolved',
          sentiment_tags: ['tired'],
          behavioral_tags: [],
          cognitive_tags: [],
          warning_tags: [],
          summary: userPrompt
        })
      };
    }
    if (systemPrompt.includes('判斷病人的互動負擔')) {
      return {
        text: JSON.stringify({
          burden_level: 'medium',
          response_style: 'natural',
          followup_budget: '1',
          burden_note: 'stub'
        })
      };
    }
    if (systemPrompt.includes('更新 HAM-D 線索狀態')) {
      return {
        text: JSON.stringify({
          progress_stage: 'initial',
          current_focus: 'depressed_mood',
          supported_dimensions: ['depressed_mood'],
          covered_dimensions: ['depressed_mood'],
          missing_dimensions: ['guilt', 'work_interest', 'retardation', 'agitation', 'somatic_anxiety', 'insomnia'],
          next_recommended_dimension: 'work_interest',
          recent_evidence: ['最近很累'],
          needs_clarification: 'no',
          status_summary: 'stub'
        })
      };
    }
    if (systemPrompt.includes('統一的摘要草稿 JSON')) {
      return {
        text: JSON.stringify({
          active_mode: 'mode_5_natural',
          risk_flag: 'false',
          followup_status: 'resolved',
          latest_tags: 'stub',
          red_flags: 'none',
          hamd_progress: 'stub',
          draft_summary: '最近很累。'
        })
      };
    }
    if (systemPrompt.includes('原句證據軌 + 症狀推論軌')) {
      return {
        text: JSON.stringify({
          bridge_version: 'p1_symptom_bridge_v1',
          evidence_track: [
            {
              evidence_id: 'e1',
              speaker: 'user',
              source_text: '最近很累，而且晚上一直做惡夢，白天上班也被影響。',
              symptom_candidate: '睡眠困擾與疲憊',
              category: 'sleep',
              confidence: 'high'
            }
          ],
          inference_track: [
            {
              symptom_label: '睡眠困擾與白天疲憊',
              summary: '近期持續出現惡夢與疲憊，並已影響白天工作功能。',
              category: 'sleep',
              hamd_signal: 'insomnia',
              severity_hint: 'moderate',
              functional_impact: '影響白天上班',
              timeframe: 'recent_weeks',
              evidence_refs: ['e1'],
              confidence: 'high'
            }
          ],
          excluded_messages: [
            {
              text: '請幫我生成FHIR草稿',
              reason: 'output_control_or_mode_switch'
            }
          ]
        })
      };
    }
    if (systemPrompt.includes('可交付給醫師或臨床團隊閱讀')) {
      return {
        text: JSON.stringify({
          summary_version: 'p1_clinician_draft_v1',
          active_mode: 'mode_5_natural',
          risk_level: 'watch',
          chief_concerns: ['睡眠困擾與白天疲憊'],
          symptom_observations: ['近期持續出現惡夢與疲憊，並已影響白天工作功能。'],
          symptom_evidence_track: [
            {
              evidence_id: 'e1',
              speaker: 'user',
              source_text: '最近很累，而且晚上一直做惡夢，白天上班也被影響。',
              symptom_candidate: '睡眠困擾與疲憊',
              category: 'sleep',
              confidence: 'high'
            }
          ],
          symptom_inference_track: [
            {
              symptom_label: '睡眠困擾與白天疲憊',
              summary: '近期持續出現惡夢與疲憊，並已影響白天工作功能。',
              category: 'sleep',
              hamd_signal: 'insomnia',
              severity_hint: 'moderate',
              functional_impact: '影響白天上班',
              timeframe: 'recent_weeks',
              evidence_refs: ['e1'],
              confidence: 'high'
            }
          ],
          hamd_signals: ['insomnia'],
          followup_needs: [],
          safety_flags: [],
          patient_tone: 'low_energy',
          draft_summary: '近期持續出現惡夢與疲憊，並已影響白天工作功能。'
        })
      };
    }
    if (systemPrompt.includes('給病人自己審閱')) {
      return {
        text: JSON.stringify({
          packet_version: 'p3_patient_review_v1',
          status: 'draft_review',
          patient_facing_summary: '最近很累。',
          confirm_items: [],
          editable_items: [],
          remove_if_wrong: [],
          authorization_needed: 'yes',
          authorization_prompt: '是否分享給臨床團隊？'
        })
      };
    }
    if (systemPrompt.includes('病人審閱 / 授權狀態')) {
      return {
        text: JSON.stringify({
          state_version: 'p3_authorization_state_v1',
          authorization_status: 'ready_for_consent',
          share_with_clinician: 'yes',
          review_blockers: [],
          patient_actions: [],
          restricted_sections: [],
          consent_note: 'stub'
        })
      };
    }
    if (systemPrompt.includes('FHIR / TW Core 映射草稿')) {
      return {
        text: JSON.stringify({
          draft_version: 'p3_fhir_delivery_v1',
          delivery_status: 'ready_for_mapping',
          consent_gate: 'ready_for_consent',
          resources: [],
          narrative_summary: '近期持續出現惡夢與疲憊，並已影響白天工作功能。',
          observation_candidates: [
            {
              focus: '近期持續出現惡夢與疲憊，並已影響白天工作功能。',
              category: 'sleep',
              status: 'preliminary',
              evidence_refs: ['e1'],
              inference_basis: '睡眠困擾與白天疲憊'
            }
          ]
        })
      };
    }
    if (systemPrompt.includes('交付 readiness 狀態')) {
      return {
        text: JSON.stringify({
          state_version: 'p3_delivery_readiness_v1',
          readiness_status: 'ready_for_backend_mapping',
          primary_blockers: [],
          next_step: 'handoff',
          provenance_requirements: [],
          handoff_note: 'stub'
        })
      };
    }
    if (systemPrompt.includes('像真人的朋友')) {
      return { text: '我在，最近真的很累的感覺很不好受。' };
    }
    if (systemPrompt.includes('安全回應節點')) {
      return { text: '我有聽到你現在很痛苦。請立刻聯絡身邊可信任的人或當地緊急協助資源。' };
    }
    return { text: 'stub response' };
  };
}

function createPollutedBridgeModelClient() {
  const fallbackClient = createStubModelClient();
  return async (payload) => {
    const systemPrompt = String(payload?.systemPrompt || '');
    if (systemPrompt.includes('原句證據軌 + 症狀推論軌')) {
      return {
        text: JSON.stringify({
          bridge_version: 'p1_symptom_bridge_v1',
          evidence_track: [
            {
              evidence_id: 'bad_cmd',
              speaker: 'user',
              source_text: '請幫我準備FHIR草稿。',
              symptom_candidate: '整體睡眠品質明顯不佳',
              category: 'patient_report',
              confidence: 'medium'
            },
            {
              evidence_id: 'good_1',
              speaker: 'user',
              source_text: '我最近常常睡不好，而且肚子一直咕嚕咕嚕又悶痛。',
              symptom_candidate: '睡眠與腸胃壓力反應',
              category: 'patient_report',
              confidence: 'high'
            }
          ],
          inference_track: [
            {
              symptom_label: '睡眠與生理症狀困擾',
              summary: '對話中提及recent_dialogue，整體睡眠品質明顯不佳。。',
              category: 'sleep',
              hamd_signal: 'insomnia',
              severity_hint: '',
              functional_impact: '',
              timeframe: 'recent_dialogue',
              evidence_refs: ['bad_cmd'],
              confidence: 'medium'
            },
            {
              symptom_label: '睡眠與生理症狀困擾',
              summary: '最近睡眠品質不佳並伴隨腹部不適。',
              category: 'sleep_or_function',
              hamd_signal: 'insomnia',
              severity_hint: '中度困擾',
              functional_impact: '影響日常生活',
              timeframe: 'recent_weeks',
              evidence_refs: ['good_1'],
              confidence: 'high'
            }
          ],
          excluded_messages: [
            {
              text: '請幫我準備FHIR草稿。',
              reason: 'output_control_or_mode_switch_or_non_clinical'
            }
          ]
        })
      };
    }
    return fallbackClient(payload);
  };
}

async function testCommandRouting() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  const result = await engine.handleMessage({ message: 'auto', user: 'demo', conversation_id: 'conv-1' });
  assert.strictEqual(result.answer.includes('已切回 auto 模式'), true);
  assert.strictEqual(result.state.routing_mode_override, 'auto');
}

async function testHighRiskRouting() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  const result = await engine.handleMessage({ message: '我想死', user: 'demo', conversation_id: 'conv-2' });
  assert.strictEqual(result.state.active_mode, 'safety');
  assert.strictEqual(result.state.risk_flag, 'true');
  assert.strictEqual(result.metadata.route, 'safety');
  assert.strictEqual(result.metadata.risk_flag, 'true');
  assert.ok(result.answer.includes('請立刻聯絡'));
}

async function testSelfHarmStatementRoutesToSafety() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  const result = await engine.handleMessage({ message: '我割了自己的手臂', user: 'demo', conversation_id: 'conv-2b' });
  assert.strictEqual(result.state.active_mode, 'safety');
  assert.strictEqual(result.state.risk_flag, 'true');
  assert.strictEqual(result.metadata.route, 'safety');
  assert.strictEqual(result.metadata.risk_flag, 'true');
  assert.ok(result.answer.includes('請立刻聯絡') || result.answer.includes('立即'));
}

async function testNaturalFlowBuildsSessionExport() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  const result = await engine.handleMessage({ message: '最近很累', user: 'demo', conversation_id: 'conv-3' });
  assert.strictEqual(result.state.active_mode, 'mode_5_natural');
  assert.strictEqual(result.metadata.risk_flag, 'false');
  assert.strictEqual(result.metadata.burden_level_state.burden_level, 'medium');
  assert.deepStrictEqual(result.metadata.latest_tag_payload.sentiment_tags, ['tired']);
  assert.ok(result.session_export);
  assert.strictEqual(result.session_export.active_mode, 'mode_5_natural');
  assert.strictEqual(result.session_export.burden_level_state.burden_level, 'medium');
  assert.strictEqual(result.session_export.hamd_formal_assessment.scale_version, 'HAM-D17');
  assert.ok(result.session_export.hamd_formal_assessment.items.some((item) => typeof item.ai_suggested_score === 'number'));
  assert.ok(Array.isArray(result.session_export.hamd_progress_state.covered_dimensions));
  assert.ok(Array.isArray(result.session_export.hamd_progress_state.missing_dimensions));
  assert.ok(typeof result.session_export.hamd_progress_state.status_summary === 'string');
  assert.strictEqual(result.session_export.patient.name, 'Anonymous Patient');
  assert.strictEqual(result.session_export.patient.identity_strategy, 'anonymous_default');
  assert.ok(/^anon-/.test(result.session_export.patient.key));
  assert.ok(!Object.prototype.hasOwnProperty.call(result.session_export.patient, 'gender'));
  assert.deepStrictEqual(result.session_export.clinician_summary_draft, {});
  assert.deepStrictEqual(result.session_export.delivery_readiness_state, {});
}

function testDefaultSessionExportPreservesExplicitPatientProfile() {
  const sessionExport = defaultSessionExport({
    id: 'conv-patient-1',
    user: 'demo',
    startedAt: '2026-04-22T00:00:00.000Z',
    updatedAt: '2026-04-22T00:10:00.000Z',
    state: {
      active_mode: 'auto',
      risk_flag: 'false',
      patient_profile: {
        key: 'pt-jane-lin',
        name: 'Jane Lin',
        gender: 'female',
        birthDate: '1998-04-03'
      }
    }
  });

  assert.strictEqual(sessionExport.patient.key, 'pt-jane-lin');
  assert.strictEqual(sessionExport.patient.name, 'Jane Lin');
  assert.strictEqual(sessionExport.patient.gender, 'female');
  assert.strictEqual(sessionExport.patient.birthDate, '1998-04-03');
  assert.strictEqual(sessionExport.patient.identity_strategy, 'provided_identity');
  assert.deepStrictEqual(sessionExport.patient_profile, {
    key: 'pt-jane-lin',
    name: 'Jane Lin',
    gender: 'female',
    birthDate: '1998-04-03'
  });
}

async function testPatientProfilePersistsInSessionAndSessionExport() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  const result = await engine.handleMessage({
    message: '最近壓力有點大。',
    user: 'demo',
    conversation_id: 'conv-patient-profile-1',
    patient_profile: {
      profileKey: 'patient-lin-xiaoming',
      name: '林小明',
      gender: 'male',
      birthDate: '1994-02-03',
      phone: '0912345678',
      email: 'xiaoming@example.com',
      emergencyName: '林媽媽',
      emergencyPhone: '0988777666'
    }
  });

  assert.strictEqual(result.session_export.patient.key, 'patient-lin-xiaoming');
  assert.strictEqual(result.session_export.patient.name, '林小明');
  assert.strictEqual(result.session_export.patient.gender, 'male');
  assert.strictEqual(result.session_export.patient.birthDate, '1994-02-03');
  assert.strictEqual(result.session_export.patient.phone, '0912345678');
  assert.strictEqual(result.session_export.patient.email, 'xiaoming@example.com');
  assert.strictEqual(result.session_export.patient.contact[0].name.text, '林媽媽');
  assert.strictEqual(result.state.patient_profile.profileKey, 'patient-lin-xiaoming');
}

async function testOutputCommandBuildsStructuredDrafts() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  await engine.handleMessage({ message: '最近很累，而且晚上一直做惡夢，白天上班也被影響。', user: 'demo', conversation_id: 'conv-4' });
  const result = await engine.handleMessage({ message: '幫我整理給醫生', user: 'demo', conversation_id: 'conv-4' });
  assert.strictEqual(result.metadata.route, 'output');
  assert.strictEqual(result.metadata.output_type, 'clinician_summary');
  assert.ok(result.answer.includes('醫師摘要'));
  assert.ok(Array.isArray(result.session_export.clinician_summary_draft.hamd_item_scores));
  assert.ok(Array.isArray(result.session_export.clinician_summary_draft.hamd_evidence_table));
  assert.ok(Array.isArray(result.session_export.clinician_summary_draft.symptom_evidence_track));
  assert.ok(Array.isArray(result.session_export.clinician_summary_draft.symptom_inference_track));
  assert.ok(
    result.session_export.clinician_summary_draft.symptom_observations.every((item) => !String(item).includes('FHIR草稿'))
  );
  assert.strictEqual(result.session_export.delivery_readiness_state.readiness_status, 'ready_for_backend_mapping');
}

async function testFhirDraftCarriesEvidenceAndInferenceTracks() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  await engine.handleMessage({ message: '最近很累，而且晚上一直做惡夢，白天上班也被影響。', user: 'demo', conversation_id: 'conv-5' });
  const result = await engine.handleMessage({ message: '請幫我生成FHIR草稿', user: 'demo', conversation_id: 'conv-5' });
  const draft = result.session_export.fhir_delivery_draft;
  assert.ok(Array.isArray(draft.symptom_evidence_track));
  assert.ok(Array.isArray(draft.symptom_inference_track));
  assert.ok(Array.isArray(draft.observation_candidates));
  assert.ok(draft.observation_candidates[0].evidence_refs.includes('e1'));
  assert.ok(!JSON.stringify(draft).includes('請幫我生成FHIR草稿'));
}

async function testSomaticSymptomsAreRetainedInDraftOutputs() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  await engine.handleMessage({
    message: '我全身發冷，最近也一直肚子痛，壓力一大就更嚴重，而且失眠很嚴重。',
    user: 'demo',
    conversation_id: 'conv-somatic'
  });
  const result = await engine.handleMessage({
    message: '請幫我生成FHIR草稿',
    user: 'demo',
    conversation_id: 'conv-somatic'
  });
  const clinicianObservations = result.session_export?.clinician_summary_draft?.symptom_observations || [];
  const draftCandidates = result.session_export?.fhir_delivery_draft?.observation_candidates || [];
  const combinedText = `${JSON.stringify(clinicianObservations)} ${JSON.stringify(draftCandidates)}`;
  assert.ok(/腹部不適|腸胃症狀|發冷|自律神經/.test(combinedText));
}

async function testPollutedBridgeArtifactsAreSanitized() {
  const engine = new AICompanionEngine({ modelClient: createPollutedBridgeModelClient(), apiKey: 'fake' });
  await engine.handleMessage({
    message: '我最近常常睡不好，而且肚子一直咕嚕咕嚕又悶痛。',
    user: 'demo',
    conversation_id: 'conv-polluted'
  });
  const result = await engine.handleMessage({
    message: '請幫我準備FHIR草稿。',
    user: 'demo',
    conversation_id: 'conv-polluted'
  });
  const draft = result.session_export?.fhir_delivery_draft || {};
  const clinician = result.session_export?.clinician_summary_draft || {};
  const combined = JSON.stringify({ draft, clinician });
  const bridge = JSON.stringify(result.session_export?.symptom_bridge_state || {});
  assert.ok(!combined.includes('recent_dialogue'));
  assert.ok(!combined.includes('請幫我準備FHIR草稿'));
  assert.ok(!combined.includes('。。'));
  assert.ok(/肚子|腹部|腸胃/.test(combined));
  assert.ok(bridge.includes('excluded_messages'));
}

async function testReuseLatestSessionByUserWhenConversationIdMissing() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  const first = await engine.handleMessage({ message: '最近很累', user: 'demo-user' });
  const second = await engine.handleMessage({ message: '還是很累', user: 'demo-user' });
  assert.strictEqual(first.conversation_id, second.conversation_id);
  assert.strictEqual(engine.sessions.size, 1);
}

async function testForceNewSessionCreatesSeparateConversation() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  const first = await engine.handleMessage({ message: '最近很累', user: 'demo-user' });
  const second = await engine.handleMessage({
    message: '想重新開始聊',
    user: 'demo-user',
    force_new_session: true
  });
  assert.notStrictEqual(first.conversation_id, second.conversation_id);
  assert.strictEqual(engine.sessions.size, 2);
}

async function testCorruptedInputIsRejectedBeforePersist() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  await assert.rejects(
    engine.handleMessage({ message: '?????????,?????,????????????', user: 'demo-user' }),
    (error) => error && error.code === 'corrupted_input_rejected'
  );
  assert.strictEqual(engine.sessions.size, 0);
}

async function testTherapeuticProfilePersistsInSession() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  const profile = {
    version: '1.0',
    userId: 'demo-user',
    sessionCount: 3,
    stressors: [{ label: '工作壓力' }],
    triggers: [{ keyword: '開會' }],
    copingProfile: { preferredStyle: '先慢慢聊', effectiveMethods: [], ineffectiveMethods: [] },
    positiveAnchors: [{ label: '散步', category: 'other' }],
    emotionalBaseline: { dominantMood: '緊張', phq9Trend: [], hamdSignalCount: 0 },
    keyThemes: ['工作'],
    clinicianNotes: ''
  };
  const result = await engine.handleMessage({
    message: '最近很累',
    user: 'demo-user',
    therapeutic_profile: profile
  });
  assert.deepStrictEqual(result.session_export.therapeutic_profile.stressors, [{ label: '工作壓力' }]);
  const session = engine.sessions.get(result.conversation_id);
  assert.deepStrictEqual(session.state.therapeutic_profile.stressors, [{ label: '工作壓力' }]);
}

async function testTherapeuticMemoryCompressionAddsLongTermChunk() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  const first = await engine.handleMessage({
    message: '最近工作壓力真的很大，晚上也睡不好。',
    user: 'demo-user',
    conversation_id: 'conv-memory-1'
  });
  const session = engine.sessions.get(first.conversation_id);
  const beforeProfile = session.state.therapeutic_profile || {};
  const beforeCount = Array.isArray(beforeProfile.memoryChunks)
    ? beforeProfile.memoryChunks.length
    : 0;
  const result = await engine.compressTherapeuticMemory(session, '補一段壓縮測試', { force: true });
  const afterProfile = session.state.therapeutic_profile || {};
  const afterCount = Array.isArray(afterProfile.memoryChunks)
    ? afterProfile.memoryChunks.length
    : 0;

  assert.ok(result);
  assert.ok(afterCount >= beforeCount);
  assert.ok(afterProfile.memoryStats.memoryChunksCount >= afterCount);
  assert.ok(Array.isArray(afterProfile.memoryChunks) && afterProfile.memoryChunks.length > 0);
}

async function testSessionPersistenceRoundTrip() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-companion-'));
  const storePath = path.join(tmpDir, 'sessions.json');
  const persistedSnapshots = [];
  const engine = new AICompanionEngine({
    modelClient: createStubModelClient(),
    apiKey: 'fake',
    onSessionsChanged: (sessions) => {
      saveSessionsToFile(sessions, storePath);
      persistedSnapshots.push(loadSessionsFromFile(storePath));
    }
  });

  const first = await engine.handleMessage({ message: '最近很累', user: 'persist-user' });
  assert.ok(fs.existsSync(storePath));
  const loaded = loadSessionsFromFile(storePath);
  assert.strictEqual(loaded.size, 1);
  assert.strictEqual(loaded.get(first.conversation_id).user, 'persist-user');
  assert.ok(persistedSnapshots.length >= 1);

  const resumedEngine = new AICompanionEngine({
    modelClient: createStubModelClient(),
    apiKey: 'fake',
    sessions: loaded
  });
  const second = await resumedEngine.handleMessage({ message: '幫我整理給醫生', user: 'persist-user' });
  assert.strictEqual(second.conversation_id, first.conversation_id);
  assert.strictEqual(second.metadata.route, 'output');
}

async function run() {
  await testCommandRouting();
  await testHighRiskRouting();
  await testSelfHarmStatementRoutesToSafety();
  await testNaturalFlowBuildsSessionExport();
  testDefaultSessionExportPreservesExplicitPatientProfile();
  await testPatientProfilePersistsInSessionAndSessionExport();
  await testOutputCommandBuildsStructuredDrafts();
  await testFhirDraftCarriesEvidenceAndInferenceTracks();
  await testSomaticSymptomsAreRetainedInDraftOutputs();
  await testPollutedBridgeArtifactsAreSanitized();
  await testReuseLatestSessionByUserWhenConversationIdMissing();
  await testForceNewSessionCreatesSeparateConversation();
  await testCorruptedInputIsRejectedBeforePersist();
  await testTherapeuticProfilePersistsInSession();
  await testTherapeuticMemoryCompressionAddsLongTermChunk();
  await testSessionPersistenceRoundTrip();
  console.log('AI companion engine tests passed.');
}

run();
