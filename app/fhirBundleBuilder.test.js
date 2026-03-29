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
      hamd_signals: [
        'depressed_mood',
        'work_interest',
        'insomnia'
      ]
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

  assert.strictEqual(questionnaire.resource.questionnaire, 'https://example.org/fhir/Questionnaire/ai-companion-previsit-hamd-lite-v1');
  assert.ok(Array.isArray(questionnaire.resource.extension) && questionnaire.resource.extension.length >= 2);
  assert.strictEqual(composition.resource.confidentiality, 'R');
  assert.ok(composition.resource.section.some((section) => section.code && section.code.text === 'chief-concerns'));
  assert.ok(observation.resource.extension.some((extension) => extension.url.indexOf('patient-review-status') !== -1));
  assert.strictEqual(documentReference.resource.docStatus, 'preliminary');
  assert.ok(documentReference.resource.content[0].attachment.data);
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
