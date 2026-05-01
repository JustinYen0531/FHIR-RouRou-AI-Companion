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
    if (systemPrompt.includes('原句證據軌 + 症狀推論軌')) {
      return {
        text: JSON.stringify({
          bridge_version: 'p1_symptom_bridge_v1',
          evidence_track: [
            {
              evidence_id: 'e1',
              speaker: 'user',
              source_text: userPrompt || '最近很累',
              symptom_candidate: '疲憊與睡眠困擾',
              category: 'sleep',
              confidence: 'high'
            }
          ],
          inference_track: [
            {
              symptom_label: '疲憊與睡眠困擾',
              summary: '近期持續疲憊，並有睡眠困擾。',
              category: 'sleep',
              hamd_signal: 'insomnia',
              severity_hint: 'moderate',
              functional_impact: '影響白天功能',
              timeframe: 'recent_weeks',
              evidence_refs: ['e1'],
              confidence: 'high'
            }
          ],
          excluded_messages: []
        })
      };
    }
    if (systemPrompt.includes('可交付給醫師或臨床團隊閱讀')) {
      return { text: JSON.stringify({ summary_version: 'v1', draft_summary: '最近很累。' }) };
    }
    if (systemPrompt.includes('給病人自己審閱')) {
      return { text: JSON.stringify({ packet_version: 'v1', patient_facing_summary: '最近很累。' }) };
    }
    if (systemPrompt.includes('給病人自己看的分析')) {
      return {
        text: JSON.stringify({
          version: 'p4_patient_analysis_v3',
          status: 'ready',
          plain_summary: '你最近的狀態不只是累，而是已經開始影響情緒和生活節奏。',
          key_points: ['情緒低落', '睡眠被打亂', '需要更溫和的整理節奏'],
          reminder: '這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。',
          markdown: '## 給你的分析\n\n你最近的狀態不只是累，而是已經開始影響情緒和生活節奏。\n\n### 我怎麼理解你現在的狀態\n- 你一直在撐。\n\n### 我目前注意到你卡住的地方\n- 睡眠和情緒互相拉扯。\n\n### 你現在比較需要的支持方式\n- 先慢慢整理，不要一次逼自己講很多。\n\n### 接下來可以怎麼做\n- 先從最近最卡的一件事開始。\n\n### 提醒\n這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。'
        })
      };
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

function createRawClinicianStubModelClient() {
  let calls = 0;
  const client = async ({ systemPrompt, userPrompt }) => {
    calls += 1;
    if (systemPrompt.includes('根據本輪使用者輸入，輸出簡短 JSON 字串')) {
      return {
        text: JSON.stringify({
          route_type: 'normal',
          source_mode: 'mode_5_natural',
          followup_status: 'resolved',
          sentiment_tags: ['anxious'],
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
          progress_stage: 'focused',
          current_focus: 'somatic_anxiety',
          supported_dimensions: ['somatic_anxiety', 'work_interest'],
          covered_dimensions: ['somatic_anxiety', 'work_interest'],
          missing_dimensions: ['guilt'],
          next_recommended_dimension: 'insomnia',
          recent_evidence: ['怕上台時忘詞', '食慾下降'],
          needs_clarification: 'no',
          status_summary: 'stub'
        })
      };
    }
    if (systemPrompt.includes('你是意圖分類器')) return { text: 'mode_5_natural' };
    if (systemPrompt.includes('低能量與認知負擔偵測器')) return { text: 'continue_auto' };
    if (systemPrompt.includes('像真人的朋友')) return { text: '我在。' };
    if (systemPrompt.includes('統一的摘要草稿 JSON')) {
      return { text: JSON.stringify({ draft_summary: userPrompt, active_mode: 'mode_5_natural' }) };
    }
    if (systemPrompt.includes('原句證據軌 + 症狀推論軌')) {
      return {
        text: JSON.stringify({
          bridge_version: 'p1_symptom_bridge_v1',
          evidence_track: [
            {
              evidence_id: 'e1',
              speaker: 'user',
              source_text: userPrompt || '最近很焦慮',
              symptom_candidate: '焦慮與課業壓力',
              category: 'anxiety',
              confidence: 'high'
            }
          ],
          inference_track: [
            {
              symptom_label: '焦慮與課業壓力',
              summary: '在課堂與表現情境出現焦慮與回避反應。',
              category: 'anxiety',
              hamd_signal: 'somatic_anxiety',
              severity_hint: 'moderate',
              functional_impact: '影響課堂功能',
              timeframe: 'recent_weeks',
              evidence_refs: ['e1'],
              confidence: 'high'
            }
          ],
          excluded_messages: []
        })
      };
    }
    if (systemPrompt.includes('可交付給醫師或臨床團隊閱讀')) {
      return {
        text: JSON.stringify({
          summary_version: 'v1',
          draft_summary: userPrompt,
          chief_concerns: [userPrompt],
          symptom_observations: [userPrompt]
        })
      };
    }
    if (systemPrompt.includes('FHIR / TW Core 映射草稿')) {
      return {
        text: JSON.stringify({
          draft_version: 'v1',
          delivery_status: 'ready_for_mapping',
          composition_sections: [
            { section: 'symptom_timeline', focus: userPrompt }
          ],
          observation_candidates: [
            { focus: userPrompt, category: 'patient_report', signal: '' }
          ]
        })
      };
    }
    if (systemPrompt.includes('給病人自己審閱')) {
      return { text: JSON.stringify({ packet_version: 'v1', patient_facing_summary: userPrompt }) };
    }
    if (systemPrompt.includes('病人審閱 / 授權狀態')) {
      return { text: JSON.stringify({ state_version: 'v1', authorization_status: 'ready_for_consent' }) };
    }
    if (systemPrompt.includes('交付 readiness 狀態')) {
      return { text: JSON.stringify({ state_version: 'v1', readiness_status: 'ready_for_backend_mapping' }) };
    }
    if (systemPrompt.includes('給病人自己看的分析')) {
      return { text: JSON.stringify({ plain_summary: userPrompt, markdown: userPrompt, key_points: [userPrompt] }) };
    }
    return { text: 'stub' };
  };
  client.getCalls = () => calls;
  return client;
}

function createRawPatientAnalysisStubModelClient() {
  const client = async ({ systemPrompt }) => {
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
          summary: '最近很累'
        })
      };
    }
    if (systemPrompt.includes('判斷病人的互動負擔')) {
      return { text: JSON.stringify({ burden_level: 'medium', response_style: 'natural', followup_budget: '1', burden_note: 'stub' }) };
    }
    if (systemPrompt.includes('更新 HAM-D 線索狀態')) {
      return { text: JSON.stringify({ progress_stage: 'initial', current_focus: 'depressed_mood', supported_dimensions: ['depressed_mood'], covered_dimensions: ['depressed_mood'], missing_dimensions: ['guilt'], next_recommended_dimension: 'work_interest', recent_evidence: ['最近很累'], needs_clarification: 'no', status_summary: 'stub' }) };
    }
    if (systemPrompt.includes('你是意圖分類器')) return { text: 'mode_5_natural' };
    if (systemPrompt.includes('低能量與認知負擔偵測器')) return { text: 'continue_auto' };
    if (systemPrompt.includes('像真人的朋友')) return { text: '我在。' };
    if (systemPrompt.includes('統一的摘要草稿 JSON')) return { text: JSON.stringify({ draft_summary: '最近很累。', active_mode: 'mode_5_natural' }) };
    if (systemPrompt.includes('原句證據軌 + 症狀推論軌')) {
      return {
        text: JSON.stringify({
          bridge_version: 'p1_symptom_bridge_v1',
          evidence_track: [
            {
              evidence_id: 'e1',
              speaker: 'user',
              source_text: '最近睡不好而且白天一直提不起勁。',
              symptom_candidate: '睡眠與低動力',
              category: 'sleep',
              confidence: 'high'
            }
          ],
          inference_track: [
            {
              symptom_label: '睡眠與低動力',
              summary: '近期睡眠困擾並伴隨白天低動力。',
              category: 'sleep',
              hamd_signal: 'insomnia',
              severity_hint: 'moderate',
              functional_impact: '影響白天狀態',
              timeframe: 'recent_weeks',
              evidence_refs: ['e1'],
              confidence: 'high'
            }
          ],
          excluded_messages: []
        })
      };
    }
    if (systemPrompt.includes('可交付給醫師或臨床團隊閱讀')) return { text: JSON.stringify({ summary_version: 'v1', draft_summary: '最近很累。' }) };
    if (systemPrompt.includes('給病人自己審閱')) return { text: JSON.stringify({ packet_version: 'v1', patient_facing_summary: '最近很累。' }) };
    if (systemPrompt.includes('病人審閱 / 授權狀態')) return { text: JSON.stringify({ state_version: 'v1', authorization_status: 'ready_for_consent' }) };
    if (systemPrompt.includes('FHIR / TW Core 映射草稿')) return { text: JSON.stringify({ draft_version: 'v1', delivery_status: 'ready_for_mapping' }) };
    if (systemPrompt.includes('交付 readiness 狀態')) return { text: JSON.stringify({ state_version: 'v1', readiness_status: 'ready_for_backend_mapping' }) };
    if (systemPrompt.includes('給病人自己看的分析')) {
      return { text: '你最近其實不是單純累，而是已經有被睡眠與情緒互相拉扯的感覺。建議先從最近最卡的一件事開始整理。' };
    }
    return { text: 'stub' };
  };
  return client;
}

