const assert = require('assert');
const { AICompanionEngine } = require('./aiCompanionEngine');

function createStubModelClient() {
  let calls = 0;
  const client = async ({ systemPrompt, userPrompt }) => {
    calls += 1;
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
          missing_dimensions: ['guilt'],
          next_recommended_dimension: 'work_interest',
          recent_evidence: ['最近很累'],
          needs_clarification: 'no',
          status_summary: 'stub'
        })
      };
    }
    if (systemPrompt.includes('你是意圖分類器')) {
      return { text: 'mode_5_natural' };
    }
    if (systemPrompt.includes('低能量與認知負擔偵測器')) {
      return { text: 'continue_auto' };
    }
    if (systemPrompt.includes('像真人的朋友')) {
      return { text: '我在。' };
    }
    if (systemPrompt.includes('統一的摘要草稿 JSON')) {
      return { text: JSON.stringify({ draft_summary: '最近很累。', active_mode: 'mode_5_natural' }) };
    }
    if (systemPrompt.includes('可交付給醫師或臨床團隊閱讀')) {
      return { text: JSON.stringify({ summary_version: 'v1', draft_summary: '最近很累。' }) };
    }
    if (systemPrompt.includes('給病人自己審閱')) {
      return { text: JSON.stringify({ packet_version: 'v1', patient_facing_summary: '最近很累。' }) };
    }
    if (systemPrompt.includes('病人審閱 / 授權狀態')) {
      return { text: JSON.stringify({ state_version: 'v1', authorization_status: 'ready_for_consent' }) };
    }
    if (systemPrompt.includes('FHIR / TW Core 映射草稿')) {
      return { text: JSON.stringify({ draft_version: 'v1', delivery_status: 'ready_for_mapping' }) };
    }
    if (systemPrompt.includes('交付 readiness 狀態')) {
      return { text: JSON.stringify({ state_version: 'v1', readiness_status: 'ready_for_backend_mapping' }) };
    }
    return { text: 'stub' };
  };
  client.getCalls = () => calls;
  return client;
}

async function testOutputCaching() {
  const modelClient = createStubModelClient();
  const engine = new AICompanionEngine({ modelClient, apiKey: 'fake' });
  await engine.handleMessage({ message: '最近很累', user: 'demo', conversation_id: 'conv-output-1' });
  const before = modelClient.getCalls();
  const first = await engine.generateOutput({ conversation_id: 'conv-output-1', user: 'demo', output_type: 'clinician_summary' });
  const middle = modelClient.getCalls();
  const second = await engine.generateOutput({ conversation_id: 'conv-output-1', user: 'demo', output_type: 'clinician_summary' });
  const after = modelClient.getCalls();
  assert.ok(first.formatted_text.includes('醫師摘要'));
  assert.deepStrictEqual(first.output, second.output);
  assert.ok(middle > before);
  assert.strictEqual(after, middle);
}

async function run() {
  await testOutputCaching();
  console.log('AI companion output tests passed.');
}

run();
