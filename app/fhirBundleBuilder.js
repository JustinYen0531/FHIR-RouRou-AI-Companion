(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FhirBundleBuilder = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const TW_CORE_PROFILES = {
    patient: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Patient-twcore',
    encounter: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Encounter-twcore',
    questionnaireResponse: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/QuestionnaireResponse-twcore',
    observationScreeningAssessment: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Observation-screening-assessment-twcore',
    composition: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Composition-twcore'
  };

  const AI_COMPANION_EXTENSIONS = {
    aiGenerated: 'https://example.org/fhir/StructureDefinition/ai-companion-generated',
    patientReviewStatus: 'https://example.org/fhir/StructureDefinition/patient-review-status',
    reviewSource: 'https://example.org/fhir/StructureDefinition/review-source'
  };

  const DIMENSION_LABELS = {
    depressed_mood: 'Depressed mood',
    guilt: 'Guilt or self-blame',
    work_interest: 'Work and interest decline',
    retardation: 'Psychomotor slowing',
    agitation: 'Agitation',
    somatic_anxiety: 'Somatic anxiety',
    insomnia: 'Insomnia'
  };

  function hashSeed(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  function createUrn(prefix, seed) {
    const a = hashSeed(prefix + ':' + seed);
    const b = hashSeed(seed + ':' + prefix);
    return 'urn:uuid:' + [
      a.slice(0, 8),
      a.slice(0, 4),
      b.slice(0, 4),
      a.slice(4, 8),
      (a + b).slice(0, 12)
    ].join('-');
  }

  function toObject(value, fieldName, validationErrors) {
    if (value == null || value === '') {
      return {};
    }
    if (typeof value === 'object') {
      return value;
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        validationErrors.push(fieldName + ' is not valid JSON.');
        return {};
      }
    }
    validationErrors.push(fieldName + ' must be an object or JSON string.');
    return {};
  }

  function asArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function htmlEscape(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function addValidationErrorIfMissing(value, label, validationErrors) {
    if (!value) {
      validationErrors.push(label + ' is required.');
    }
  }

  function createReviewExtensions(input) {
    const reviewStatus = input.patient_authorization_state.authorization_status || 'review_required';
    return [
      {
        url: AI_COMPANION_EXTENSIONS.aiGenerated,
        valueBoolean: true
      },
      {
        url: AI_COMPANION_EXTENSIONS.patientReviewStatus,
        valueCode: reviewStatus
      },
      {
        url: AI_COMPANION_EXTENSIONS.reviewSource,
        valueString: input.patient_authorization_state.share_with_clinician === 'yes'
          ? 'ai_draft_with_patient_share_allowed'
          : 'ai_draft_pending_patient_share'
      }
    ];
  }

  function normalizeSummaryArray(value) {
    return asArray(value).map(function (item) {
      return String(item).trim();
    }).filter(Boolean);
  }

  function gatherObservationCandidates(clinicianSummary, hamdProgress, redFlag) {
    const candidates = [];
    const dimensions = asArray(hamdProgress.covered_dimensions);
    const supported = new Set(asArray(hamdProgress.supported_dimensions));
    const evidence = asArray(hamdProgress.recent_evidence);

    dimensions.forEach(function (dimension) {
      candidates.push({
        kind: 'hamd',
        focus: dimension,
        label: DIMENSION_LABELS[dimension] || dimension,
        category: 'survey',
        evidence: evidence.filter(function (item) {
          return typeof item === 'string' && item.toLowerCase().indexOf(dimension.replace(/_/g, ' ')) !== -1;
        }),
        supported: supported.has(dimension)
      });
    });

    asArray(redFlag.warning_tags).forEach(function (warningTag) {
      candidates.push({
        kind: 'risk',
        focus: warningTag,
        label: warningTag,
        category: 'survey',
        evidence: asArray(redFlag.signals),
        supported: true
      });
    });

    if (candidates.length === 0) {
      asArray(clinicianSummary.hamd_signals).forEach(function (signal) {
        candidates.push({
          kind: 'summary',
          focus: signal,
          label: DIMENSION_LABELS[signal] || signal,
          category: 'survey',
          evidence: asArray(clinicianSummary.symptom_observations),
          supported: true
        });
      });
    }

    return candidates;
  }

  function buildPatientResource(input, fullUrl) {
    return {
      resourceType: 'Patient',
      meta: { profile: [TW_CORE_PROFILES.patient] },
      identifier: [
        {
          system: input.patient.system || 'https://example.org/fhir/NamingSystem/ai-companion-patient-key',
          value: input.patient.key
        }
      ],
      active: true,
      name: input.patient.name
        ? [{ text: input.patient.name }]
        : undefined,
      gender: input.patient.gender || undefined,
      birthDate: input.patient.birthDate || undefined
    };
  }

  function buildEncounterResource(input, patientFullUrl) {
    return {
      resourceType: 'Encounter',
      meta: { profile: [TW_CORE_PROFILES.encounter] },
      status: 'in-progress',
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      subject: { reference: patientFullUrl },
      period: input.session.startedAt || input.session.endedAt
        ? {
            start: input.session.startedAt || undefined,
            end: input.session.endedAt || undefined
          }
        : undefined,
      identifier: [
        {
          system: input.session.system || 'https://example.org/fhir/NamingSystem/ai-companion-session-key',
          value: input.session.encounterKey
        }
      ]
    };
  }

  function buildQuestionnaireResponseResource(input, patientFullUrl, encounterFullUrl, hamdProgress) {
    const items = [];
    normalizeSummaryArray(hamdProgress.covered_dimensions).forEach(function (dimension) {
      items.push({
        linkId: dimension,
        text: DIMENSION_LABELS[dimension] || dimension,
        answer: [
          {
            valueString: 'Observed via AI companion conversation.'
          }
        ]
      });
    });

    if (asArray(hamdProgress.recent_evidence).length > 0) {
      items.push({
        linkId: 'recent_evidence',
        text: 'Recent evidence',
        answer: asArray(hamdProgress.recent_evidence).map(function (value) {
          return { valueString: String(value) };
        })
      });
    }

    if (hamdProgress.next_recommended_dimension) {
      items.push({
        linkId: 'next_recommended_dimension',
        text: 'Next recommended dimension',
        answer: [{ valueString: String(hamdProgress.next_recommended_dimension) }]
      });
    }

    return {
      resourceType: 'QuestionnaireResponse',
      meta: { profile: [TW_CORE_PROFILES.questionnaireResponse] },
      extension: createReviewExtensions(input),
      questionnaire: 'https://example.org/fhir/Questionnaire/ai-companion-previsit-hamd-lite-v1',
      identifier: [
        {
          system: 'https://example.org/fhir/NamingSystem/ai-companion-questionnaire-response',
          value: input.session.encounterKey
        }
      ],
      status: 'completed',
      subject: { reference: patientFullUrl },
      encounter: { reference: encounterFullUrl },
      authored: input.session.endedAt || input.session.startedAt || new Date().toISOString(),
      author: {
        display: input.author
      },
      item: items
    };
  }

  function buildObservationResources(input, patientFullUrl, encounterFullUrl, questionnaireFullUrl, candidates) {
    return candidates.map(function (candidate, index) {
      return {
        fullUrl: createUrn('observation', input.session.encounterKey + ':' + candidate.focus + ':' + index),
        resource: {
          resourceType: 'Observation',
          meta: { profile: [TW_CORE_PROFILES.observationScreeningAssessment] },
          extension: createReviewExtensions(input),
          identifier: [
            {
              system: 'https://example.org/fhir/NamingSystem/ai-companion-observation',
              value: input.session.encounterKey + ':' + candidate.focus + ':' + index
            }
          ],
          status: 'preliminary',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: candidate.category,
                  display: 'Survey'
                }
              ]
            }
          ],
          code: {
            coding: [
              {
                system: 'https://example.org/fhir/CodeSystem/ai-companion-signals',
                code: candidate.focus,
                display: candidate.label
              }
            ],
            text: candidate.label
          },
          subject: { reference: patientFullUrl },
          encounter: { reference: encounterFullUrl },
          effectiveDateTime: input.session.endedAt || input.session.startedAt || new Date().toISOString(),
          derivedFrom: questionnaireFullUrl ? [{ reference: questionnaireFullUrl }] : undefined,
          method: {
            text: 'AI companion conversation extraction'
          },
          valueString: candidate.supported ? 'supported signal' : 'observed signal',
          note: asArray(candidate.evidence).length
            ? asArray(candidate.evidence).map(function (entry) {
                return { text: String(entry) };
              })
            : undefined
        }
      };
    });
  }

  function buildCompositionResource(input, patientFullUrl, encounterFullUrl, questionnaireFullUrl, observationEntries, clinicianSummary) {
    const chiefConcerns = normalizeSummaryArray(clinicianSummary.chief_concerns);
    const symptomObservations = normalizeSummaryArray(clinicianSummary.symptom_observations);
    const safetyFlags = normalizeSummaryArray(clinicianSummary.safety_flags);
    const followupNeeds = normalizeSummaryArray(clinicianSummary.followup_needs);

    const sections = [];

    if (chiefConcerns.length) {
      sections.push({
        code: {
          text: 'chief-concerns'
        },
        title: 'Chief Concerns',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + chiefConcerns.map(function (item) {
            return '<li>' + htmlEscape(item) + '</li>';
          }).join('') + '</ul></div>'
        }
      });
    }

    if (symptomObservations.length) {
      sections.push({
        code: {
          text: 'symptom-observations'
        },
        title: 'Symptom Observations',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + symptomObservations.map(function (item) {
            return '<li>' + htmlEscape(item) + '</li>';
          }).join('') + '</ul></div>'
        },
        entry: observationEntries.map(function (entry) {
          return { reference: entry.fullUrl };
        })
      });
    }

    if (safetyFlags.length) {
      sections.push({
        code: {
          text: 'safety-flags'
        },
        title: 'Safety',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + safetyFlags.map(function (item) {
            return '<li>' + htmlEscape(item) + '</li>';
          }).join('') + '</ul></div>'
        }
      });
    }

    if (followupNeeds.length) {
      sections.push({
        code: {
          text: 'followup-needs'
        },
        title: 'Follow-up Needs',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + followupNeeds.map(function (item) {
            return '<li>' + htmlEscape(item) + '</li>';
          }).join('') + '</ul></div>'
        }
      });
    }

    return {
      resourceType: 'Composition',
      meta: { profile: [TW_CORE_PROFILES.composition] },
      extension: createReviewExtensions(input),
      identifier: [
        {
          system: 'https://example.org/fhir/NamingSystem/ai-companion-composition',
          value: input.session.encounterKey
        }
      ],
      status: 'preliminary',
      type: {
        text: 'AI Companion pre-visit summary'
      },
      subject: { reference: patientFullUrl },
      encounter: { reference: encounterFullUrl },
      date: input.session.endedAt || input.session.startedAt || new Date().toISOString(),
      title: 'AI Companion Pre-Visit Summary',
      confidentiality: 'R',
      section: sections,
      author: input.author
        ? [{ display: input.author }]
        : undefined,
      relatesTo: questionnaireFullUrl
        ? [{ code: 'appends', targetReference: { reference: questionnaireFullUrl } }]
        : undefined
    };
  }

  function buildBundle(entries) {
    return {
      resourceType: 'Bundle',
      type: 'transaction',
      entry: entries.map(function (entry) {
        return {
          fullUrl: entry.fullUrl,
          resource: entry.resource,
          request: {
            method: 'POST',
            url: entry.resource.resourceType
          }
        };
      })
    };
  }

  function buildResourceIndex(entries) {
    return entries.reduce(function (acc, entry) {
      if (!acc[entry.resource.resourceType]) {
        acc[entry.resource.resourceType] = [];
      }
      acc[entry.resource.resourceType].push(entry.fullUrl);
      return acc;
    }, {});
  }

  function basicValidation(bundle, input, validationErrors) {
    if (!bundle || !bundle.entry || !bundle.entry.length) {
      return;
    }

    const resourceTypes = bundle.entry.map(function (entry) {
      return entry.resource.resourceType;
    });

    ['Patient', 'Encounter', 'QuestionnaireResponse', 'Composition'].forEach(function (resourceType) {
      if (resourceTypes.indexOf(resourceType) === -1) {
        validationErrors.push(resourceType + ' resource is missing from bundle.');
      }
    });

    if (resourceTypes.filter(function (type) { return type === 'Observation'; }).length === 0) {
      validationErrors.push('At least one Observation is required.');
    }

    if (!input.session.encounterKey) {
      validationErrors.push('session.encounterKey is required for internal bundle references.');
    }

    if (!normalizeSummaryArray(input.clinician_summary_draft.chief_concerns).length) {
      validationErrors.push('clinician_summary_draft.chief_concerns should contain at least one item.');
    }

    if (!normalizeSummaryArray(input.clinician_summary_draft.symptom_observations).length) {
      validationErrors.push('clinician_summary_draft.symptom_observations should contain at least one item.');
    }

    if (!normalizeSummaryArray(input.hamd_progress_state.covered_dimensions).length) {
      validationErrors.push('hamd_progress_state.covered_dimensions should contain at least one item.');
    }
  }

  function buildSessionExportBundle(rawInput) {
    const validationErrors = [];
    const blockingReasons = [];
    const input = {
      patient: rawInput && rawInput.patient ? rawInput.patient : {},
      session: rawInput && rawInput.session ? rawInput.session : {},
      author: rawInput && rawInput.author ? rawInput.author : 'AI Companion',
      clinician_summary_draft: toObject(rawInput && rawInput.clinician_summary_draft, 'clinician_summary_draft', validationErrors),
      hamd_progress_state: toObject(rawInput && rawInput.hamd_progress_state, 'hamd_progress_state', validationErrors),
      red_flag_payload: toObject(rawInput && rawInput.red_flag_payload, 'red_flag_payload', validationErrors),
      patient_authorization_state: toObject(rawInput && rawInput.patient_authorization_state, 'patient_authorization_state', validationErrors),
      delivery_readiness_state: toObject(rawInput && rawInput.delivery_readiness_state, 'delivery_readiness_state', validationErrors)
    };

    addValidationErrorIfMissing(input.patient.key, 'patient.key', validationErrors);
    addValidationErrorIfMissing(input.session.encounterKey, 'session.encounterKey', validationErrors);

    if (!Object.keys(input.clinician_summary_draft).length) {
      blockingReasons.push('clinician_summary_draft is missing.');
    }

    if (!Object.keys(input.hamd_progress_state).length) {
      blockingReasons.push('hamd_progress_state is missing.');
    }

    if (input.patient_authorization_state.share_with_clinician !== 'yes') {
      blockingReasons.push('patient_authorization_state does not allow clinician sharing.');
    }

    const readinessStatus = input.delivery_readiness_state.readiness_status;
    if (readinessStatus !== 'ready_for_backend_mapping') {
      blockingReasons.push('delivery_readiness_state is not ready_for_backend_mapping.');
    }

    if (validationErrors.length || blockingReasons.length) {
      return {
        bundle_json: null,
        resource_index: {},
        validation_errors: validationErrors,
        blocking_reasons: blockingReasons
      };
    }

    const patientFullUrl = createUrn('patient', input.patient.key);
    const encounterFullUrl = createUrn('encounter', input.session.encounterKey);
    const questionnaireFullUrl = createUrn('questionnaire-response', input.session.encounterKey);
    const compositionFullUrl = createUrn('composition', input.session.encounterKey);

    const observationEntries = buildObservationResources(
      input,
      patientFullUrl,
      encounterFullUrl,
      questionnaireFullUrl,
      gatherObservationCandidates(
        input.clinician_summary_draft,
        input.hamd_progress_state,
        input.red_flag_payload
      )
    );

    const patientEntry = {
      fullUrl: patientFullUrl,
      resource: buildPatientResource(input, patientFullUrl)
    };

    const encounterEntry = {
      fullUrl: encounterFullUrl,
      resource: buildEncounterResource(input, patientFullUrl)
    };

    const questionnaireEntry = {
      fullUrl: questionnaireFullUrl,
      resource: buildQuestionnaireResponseResource(
        input,
        patientFullUrl,
        encounterFullUrl,
        input.hamd_progress_state
      )
    };

    const compositionEntry = {
      fullUrl: compositionFullUrl,
      resource: buildCompositionResource(
        input,
        patientFullUrl,
        encounterFullUrl,
        questionnaireFullUrl,
        observationEntries,
        input.clinician_summary_draft
      )
    };

    const entries = [patientEntry, encounterEntry, questionnaireEntry]
      .concat(observationEntries)
      .concat([compositionEntry]);

    const bundle = buildBundle(entries);
    basicValidation(bundle, input, validationErrors);

    return {
      bundle_json: bundle,
      resource_index: buildResourceIndex(entries),
      validation_errors: validationErrors,
      blocking_reasons: blockingReasons
    };
  }

  return {
    TW_CORE_PROFILES: TW_CORE_PROFILES,
    buildSessionExportBundle: buildSessionExportBundle
  };
});