function createPatientAnalysisContainsSupportPhraseModelClient() {
  const client = async ({ systemPrompt }) => {
    if (systemPrompt.includes('根據本輪使用者輸入，輸出簡短 JSON 字串')) {
      return {
        text: JSON.stringify({
          route_type: 'normal',
          source_mode: 'mode_5_natural',
          followup_status: 'resolved',
          sentiment_tags: ['anxious'],
          behavioral_tags: [],
          cognitive_tags: [],
          warning_tags: [],
          summary: '最近很焦慮'
        })
      };
    }
    if (systemPrompt.includes('判斷病人的互動負擔')) {
      return { text: JSON.stringify({ burden_level: 'medium', response_style: 'natural', followup_budget: '1', burden_note: 'stub' }) };
    }
    if (systemPrompt.includes('更新 HAM-D 線索狀態')) {
      return { text: JSON.stringify({ progress_stage: 'initial', current_focus: 'somatic_anxiety', supported_dimensions: ['somatic_anxiety'], covered_dimensions: ['somatic_anxiety'], missing_dimensions: ['insomnia'], next_recommended_dimension: 'insomnia', recent_evidence: ['胸口悶'], needs_clarification: 'no', status_summary: 'stub' }) };
    }
    if (systemPrompt.includes('你是意圖分類器')) return { text: 'mode_5_natural' };
    if (systemPrompt.includes('低能量與認知負擔偵測器')) return { text: 'continue_auto' };
    if (systemPrompt.includes('像真人的朋友')) return { text: '我在。' };
    if (systemPrompt.includes('統一的摘要草稿 JSON')) return { text: JSON.stringify({ draft_summary: '最近很焦慮。', active_mode: 'mode_5_natural' }) };
    if (systemPrompt.includes('原句證據軌 + 症狀推論軌')) {
      return {
        text: JSON.stringify({
          bridge_version: 'p1_symptom_bridge_v1',
          evidence_track: [
            {
              evidence_id: 'e1',
              speaker: 'user',
              source_text: '最近壓力很大，想到工作就胸口悶。',
              symptom_candidate: '焦慮與壓力反應',
              category: 'anxiety',
              confidence: 'high'
            }
          ],
          inference_track: [
            {
              symptom_label: '焦慮與壓力反應',
              summary: '壓力情境下出現焦慮與身體不適反應。',
              category: 'anxiety',
              hamd_signal: 'somatic_anxiety',
              severity_hint: 'moderate',
              functional_impact: '影響工作準備',
              timeframe: 'recent_weeks',
              evidence_refs: ['e1'],
              confidence: 'high'
            }
          ],
          excluded_messages: []
        })
      };
    }
    if (systemPrompt.includes('可交付給醫師或臨床團隊閱讀')) return { text: JSON.stringify({ summary_version: 'v1', draft_summary: '最近很焦慮。' }) };
    if (systemPrompt.includes('給病人自己審閱')) return { text: JSON.stringify({ packet_version: 'v1', patient_facing_summary: '最近很焦慮。' }) };
    if (systemPrompt.includes('病人審閱 / 授權狀態')) return { text: JSON.stringify({ state_version: 'v1', authorization_status: 'ready_for_consent' }) };
    if (systemPrompt.includes('FHIR / TW Core 映射草稿')) return { text: JSON.stringify({ draft_version: 'v1', delivery_status: 'ready_for_mapping' }) };
    if (systemPrompt.includes('交付 readiness 狀態')) return { text: JSON.stringify({ state_version: 'v1', readiness_status: 'ready_for_backend_mapping' }) };
    if (systemPrompt.includes('給病人自己看的分析')) {
      return {
        text: JSON.stringify({
          version: 'p4_patient_analysis_v3',
          status: 'ready',
          plain_summary: '你最近的壓力和焦慮已經開始互相放大，身體也在提醒你。',
          key_points: ['焦慮感升高', '身體緊繃', '需要支持但不想被說教'],
          reminder: '這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。',
          markdown: '## 給你的分析\n\n你最近的壓力和焦慮已經開始互相放大，身體也在提醒你。\n\n### 我怎麼理解你現在的狀態\n- 你不是在矯情，而是真的快被壓力推到極限。\n\n### 我目前注意到你卡住的地方\n- 一想到事情就會胸口悶，然後更不敢開始。\n\n### 你現在比較需要的支持方式\n- 你需要支持，但不想被命令或被空話安慰。\n\n### 接下來可以怎麼做\n- 先挑一件最容易卡住的事，拆成五分鐘內能做的第一步。\n\n### 提醒\n這份內容是依據目前對話整理的陪伴式理解，不是醫療診斷。'
        })
      };
    }
    return { text: 'stub' };
  };
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
  assert.ok(Array.isArray(first.output.hamd_item_scores));
  assert.ok(middle >= before);
  assert.ok(after > middle, 'clinician_summary should always rerun AI model');
  assert.strictEqual(first.metadata.output_source, 'fresh');
  assert.strictEqual(second.metadata.output_source, 'fresh');
}

