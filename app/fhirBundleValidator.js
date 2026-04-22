(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FhirBundleValidator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const REQUIRED_PROFILES = {
    Patient: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Patient-twcore',
    Encounter: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Encounter-twcore',
    QuestionnaireResponse: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/QuestionnaireResponse-twcore',
    Observation: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Observation-screening-assessment-twcore',
    ClinicalImpression: 'http://hl7.org/fhir/StructureDefinition/ClinicalImpression',
    Composition: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Composition-twcore',
    DocumentReference: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/DocumentReference-twcore',
    Provenance: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Provenance-twcore'
  };
  const CLINICAL_IMPRESSION_STATUSES = new Set([
    'in-progress',
    'completed',
    'entered-in-error'
  ]);
  const COMPOSITION_STATUSES = new Set([
    'preliminary',
    'final',
    'amended',
    'entered-in-error'
  ]);
  const QUESTIONNAIRE_RESPONSE_STATUSES = new Set([
    'in-progress',
    'completed',
    'amended',
    'entered-in-error',
    'stopped'
  ]);

  function getEntries(bundle) {
    return bundle && Array.isArray(bundle.entry) ? bundle.entry : [];
  }

  function pushIssue(report, severity, code, message, location) {
    report.issues.push({
      severity: severity,
      code: code,
      message: message,
      location: location || null
    });
  }

  function validateMetaProfile(report, resource, index) {
    const expectedProfile = REQUIRED_PROFILES[resource.resourceType];
    const profiles = resource.meta && Array.isArray(resource.meta.profile) ? resource.meta.profile : [];
    if (expectedProfile && profiles.indexOf(expectedProfile) === -1) {
      pushIssue(report, 'error', 'missing_profile', resource.resourceType + ' is missing expected profile.', 'entry[' + index + '].resource.meta.profile');
    }
  }

  function validatePatient(report, resource, index) {
    if (!Array.isArray(resource.identifier) || !resource.identifier.length) {
      pushIssue(report, 'error', 'patient_identifier_missing', 'Patient.identifier is required.', 'entry[' + index + '].resource.identifier');
    }
    if (!Array.isArray(resource.name) || !resource.name.length) {
      pushIssue(report, 'warning', 'patient_name_missing', 'Patient.name is recommended for clinical readability.', 'entry[' + index + '].resource.name');
    }
  }

  function validateEncounter(report, resource, index) {
    if (!resource.subject || !resource.subject.reference) {
      pushIssue(report, 'error', 'encounter_subject_missing', 'Encounter.subject.reference is required.', 'entry[' + index + '].resource.subject.reference');
    }
    if (!resource.class || !resource.class.code) {
      pushIssue(report, 'error', 'encounter_class_missing', 'Encounter.class.code is required.', 'entry[' + index + '].resource.class.code');
    }
  }

  function validateQuestionnaireResponse(report, resource, index) {
    if (!resource.subject || !resource.subject.reference) {
      pushIssue(report, 'error', 'questionnaire_subject_missing', 'QuestionnaireResponse.subject.reference is required.', 'entry[' + index + '].resource.subject.reference');
    }
    if (!resource.encounter || !resource.encounter.reference) {
      pushIssue(report, 'warning', 'questionnaire_encounter_missing', 'QuestionnaireResponse.encounter.reference is recommended.', 'entry[' + index + '].resource.encounter.reference');
    }
    if (!Array.isArray(resource.item) || !resource.item.length) {
      pushIssue(report, 'error', 'questionnaire_items_missing', 'QuestionnaireResponse.item should contain at least one item.', 'entry[' + index + '].resource.item');
    }
    if (!resource.status) {
      pushIssue(report, 'error', 'questionnaire_status_missing', 'QuestionnaireResponse.status is required.', 'entry[' + index + '].resource.status');
    } else if (!QUESTIONNAIRE_RESPONSE_STATUSES.has(resource.status)) {
      pushIssue(report, 'error', 'questionnaire_status_invalid', 'QuestionnaireResponse.status must be in-progress, completed, amended, entered-in-error, or stopped.', 'entry[' + index + '].resource.status');
    }
  }

  function validateObservation(report, resource, index) {
    if (!resource.subject || !resource.subject.reference) {
      pushIssue(report, 'error', 'observation_subject_missing', 'Observation.subject.reference is required.', 'entry[' + index + '].resource.subject.reference');
    }
    if (!resource.encounter || !resource.encounter.reference) {
      pushIssue(report, 'warning', 'observation_encounter_missing', 'Observation.encounter.reference is recommended.', 'entry[' + index + '].resource.encounter.reference');
    }
    if (!resource.code || !Array.isArray(resource.code.coding) || !resource.code.coding.length) {
      pushIssue(report, 'error', 'observation_code_missing', 'Observation.code.coding is required.', 'entry[' + index + '].resource.code.coding');
    }
    if (!Array.isArray(resource.category) || !resource.category.length) {
      pushIssue(report, 'warning', 'observation_category_missing', 'Observation.category is recommended for screening assessment.', 'entry[' + index + '].resource.category');
    }
  }

  function validateComposition(report, resource, index) {
    if (!resource.subject || !resource.subject.reference) {
      pushIssue(report, 'error', 'composition_subject_missing', 'Composition.subject.reference is required.', 'entry[' + index + '].resource.subject.reference');
    }
    if (!resource.encounter || !resource.encounter.reference) {
      pushIssue(report, 'warning', 'composition_encounter_missing', 'Composition.encounter.reference is recommended.', 'entry[' + index + '].resource.encounter.reference');
    }
    if (!Array.isArray(resource.section) || !resource.section.length) {
      pushIssue(report, 'error', 'composition_sections_missing', 'Composition.section should contain at least one section.', 'entry[' + index + '].resource.section');
    }
    if (!resource.status) {
      pushIssue(report, 'error', 'composition_status_missing', 'Composition.status is required.', 'entry[' + index + '].resource.status');
    } else if (!COMPOSITION_STATUSES.has(resource.status)) {
      pushIssue(report, 'error', 'composition_status_invalid', 'Composition.status must be preliminary, final, amended, or entered-in-error.', 'entry[' + index + '].resource.status');
    }
    if (!resource.title) {
      pushIssue(report, 'warning', 'composition_title_missing', 'Composition.title is recommended.', 'entry[' + index + '].resource.title');
    }
  }

  function validateClinicalImpression(report, resource, index) {
    if (!resource.subject || !resource.subject.reference) {
      pushIssue(report, 'error', 'clinical_impression_subject_missing', 'ClinicalImpression.subject.reference is required.', 'entry[' + index + '].resource.subject.reference');
    }
    if (!resource.encounter || !resource.encounter.reference) {
      pushIssue(report, 'warning', 'clinical_impression_encounter_missing', 'ClinicalImpression.encounter.reference is recommended.', 'entry[' + index + '].resource.encounter.reference');
    }
    if (!resource.status) {
      pushIssue(report, 'error', 'clinical_impression_status_missing', 'ClinicalImpression.status is required.', 'entry[' + index + '].resource.status');
    } else if (!CLINICAL_IMPRESSION_STATUSES.has(resource.status)) {
      pushIssue(report, 'error', 'clinical_impression_status_invalid', 'ClinicalImpression.status must be in-progress, completed, or entered-in-error.', 'entry[' + index + '].resource.status');
    }
    if (!resource.description && !resource.summary) {
      pushIssue(report, 'error', 'clinical_impression_summary_missing', 'ClinicalImpression.description or summary is required.', 'entry[' + index + '].resource.description');
    }
  }

  function validateDocumentReference(report, resource, index) {
    if (!resource.subject || !resource.subject.reference) {
      pushIssue(report, 'error', 'document_reference_subject_missing', 'DocumentReference.subject.reference is required.', 'entry[' + index + '].resource.subject.reference');
    }
    if (!Array.isArray(resource.content) || !resource.content.length) {
      pushIssue(report, 'error', 'document_reference_content_missing', 'DocumentReference.content is required.', 'entry[' + index + '].resource.content');
    }
  }

  function validateProvenance(report, resource, index) {
    if (!Array.isArray(resource.target) || !resource.target.length) {
      pushIssue(report, 'error', 'provenance_target_missing', 'Provenance.target is required.', 'entry[' + index + '].resource.target');
    }
    if (!Array.isArray(resource.agent) || !resource.agent.length) {
      pushIssue(report, 'warning', 'provenance_agent_missing', 'Provenance.agent is recommended.', 'entry[' + index + '].resource.agent');
    }
  }

  function validateBundle(bundle) {
    const report = {
      valid: true,
      issue_count: 0,
      errors: 0,
      warnings: 0,
      issues: []
    };

    const entries = getEntries(bundle);

    if (!bundle || bundle.resourceType !== 'Bundle') {
      pushIssue(report, 'error', 'bundle_type_invalid', 'Top-level resourceType must be Bundle.', 'bundle.resourceType');
    }

    if (!bundle || bundle.type !== 'transaction') {
      pushIssue(report, 'error', 'bundle_transaction_required', 'Bundle.type must be transaction.', 'bundle.type');
    }

    if (!entries.length) {
      pushIssue(report, 'error', 'bundle_entries_missing', 'Bundle.entry must contain resources.', 'bundle.entry');
    }

    entries.forEach(function (entry, index) {
      const resource = entry.resource || {};
      validateMetaProfile(report, resource, index);

      if (resource.resourceType === 'Patient') validatePatient(report, resource, index);
      if (resource.resourceType === 'Encounter') validateEncounter(report, resource, index);
      if (resource.resourceType === 'QuestionnaireResponse') validateQuestionnaireResponse(report, resource, index);
      if (resource.resourceType === 'Observation') validateObservation(report, resource, index);
      if (resource.resourceType === 'ClinicalImpression') validateClinicalImpression(report, resource, index);
      if (resource.resourceType === 'Composition') validateComposition(report, resource, index);
      if (resource.resourceType === 'DocumentReference') validateDocumentReference(report, resource, index);
      if (resource.resourceType === 'Provenance') validateProvenance(report, resource, index);
    });

    report.errors = report.issues.filter(function (issue) { return issue.severity === 'error'; }).length;
    report.warnings = report.issues.filter(function (issue) { return issue.severity === 'warning'; }).length;
    report.issue_count = report.issues.length;
    report.valid = report.errors === 0;

    return report;
  }

  return {
    validateBundle: validateBundle,
    REQUIRED_PROFILES: REQUIRED_PROFILES
  };
});
