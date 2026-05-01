const assert = require('assert');
const { normalizeAssignmentRecord } = require('./assignmentPersistence');

function run() {
  const assignment = normalizeAssignmentRecord({
    patientId: 'competition-showcase-user',
    patientName: '閻星澄',
    patientGeneratedFhirDelivery: {
      delivery_status: 'delivered',
      fhir_base_url: 'https://hapi.fhir.org/baseR4/',
      recorded_at: '2026-05-01T15:20:00+08:00',
      created_resources: {
        Patient: 'Patient/131998314',
        Encounter: 'Encounter/131998315'
      },
      validation_report: {
        valid: true,
        issue_count: 0,
        errors: 0,
        warnings: 0
      }
    }
  });

  assert.equal(assignment.patientId, 'competition-showcase-user');
  assert.equal(assignment.patientGeneratedFhirDelivery.delivery_status, 'delivered');
  assert.equal(assignment.patientGeneratedFhirDelivery.fhir_base_url, 'https://hapi.fhir.org/baseR4');
  assert.deepEqual(assignment.patientGeneratedFhirDelivery.created_resources, {
    Patient: 'Patient/131998314',
    Encounter: 'Encounter/131998315'
  });
  assert.equal(assignment.patientGeneratedFhirDelivery.validation_report.valid, true);
}

run();
console.log('assignmentPersistence tests passed');