async function testForceRefreshBypassesOutputCache() {
  const modelClient = createStubModelClient();
  const engine = new AICompanionEngine({ modelClient, apiKey: 'fake' });
  await engine.handleMessage({ message: '最近很累', user: 'demo', conversation_id: 'conv-output-refresh' });
  await engine.generateOutput({ conversation_id: 'conv-output-refresh', user: 'demo', output_type: 'clinician_summary' });
  const before = modelClient.getCalls();
  await engine.generateOutput({
    conversation_id: 'conv-output-refresh',
    user: 'demo',
    output_type: 'clinician_summary',
    force_refresh: true
  });
  const after = modelClient.getCalls();
  assert.ok(after > before, 'force_refresh should trigger regeneration instead of cached output');
}

async function testStructuredObservationRewritingAndLeanFhirDraft() {
  const modelClient = createRawClinicianStubModelClient();
  const engine = new AICompanionEngine({ modelClient, apiKey: 'fake' });
  await engine.handleMessage({
    message: '我以前對美食的欲望已經消失了，現在也不想跟其他人一起吃飯，而且上台報告時會突然很害怕。',
    user: 'demo',
    conversation_id: 'conv-output-2'
  });

  const clinician = await engine.generateOutput({
    conversation_id: 'conv-output-2',
    user: 'demo',
    output_type: 'clinician_summary'
  });
  const fhir = await engine.generateOutput({
    conversation_id: 'conv-output-2',
    user: 'demo',
    output_type: 'fhir_delivery'
  });

  assert.ok(
    clinician.output.symptom_observations.some((item) => item.includes('食慾下降') || item.includes('焦慮') || item.includes('社交退縮')),
    'symptom observations should be rewritten into structured observations'
  );
  assert.ok(
    clinician.output.symptom_observations.every((item) => !String(item).includes('我')),
    'symptom observations should avoid raw first-person phrasing'
  );
  assert.ok(
    clinician.output.chief_concerns.every((item) => !String(item).includes('我')),
    'chief concerns should avoid raw first-person phrasing'
  );
  assert.ok(
    Array.isArray(fhir.output.composition_sections) && fhir.output.composition_sections.length > 0,
    'FHIR draft should keep only meaningful composition sections'
  );
  assert.ok(
    fhir.output.composition_sections.every((item) => String(item.focus || '').trim() && !String(item.focus || '').includes('尚待補充')),
    'FHIR draft sections should not contain placeholder filler text'
  );
  assert.ok(
    fhir.output.observation_candidates.every((item) => !String(item.focus || '').includes('我以前')),
    'FHIR draft observations should not keep raw transcript-style text'
  );
}

