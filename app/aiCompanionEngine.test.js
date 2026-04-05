const assert = require('assert');
const { AICompanionEngine } = require('./aiCompanionEngine');
const { loadSessionsFromFile, saveSessionsToFile } = require('./sessionPersistence');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createStubModelClient() {
  return async ({ systemPrompt, userPrompt }) => {
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
    if (systemPrompt.includes('可交付給醫師或臨床團隊閱讀')) {
      return {
        text: JSON.stringify({
          summary_version: 'p1_clinician_draft_v1',
          active_mode: 'mode_5_natural',
          risk_level: 'watch',
          chief_concerns: ['最近很累'],
          symptom_observations: ['疲累'],
          hamd_signals: ['depressed_mood'],
          followup_needs: [],
          safety_flags: [],
          patient_tone: 'low_energy',
          draft_summary: '最近很累。'
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
          narrative_summary: '最近很累。'
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
  assert.deepStrictEqual(result.session_export.clinician_summary_draft, {});
  assert.deepStrictEqual(result.session_export.delivery_readiness_state, {});
}

async function testOutputCommandBuildsStructuredDrafts() {
  const engine = new AICompanionEngine({ modelClient: createStubModelClient(), apiKey: 'fake' });
  await engine.handleMessage({ message: '最近很累', user: 'demo', conversation_id: 'conv-4' });
  const result = await engine.handleMessage({ message: '幫我整理給醫生', user: 'demo', conversation_id: 'conv-4' });
  assert.strictEqual(result.metadata.route, 'output');
  assert.strictEqual(result.metadata.output_type, 'clinician_summary');
  assert.ok(result.answer.includes('醫師摘要'));
  assert.ok(Array.isArray(result.session_export.clinician_summary_draft.hamd_item_scores));
  assert.ok(Array.isArray(result.session_export.clinician_summary_draft.hamd_evidence_table));
  assert.strictEqual(result.session_export.delivery_readiness_state.readiness_status, 'ready_for_backend_mapping');
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
  await testOutputCommandBuildsStructuredDrafts();
  await testReuseLatestSessionByUserWhenConversationIdMissing();
  await testForceNewSessionCreatesSeparateConversation();
  await testCorruptedInputIsRejectedBeforePersist();
  await testSessionPersistenceRoundTrip();
  console.log('AI companion engine tests passed.');
}

run();
