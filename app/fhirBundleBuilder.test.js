const assert = require('assert');
const { buildSessionExportBundle } = require('./fhirBundleBuilder');

function createValidInput() {
  return {
    patient: {
      key: 'patient-001',
      name: 'Test Patient',
      gender: 'female',
      birthDate: '1995-07-14'
    },
    session: {
      encounterKey: 'session-001',
      startedAt: '2026-03-29T09:00:00+08:00',
      endedAt: '2026-03-29T09:30:00+08:00'
    },
    author: 'AI Companion MVP',
    clinician_summary_draft: {
      chief_concerns: [
        '近兩三週情緒低落',
        '睡著後容易醒',
        '工作效率下降'
      ],
      symptom_observations: [
        '情緒低落',
        '興趣下降',
        '睡眠中斷'
      ],
      followup_needs: [
        '追蹤身體焦慮',
        '確認被動消失念頭頻率'
      ],
      safety_flags: [
        '被動消失想法',
        '目前否認立即自傷計畫'
      ],
      hamd_item_scores: [
        { item_code: 'depressed_mood', item_label: '憂鬱情緒', ai_suggested_score: 2, clinician_final_score: null },
        { item_code: 'retardation', item_label: '精神運動遲滯', ai_suggested_score: 1, clinician_final_score: null }
      ],
      hamd_total_score_ai: 7,
      hamd_total_score_clinician: null,
      hamd_severity_band: 'mild',
      hamd_evidence_table: [
        { item_label: '憂鬱情緒', evidence_type: 'direct_answer', evidence_summary: ['病人表示這週常常覺得心裡很重'], rating_rationale: '依病人直接回答映射正式 HAM-D 分值。' },
        { item_label: '精神運動遲滯', evidence_type: 'indirect_observation', evidence_summary: ['對話反應變慢', '語句縮短'], rating_rationale: '依互動觀察形成 AI 建議分數。' }
      ],
      hamd_review_required_items: ['retardation'],
      hamd_signals: [
        'depressed_mood',
        'work_interest',
        'insomnia'
      ]
    },
    patient_analysis: {
      plain_summary: '最近疲憊與睡眠不佳，需要進一步評估。',
      key_points: ['疲憊', '睡眠不佳'],
      reminder: '這不是醫療診斷。'
    },
    patient_review_packet: {
      patient_facing_summary: '請確認最近疲憊與睡眠不佳是否正確。',
      confirm_items: ['你感到疲憊', '你有睡眠不佳的情況'],
      editable_items: ['疲憊的具體感受'],
      authorization_prompt: '請在審閱後授權我們將這些資訊提供給醫師。'
    },
    fhir_delivery_draft: {
      composition_sections: [
        { section: '患者近期感到疲憊並且睡眠不佳。', focus: '臨床摘要' }
      ],
      clinical_alerts: ['患者表達疲憊與睡眠不佳，需醫師注意'],
      questionnaire_targets: ['HAM-D量表'],
      hamd_formal_targets: [
        { item_code: 'guilt', evidence_type: 'indirect_observation', status: 'preliminary' }
      ],
      export_blockers: ['等待病人進一步確認症狀細節']
    },
    hamd_progress_state: {
      covered_dimensions: [
        'depressed_mood',
        'work_interest',
        'insomnia'
      ],
      supported_dimensions: [
        'depressed_mood',
        'work_interest',
        'insomnia'
      ],
      recent_evidence: [
        '近兩三週情緒低落',
        '睡著後容易醒',
        '工作效率下降'
      ],
      next_recommended_dimension: 'somatic_anxiety'
    },
    hamd_formal_assessment: {
      scale_version: 'HAM-D17',
      status: 'review_required',
      assessment_mode: 'mixed',
      recall_window: 'past_7_days',
      ai_total_score: 7,
      clinician_total_score: null,
      severity_band: 'mild',
      review_flags: ['retardation'],
      items: [
        {
          item_code: 'depressed_mood',
          item_label: '憂鬱情緒',
          scale_range: '0_to_4',
          evidence_type: 'direct_answer',
          direct_answer_value: 2,
          ai_suggested_score: 2,
          clinician_final_score: null,
          evidence_summary: ['病人表示這週常常覺得心裡很重'],
          rating_rationale: '依病人直接回答映射正式 HAM-D 分值。',
          confidence: 'high',
          review_required: false
        },
        {
          item_code: 'retardation',
          item_label: '精神運動遲滯',
          scale_range: '0_to_4',
          evidence_type: 'indirect_observation',
          direct_answer_value: null,
          ai_suggested_score: 1,
          clinician_final_score: null,
          evidence_summary: ['對話反應變慢', '語句縮短'],
          rating_rationale: '依互動觀察形成 AI 建議分數。',
          confidence: 'medium',
          review_required: true
        }
      ]
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
}

function testBuildsBundleForValidInput() {
  const result = buildSessionExportBundle(createValidInput());
  assert.ok(result.bundle_json, 'bundle_json should exist');
  assert.ok(Array.isArray(result.bundle_json.entry), 'bundle entries should exist');
  assert.ok(result.bundle_json.entry.length >= 5, 'bundle should include core resources');
  assert.ok(result.resource_index.Patient.length === 1, 'bundle should include one Patient');
  assert.ok(result.resource_index.Encounter.length === 1, 'bundle should include one Encounter');
  assert.ok(result.resource_index.QuestionnaireResponse.length === 1, 'bundle should include one QuestionnaireResponse');
  assert.ok(result.resource_index.Observation.length >= 1, 'bundle should include observations');
  assert.ok(result.resource_index.Composition.length === 1, 'bundle should include one Composition');
  assert.ok(result.resource_index.DocumentReference.length === 1, 'bundle should include one DocumentReference');
  assert.ok(result.resource_index.Provenance.length === 1, 'bundle should include one Provenance');
  assert.deepStrictEqual(result.blocking_reasons, []);
  assert.ok(result.validation_report, 'validation_report should exist');
  assert.strictEqual(result.validation_report.valid, true);
}

function testBlocksWithoutClinicianSummary() {
  const input = createValidInput();
  input.clinician_summary_draft = '';
  const result = buildSessionExportBundle(input);
  assert.strictEqual(result.bundle_json, null);
  assert.ok(result.blocking_reasons.includes('clinician_summary_draft is missing.'));
  assert.strictEqual(result.validation_report, null);
}

function testBlocksWhenSharingNotAllowed() {
  const input = createValidInput();
  input.patient_authorization_state.share_with_clinician = 'no';
  const result = buildSessionExportBundle(input);
  assert.strictEqual(result.bundle_json, null);
  assert.ok(result.blocking_reasons.includes('patient_authorization_state does not allow clinician sharing.'));
}

function testBlocksWhenReadinessIsBlocked() {
  const input = createValidInput();
  input.delivery_readiness_state.readiness_status = 'blocked';
  const result = buildSessionExportBundle(input);
  assert.strictEqual(result.bundle_json, null);
  assert.ok(result.blocking_reasons.includes('delivery_readiness_state is not ready_for_backend_mapping.'));
}

function testReferencesAreConnected() {
  const result = buildSessionExportBundle(createValidInput());
  const entries = result.bundle_json.entry;
  const patient = entries.find((entry) => entry.resource.resourceType === 'Patient');
  const encounter = entries.find((entry) => entry.resource.resourceType === 'Encounter');
  const questionnaire = entries.find((entry) => entry.resource.resourceType === 'QuestionnaireResponse');
  const composition = entries.find((entry) => entry.resource.resourceType === 'Composition');
  const observation = entries.find((entry) => entry.resource.resourceType === 'Observation');
  const documentReference = entries.find((entry) => entry.resource.resourceType === 'DocumentReference');
  const provenance = entries.find((entry) => entry.resource.resourceType === 'Provenance');

  assert.strictEqual(encounter.resource.subject.reference, patient.fullUrl);
  assert.strictEqual(questionnaire.resource.subject.reference, patient.fullUrl);
  assert.strictEqual(questionnaire.resource.encounter.reference, encounter.fullUrl);
  assert.strictEqual(observation.resource.subject.reference, patient.fullUrl);
  assert.strictEqual(observation.resource.encounter.reference, encounter.fullUrl);
  assert.strictEqual(composition.resource.subject.reference, patient.fullUrl);
  assert.strictEqual(composition.resource.encounter.reference, encounter.fullUrl);
  assert.strictEqual(observation.resource.derivedFrom[0].reference, questionnaire.fullUrl);
  assert.strictEqual(documentReference.resource.subject.reference, patient.fullUrl);
  assert.ok(provenance.resource.target.some((target) => target.reference === composition.fullUrl));
}

function testClinicalContentIsEnriched() {
  const result = buildSessionExportBundle(createValidInput());
  const entries = result.bundle_json.entry;
  const questionnaire = entries.find((entry) => entry.resource.resourceType === 'QuestionnaireResponse');
  const composition = entries.find((entry) => entry.resource.resourceType === 'Composition');
  const observation = entries.find((entry) => entry.resource.resourceType === 'Observation');
  const documentReference = entries.find((entry) => entry.resource.resourceType === 'DocumentReference');

  assert.strictEqual(questionnaire.resource.questionnaire, 'https://example.org/fhir/Questionnaire/ai-companion-previsit-hamd17-draft-v1');
  assert.ok(Array.isArray(questionnaire.resource.extension) && questionnaire.resource.extension.length >= 2);
  assert.ok(questionnaire.resource.item.some((item) => item.linkId === 'patient_confirm_0'));
  assert.ok(questionnaire.resource.item.some((item) => item.linkId === 'questionnaire_target_0'));
  assert.strictEqual(composition.resource.confidentiality, 'R');
  assert.ok(composition.resource.section.some((section) => section.code && section.code.text === 'chief-concerns'));
  assert.ok(composition.resource.section.some((section) => section.code && section.code.text === 'hamd-evidence-table'));
  assert.ok(composition.resource.section.some((section) => section.code && section.code.text === 'patient-analysis'));
  assert.ok(composition.resource.section.some((section) => section.code && section.code.text === 'patient-review-packet'));
  assert.ok(composition.resource.section.some((section) => section.code && section.code.text === 'clinical-alerts'));
  assert.ok(observation.resource.extension.some((extension) => extension.url.indexOf('patient-review-status') !== -1));
  assert.strictEqual(documentReference.resource.docStatus, 'preliminary');
  assert.ok(documentReference.resource.content[0].attachment.data);
  assert.ok(documentReference.resource.content[1].attachment.data);
  assert.ok(!documentReference.resource.relatesTo, 'DocumentReference.relatesTo should be omitted for HAPI R4 compatibility');
}

function testValidationReportHasExpectedShape() {
  const result = buildSessionExportBundle(createValidInput());
  assert.ok(typeof result.validation_report.issue_count === 'number');
  assert.ok(typeof result.validation_report.errors === 'number');
  assert.ok(typeof result.validation_report.warnings === 'number');
  assert.ok(Array.isArray(result.validation_report.issues));
}

function run() {
  testBuildsBundleForValidInput();
  testBlocksWithoutClinicianSummary();
  testBlocksWhenSharingNotAllowed();
  testBlocksWhenReadinessIsBlocked();
  testReferencesAreConnected();
  testClinicalContentIsEnriched();
  testValidationReportHasExpectedShape();
  console.log('FHIR bundle builder tests passed.');
}

run();