async function testFormalAssessmentBackfillsScoredItemsFromClinicalEvidence() {
  const modelClient = createStubModelClient();
  const engine = new AICompanionEngine({ modelClient, apiKey: 'fake' });
  await engine.handleMessage({
    message: '我最近睡不好，白天很沒勁，心情也一直很低落。',
    user: 'demo',
    conversation_id: 'conv-output-formal-backfill'
  });

  const clinician = await engine.generateOutput({
    conversation_id: 'conv-output-formal-backfill',
    user: 'demo',
    output_type: 'clinician_summary',
    force_refresh: true
  });

  assert.ok(
    Array.isArray(clinician.output.hamd_item_scores) && clinician.output.hamd_item_scores.length > 0,
    'formal assessment should expose scored HAM-D items'
  );
  assert.ok(
    clinician.output.hamd_item_scores.some((item) => Number.isFinite(Number(item.ai_suggested_score))),
    'formal assessment should include at least one AI suggested score'
  );
  assert.ok(
    Array.isArray(clinician.output.hamd_evidence_table) && clinician.output.hamd_evidence_table.length > 0,
    'formal assessment should include evidence table rows'
  );
}

async function testPhq9OnlySessionsStillGenerateStructuredDrafts() {
  const modelClient = createStubModelClient();
  const engine = new AICompanionEngine({ modelClient, apiKey: 'fake' });
  const phq9Assessment = {
    version: 'PHQ-9',
    totalScore: 18,
    severityBand: 'moderately-severe',
    completedAt: '2026-04-23T10:00:00.000Z',
    updatedAt: '2026-04-23T10:00:00.000Z',
    note: '最近白天也很難提起精神。',
    answers: [
      { questionId: 'phq9_1', label: '做事缺乏興趣或樂趣', score: 2, narrative: '對很多事情都提不起興趣。' },
      { questionId: 'phq9_2', label: '情緒低落、沮喪或絕望', score: 2, narrative: '大部分時間都覺得很低落。' },
      { questionId: 'phq9_3', label: '睡眠困擾', score: 2, narrative: '睡不好，也很容易醒來。' },
      { questionId: 'phq9_4', label: '疲倦或沒精神', score: 2, narrative: '白天很累。' },
      { questionId: 'phq9_5', label: '食慾不振或吃太多', score: 2, narrative: '食慾變差。' },
      { questionId: 'phq9_6', label: '覺得自己很糟', score: 2, narrative: '常覺得自己很差。' },
      { questionId: 'phq9_7', label: '注意力不集中', score: 2, narrative: '很難專心。' },
      { questionId: 'phq9_8', label: '動作或說話變慢', score: 2, narrative: '做事速度變慢。' },
      { questionId: 'phq9_9', label: '有傷害自己的念頭', score: 0, narrative: '' }
    ]
  };

  const clinician = await engine.generateOutput({
    conversation_id: 'conv-phq9-only',
    user: 'demo',
    output_type: 'clinician_summary',
    phq9_assessment: phq9Assessment,
    force_refresh: true
  });
  const fhir = await engine.generateOutput({
    conversation_id: 'conv-phq9-only',
    user: 'demo',
    output_type: 'fhir_delivery',
    phq9_assessment: phq9Assessment,
    force_refresh: true
  });

  assert.ok(clinician.output.phq9_summary.includes('PHQ-9 18/27'));
  assert.strictEqual(clinician.output.phq9_total_score, 18);
  assert.ok(Array.isArray(fhir.output.phq9_questionnaire_targets));
  assert.strictEqual(fhir.output.phq9_questionnaire_targets.length, 9);
  assert.ok(fhir.output.resources.some((item) => item.resource_type === 'QuestionnaireResponse'));
}

async function testPatientAnalysisUsesMeaningfulNarrative() {
  const modelClient = createStubModelClient();
  const engine = new AICompanionEngine({ modelClient, apiKey: 'fake' });
  await engine.handleMessage({
    message: '我最近晚上一直睡不好，白天做事也很沒勁，心情很低。',
    user: 'demo',
    conversation_id: 'conv-output-3'
  });

  const analysis = await engine.generateOutput({
    conversation_id: 'conv-output-3',
    user: 'demo',
    output_type: 'patient_analysis'
  });

  assert.ok(analysis.output.plain_summary.includes('影響'));
  assert.ok(!analysis.output.markdown.includes('depressed_mood'));
  assert.ok(analysis.output.markdown.includes('## 給你的分析'));
}

async function testPatientAnalysisFallsBackToRawModelTextWhenJsonInvalid() {
  const modelClient = createRawPatientAnalysisStubModelClient();
  const engine = new AICompanionEngine({ modelClient, apiKey: 'fake' });
  await engine.handleMessage({
    message: '最近睡不好而且白天一直提不起勁。',
    user: 'demo',
    conversation_id: 'conv-output-raw-patient-analysis'
  });

  const analysis = await engine.generateOutput({
    conversation_id: 'conv-output-raw-patient-analysis',
    user: 'demo',
    output_type: 'patient_analysis',
    force_refresh: true
  });

  assert.ok(analysis.output.markdown.includes('睡眠'));
  assert.ok(analysis.output.markdown.includes('## 給你的分析'));
  assert.ok(!analysis.output.markdown.includes('depressed_mood'));
}

async function testPatientAnalysisKeepsGeneratedMarkdownWithSupportPhrase() {
  const modelClient = createPatientAnalysisContainsSupportPhraseModelClient();
  const engine = new AICompanionEngine({ modelClient, apiKey: 'fake' });
  await engine.handleMessage({
    message: '最近壓力很大，想到工作就胸口悶。',
    user: 'demo',
    conversation_id: 'conv-output-patient-support-phrase'
  });

  const analysis = await engine.generateOutput({
    conversation_id: 'conv-output-patient-support-phrase',
    user: 'demo',
    output_type: 'patient_analysis',
    force_refresh: true
  });

  assert.ok(analysis.output.markdown.includes('你需要支持，但不想被命令'));
  assert.ok(!analysis.output.markdown.includes('目前資料還偏少'));
}

async function testOutputHydratesFromClientHistoryWhenServerSessionEmpty() {
  const modelClient = createStubModelClient();
  const engine = new AICompanionEngine({ modelClient, apiKey: 'fake' });
  const result = await engine.generateOutput({
    conversation_id: 'conv-output-client-history-hydration',
    user: 'demo',
    output_type: 'fhir_delivery',
    force_refresh: true,
    client_history: [
      { role: 'user', content: '我最近失眠很嚴重，肚子痛又發冷，情緒也很差。' },
      { role: 'assistant', content: '我聽到了，我們可以一起整理重點。' }
    ]
  });
  assert.strictEqual(result.metadata.output_source, 'fresh');
  assert.ok(Array.isArray(result.output.observation_candidates));
  assert.ok(result.output.observation_candidates.length > 0);
}

async function run() {
  await testOutputCaching();
  await testForceRefreshBypassesOutputCache();
  await testStructuredObservationRewritingAndLeanFhirDraft();
  await testFormalAssessmentBackfillsScoredItemsFromClinicalEvidence();
  await testPhq9OnlySessionsStillGenerateStructuredDrafts();
  await testPatientAnalysisUsesMeaningfulNarrative();
  await testPatientAnalysisFallsBackToRawModelTextWhenJsonInvalid();
  await testPatientAnalysisKeepsGeneratedMarkdownWithSupportPhrase();
  await testOutputHydratesFromClientHistoryWhenServerSessionEmpty();
  console.log('AI companion output tests passed.');
}

run();
