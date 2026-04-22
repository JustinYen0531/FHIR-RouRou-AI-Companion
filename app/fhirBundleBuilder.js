(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./fhirBundleValidator'));
  } else {
    root.FhirBundleBuilder = factory(root.FhirBundleValidator);
  }
})(typeof self !== 'undefined' ? self : this, function (validatorModule) {
  const TW_CORE_PROFILES = {
    patient: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Patient-twcore',
    encounter: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Encounter-twcore',
    questionnaireResponse: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/QuestionnaireResponse-twcore',
    observationScreeningAssessment: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Observation-screening-assessment-twcore',
    composition: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Composition-twcore',
    documentReference: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/DocumentReference-twcore',
    provenance: 'https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Provenance-twcore'
  };

  const INTERNAL_CANONICAL_BASE = 'https://rourou.ai/fhir/internal';

  const INTERNAL_CANONICALS = {
    structureDefinitions: {
      aiGenerated: INTERNAL_CANONICAL_BASE + '/StructureDefinition/ai-companion-generated',
      patientReviewStatus: INTERNAL_CANONICAL_BASE + '/StructureDefinition/patient-review-status',
      reviewSource: INTERNAL_CANONICAL_BASE + '/StructureDefinition/review-source'
    },
    namingSystems: {
      patientKey: INTERNAL_CANONICAL_BASE + '/NamingSystem/ai-companion-patient-key',
      sessionKey: INTERNAL_CANONICAL_BASE + '/NamingSystem/ai-companion-session-key',
      questionnaireResponse: INTERNAL_CANONICAL_BASE + '/NamingSystem/ai-companion-questionnaire-response',
      observation: INTERNAL_CANONICAL_BASE + '/NamingSystem/ai-companion-observation',
      composition: INTERNAL_CANONICAL_BASE + '/NamingSystem/ai-companion-composition',
      clinicalImpression: INTERNAL_CANONICAL_BASE + '/NamingSystem/ai-companion-clinical-impression'
    },
    questionnaires: {
      previsitHamd17Draft: INTERNAL_CANONICAL_BASE + '/Questionnaire/ai-companion-previsit-hamd17-draft-v1'
    },
    codeSystems: {
      signals: INTERNAL_CANONICAL_BASE + '/CodeSystem/ai-companion-signals'
    },
    note: 'Internal canonical namespace pending formal governance'
  };

  const AI_COMPANION_EXTENSIONS = INTERNAL_CANONICALS.structureDefinitions;

  const CLINICAL_IMPRESSION_PROFILE = 'http://hl7.org/fhir/StructureDefinition/ClinicalImpression';

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

  function normalizeDecisionToken(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
  }

  function isAuthorizationStatusAllowingShare(status) {
    const token = normalizeDecisionToken(status);
    return [
      'authorized',
      'ready_for_consent',
      'patient_authorized_manual_submit',
      'consented',
      'share_allowed',
      'approved',
      'allow_share'
    ].indexOf(token) !== -1;
  }

  function normalizeShareWithClinician(value, authorizationStatus) {
    if (typeof value === 'boolean') {
      return value ? 'yes' : 'no';
    }
    const raw = String(value == null ? '' : value).trim();
    const token = normalizeDecisionToken(raw);
    const allowTokens = {
      yes: true,
      y: true,
      true: true,
      '1': true,
      allow: true,
      allowed: true,
      authorized: true,
      approved: true,
      consented: true,
      share_allowed: true
    };
    const denyTokens = {
      no: true,
      n: true,
      false: true,
      '0': true,
      deny: true,
      denied: true,
      blocked: true,
      rejected: true,
      disallow: true
    };

    if (allowTokens[token]) return 'yes';
    if (denyTokens[token]) return 'no';

    if (raw) {
      if (/不同意|拒絕|不允許/.test(raw)) return 'no';
      if (/同意|允許|可以/.test(raw)) return 'yes';
    }

    return isAuthorizationStatusAllowingShare(authorizationStatus) ? 'yes' : 'no';
  }

  function normalizeReadinessStatus(value, isShareAllowed) {
    if (typeof value === 'boolean') {
      return value ? 'ready_for_backend_mapping' : 'blocked';
    }
    const token = normalizeDecisionToken(value);
    if (!token) {
      return isShareAllowed ? 'ready_for_backend_mapping' : 'blocked';
    }
    const readyTokens = {
      ready_for_backend_mapping: true,
      ready_for_mapping: true,
      ready_for_delivery: true,
      ready_to_deliver: true,
      ready_to_export: true,
      ready_for_handoff: true,
      ready: true,
      deliverable: true
    };
    const blockedTokens = {
      blocked: true,
      not_ready: true,
      review_required: true,
      pending: true,
      pending_review: true,
      hold: true,
      waiting_for_consent: true,
      wait_for_consent: true
    };

    if (readyTokens[token]) return 'ready_for_backend_mapping';
    if (blockedTokens[token]) return 'blocked';
    return isShareAllowed ? 'ready_for_backend_mapping' : 'blocked';
  }

  function createReviewExtensions(input) {
    const reviewStatus = input.patient_authorization_state.authorization_status || 'review_required';
    const shareWithClinician = normalizeShareWithClinician(
      input.patient_authorization_state.share_with_clinician,
      reviewStatus
    );
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
        valueString: shareWithClinician === 'yes'
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

  function dedupeStrings(values, limit) {
    const max = typeof limit === 'number' && limit > 0 ? limit : Infinity;
    const result = [];
    normalizeSummaryArray(values).forEach(function (item) {
      if (result.indexOf(item) !== -1) return;
      if (result.length >= max) return;
      result.push(item);
    });
    return result;
  }

  // ── Evidence 清洗規則 ────────────────────────────────────────────────────────
  // 目的：移除不應進入 QuestionnaireResponse.item 的低品質句子
  // 規則：
  //   1. 過短句（少於 6 個字元）
  //   2. 操作句 — 帶有系統操作意圖的句子（「請幫我」「請分析」「繼續」等）
  //   3. 純求助句 — 只是表達「不知道怎麼辦」的句子，無症狀訊號
  //   4. 重複句 — 與已保留句意思完全相同
  //   5. 上限 maxCount 筆（預設 5）

  var OPERATION_PATTERNS = [
    /^(請|麻煩|幫我|能不能|可以|繼續|開始|我要|好的|謝謝|嗯|好)/,
    /請(幫|分析|看|告訴|給|評估|整理)/,
    /^(繼續|開始|結束|送出|確認|OK|ok|yes|no|是|不是|好|嗯+)$/i,
    /(怎麼辦|該怎麼|不知道|沒辦法)(了?)(啊|嗎|呢)?$/
  ];

  var HELP_SEEKING_PATTERNS = [
    /^我(現在)?(不知道|沒辦法|很迷茫|好難)/,
    /^(我|這樣)(是不是|還好嗎|正常嗎)/,
    /求你|拜託(你|一下)/
  ];

  function isLowSignalSentence(text) {
    var s = String(text).trim();
    // 規則 1：過短
    if (s.length < 6) return true;
    // 規則 2：操作句
    for (var i = 0; i < OPERATION_PATTERNS.length; i++) {
      if (OPERATION_PATTERNS[i].test(s)) return true;
    }
    // 規則 3：純求助句
    for (var j = 0; j < HELP_SEEKING_PATTERNS.length; j++) {
      if (HELP_SEEKING_PATTERNS[j].test(s)) return true;
    }
    return false;
  }

  function cleanEvidence(evidenceArray, maxCount) {
    var max = typeof maxCount === 'number' && maxCount > 0 ? maxCount : 5;
    var seen = [];
    var result = [];
    var raw = asArray(evidenceArray);
    for (var i = 0; i < raw.length; i++) {
      var s = String(raw[i]).trim();
      // 規則 1-3：低訊號句過濾
      if (isLowSignalSentence(s)) continue;
      // 規則 4：重複句（完全相同）
      if (seen.indexOf(s) !== -1) continue;
      seen.push(s);
      result.push(s);
      // 規則 5：上限
      if (result.length >= max) break;
    }
    return result;
  }
  // ─────────────────────────────────────────────────────────────────────────────

  function collectQuestionnaireItems(input, hamdProgress, formalAssessment, clinicianSummary, patientReviewPacket, fhirDeliveryDraft) {
    const items = [];
    const formalItems = asArray(formalAssessment.items).filter(function (item) {
      return typeof item.ai_suggested_score === 'number' || typeof item.clinician_final_score === 'number' || asArray(item.evidence_summary).length;
    });
    const summaryItemScores = asArray(clinicianSummary.hamd_item_scores);

    if (formalItems.length) {
      formalItems.forEach(function (item) {
        const answerParts = [];
        if (typeof item.direct_answer_value === 'number') answerParts.push('direct=' + item.direct_answer_value);
        if (typeof item.ai_suggested_score === 'number') answerParts.push('ai=' + item.ai_suggested_score);
        if (typeof item.clinician_final_score === 'number') answerParts.push('clinician=' + item.clinician_final_score);
        if (item.evidence_type) answerParts.push('evidence=' + item.evidence_type);
        items.push({
          linkId: item.item_code,
          text: item.item_label,
          answer: [
            {
              valueString: answerParts.join('; ') || 'Formal HAM-D draft item'
            }
          ],
          item: asArray(item.evidence_summary).length
            ? [{
                linkId: item.item_code + '_evidence',
                text: 'Evidence summary',
                answer: asArray(item.evidence_summary).map(function (value) {
                  return { valueString: String(value) };
                })
              }]
            : undefined
        });
      });
    } else if (summaryItemScores.length) {
      summaryItemScores.forEach(function (item) {
        items.push({
          linkId: item.item_code || 'hamd_summary_item',
          text: item.item_label || item.item_code || 'HAM-D draft item',
          answer: [
            {
              valueString: [
                typeof item.ai_suggested_score === 'number' ? 'ai=' + item.ai_suggested_score : '',
                typeof item.clinician_final_score === 'number' ? 'clinician=' + item.clinician_final_score : ''
              ].filter(Boolean).join('; ') || 'Clinician summary draft item'
            }
          ]
        });
      });
    } else {
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
    }

    if (asArray(hamdProgress.recent_evidence).length > 0) {
      // ── 套用清洗規則：移除操作句、求助句、過短句、重複句，最多保留 5 筆 ──
      var cleanedEvidence = cleanEvidence(hamdProgress.recent_evidence, 5);
      if (cleanedEvidence.length > 0) {
        items.push({
          linkId: 'recent_evidence',
          text: 'Recent evidence (high-signal)',
          answer: cleanedEvidence.map(function (value) {
            return { valueString: value };
          })
        });
      }
    }

    if (hamdProgress.next_recommended_dimension) {
      items.push({
        linkId: 'next_recommended_dimension',
        text: 'Next recommended dimension',
        answer: [{ valueString: String(hamdProgress.next_recommended_dimension) }]
      });
    }

    if (typeof formalAssessment.ai_total_score === 'number') {
      items.push({
        linkId: 'hamd17_total_ai',
        text: 'HAM-D17 AI total score',
        answer: [{ valueInteger: formalAssessment.ai_total_score }]
      });
    }

    normalizeSummaryArray(patientReviewPacket.confirm_items).forEach(function (item, index) {
      items.push({
        linkId: 'patient_confirm_' + index,
        text: 'Patient review confirm item',
        answer: [{ valueString: item }]
      });
    });

    normalizeSummaryArray(patientReviewPacket.editable_items).forEach(function (item, index) {
      items.push({
        linkId: 'patient_editable_' + index,
        text: 'Patient editable item',
        answer: [{ valueString: item }]
      });
    });

    normalizeSummaryArray(fhirDeliveryDraft.questionnaire_targets).forEach(function (item, index) {
      items.push({
        linkId: 'questionnaire_target_' + index,
        text: 'Questionnaire target',
        answer: [{ valueString: item }]
      });
    });

    asArray(fhirDeliveryDraft.hamd_formal_targets).forEach(function (item, index) {
      items.push({
        linkId: 'formal_target_' + index,
        text: item.item_code || 'formal_target',
        answer: [{ valueString: [item.evidence_type, item.status].filter(Boolean).join('; ') || 'preliminary' }]
      });
    });

    if (patientReviewPacket.authorization_prompt) {
      items.push({
        linkId: 'authorization_prompt',
        text: 'Authorization prompt',
        answer: [{ valueString: String(patientReviewPacket.authorization_prompt) }]
      });
    }

    return items;
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

  function gatherFormalObservationCandidates(formalAssessment) {
    const candidates = [];
    const items = asArray(formalAssessment.items).filter(function (item) {
      return typeof item.ai_suggested_score === 'number';
    });

    items.forEach(function (item) {
      candidates.push({
        kind: 'formal_item',
        focus: item.item_code,
        label: item.item_label,
        category: 'survey',
        evidence: asArray(item.evidence_summary).concat(item.rating_rationale ? [item.rating_rationale] : []),
        supported: true,
        score: item.ai_suggested_score,
        evidenceType: item.evidence_type || 'mixed'
      });
    });

    if (typeof formalAssessment.ai_total_score === 'number') {
      candidates.push({
        kind: 'formal_total',
        focus: 'hamd17_total',
        label: 'HAM-D17 total score',
        category: 'survey',
        evidence: formalAssessment.severity_band ? ['severity_band: ' + formalAssessment.severity_band] : [],
        supported: true,
        score: formalAssessment.ai_total_score,
        evidenceType: 'mixed'
      });
    }

    return candidates;
  }

  function buildPatientResource(input, fullUrl) {
    const telecom = Array.isArray(input.patient.telecom) && input.patient.telecom.length
      ? input.patient.telecom.filter(Boolean)
      : [
          input.patient.phone
            ? {
                system: 'phone',
                value: input.patient.phone,
                use: 'mobile'
              }
            : null,
          input.patient.email
            ? {
                system: 'email',
                value: input.patient.email,
                use: 'home'
              }
            : null
        ].filter(Boolean);
    const contact = Array.isArray(input.patient.contact) && input.patient.contact.length
      ? input.patient.contact.filter(Boolean)
      : ((input.patient.emergencyName || input.patient.emergencyPhone)
          ? [{
              relationship: [{ text: 'Emergency contact' }],
              name: input.patient.emergencyName ? { text: input.patient.emergencyName } : undefined,
              telecom: input.patient.emergencyPhone
                ? [{
                    system: 'phone',
                    value: input.patient.emergencyPhone,
                    use: 'mobile'
                  }]
                : undefined
            }]
          : []);
    return {
      resourceType: 'Patient',
      meta: { profile: [TW_CORE_PROFILES.patient] },
      identifier: [
        {
          system: input.patient.system || INTERNAL_CANONICALS.namingSystems.patientKey,
          value: input.patient.key
        }
      ],
      active: true,
      name: input.patient.name
        ? [{ text: input.patient.name }]
        : undefined,
      gender: input.patient.gender || undefined,
      birthDate: input.patient.birthDate || undefined,
      telecom: telecom.length ? telecom : undefined,
      contact: contact.length ? contact : undefined
    };
  }

  function buildPatientResourceOnly(rawInput) {
    const validationErrors = [];
    const input = {
      patient: rawInput && rawInput.patient ? rawInput.patient : {}
    };

    addValidationErrorIfMissing(input.patient.key, 'patient.key', validationErrors);
    if (validationErrors.length) {
      return {
        resource_json: null,
        validation_errors: validationErrors,
        valid: false
      };
    }

    return {
      resource_json: buildPatientResource(input),
      validation_errors: [],
      valid: true
    };
  }

  function resolveEncounterStatus(session) {
    // 優先使用 session 明確提供的狀態；預設為 finished（已完成的摘要交付）
    const raw = session.encounterStatus;
    if (!raw) return 'finished';
    const token = String(raw).trim().toLowerCase();
    const validStatuses = {
      'planned': true,
      'arrived': true,
      'triaged': true,
      'in-progress': true,
      'onleave': true,
      'finished': true,
      'cancelled': true,
      'entered-in-error': true,
      'unknown': true
    };
    return validStatuses[token] ? token : 'finished';
  }

  function buildEncounterResource(input, patientFullUrl) {
    const session = input.session;

    // period：優先用 sessionStartedAt 作為開始、sessionEndedAt 作為結束
    // 避免 startedAt/endedAt 相同（都是輸出當下時間）的問題
    const periodStart = session.sessionStartedAt || session.startedAt || undefined;
    const periodEnd   = session.sessionEndedAt   || session.endedAt   || undefined;

    return {
      resourceType: 'Encounter',
      meta: { profile: [TW_CORE_PROFILES.encounter] },
      status: resolveEncounterStatus(session),
      class: {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'AMB',
        display: 'ambulatory'
      },
      subject: { reference: patientFullUrl },
      period: (periodStart || periodEnd)
        ? {
            start: periodStart,
            end: periodEnd
          }
        : undefined,
      identifier: [
        {
          system: session.system || INTERNAL_CANONICALS.namingSystems.sessionKey,
          value: session.encounterKey
        }
      ],
      serviceType: {
        text: session.serviceType || 'AI Companion pre-visit mental health screening'
      }
    };
  }

  function buildQuestionnaireResponseResource(input, patientFullUrl, encounterFullUrl, hamdProgress, formalAssessment, clinicianSummary, patientReviewPacket, fhirDeliveryDraft) {
    const items = collectQuestionnaireItems(input, hamdProgress, formalAssessment, clinicianSummary, patientReviewPacket, fhirDeliveryDraft);

    return {
      resourceType: 'QuestionnaireResponse',
      meta: { profile: [TW_CORE_PROFILES.questionnaireResponse] },
      extension: createReviewExtensions(input),
      questionnaire: INTERNAL_CANONICALS.questionnaires.previsitHamd17Draft,
      identifier: [
        {
          system: INTERNAL_CANONICALS.namingSystems.questionnaireResponse,
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

  // ── Observation valueString 對映表 ──────────────────────────────────────────────
  // 目的：把抽象的 'supported signal' 改為一句臨床可讀的描述
  var OBSERVATION_VALUE_STRINGS = {
    depressed_mood          : 'reports persistent low mood',
    guilt                   : 'reports feelings of guilt or self-blame',
    work_interest           : 'reports decline in work engagement and interest',
    retardation             : 'reports psychomotor slowing',
    agitation               : 'reports agitation or inner restlessness',
    somatic_anxiety         : 'reports somatic anxiety symptoms',
    insomnia                : 'reports sleep disruption or difficulty maintaining sleep',
    passive_disappearance_ideation : 'reports passive ideation (evidence-limited; no confirmed plan)',
    suicidal_ideation       : 'reports suicidal ideation (requires clinical verification)'
  };

  function buildObservationValueString(candidate) {
    // 如果是數字分數 (formal HAM-D item)，不用 valueString
    if (typeof candidate.score === 'number') return undefined;
    // 對映到已知維度
    var mapped = OBSERVATION_VALUE_STRINGS[candidate.focus];
    if (mapped) return mapped;
    // 其他維度：用 label 組合成可讀句
    var label = String(candidate.label || candidate.focus).toLowerCase();
    return candidate.supported
      ? 'reports ' + label
      : 'observed signal: ' + label;
  }
  // ─────────────────────────────────────────────────────────────────────────────

  function buildObservationResources(input, patientFullUrl, encounterFullUrl, questionnaireFullUrl, candidates) {
    return candidates.map(function (candidate, index) {
      const valueInteger = typeof candidate.score === 'number' ? candidate.score : undefined;
      return {
        fullUrl: createUrn('observation', input.session.encounterKey + ':' + candidate.focus + ':' + index),
        resource: {
          resourceType: 'Observation',
          meta: { profile: [TW_CORE_PROFILES.observationScreeningAssessment] },
          extension: createReviewExtensions(input),
          identifier: [
            {
              system: INTERNAL_CANONICALS.namingSystems.observation,
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
                system: INTERNAL_CANONICALS.codeSystems.signals,
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
          valueString: buildObservationValueString(candidate),
          valueInteger: valueInteger,
          note: (function () {
            // 只保留清洗後最多 2 筆最有代表性的 evidence
            var cleaned = cleanEvidence(candidate.evidence, 2);
            return cleaned.length
              ? cleaned.map(function (entry) { return { text: entry }; })
              : undefined;
          })()
        }
      };
    });
  }

  function buildCompositionResource(input, patientFullUrl, encounterFullUrl, questionnaireFullUrl, observationEntries, clinicianSummary, patientAnalysis, patientReviewPacket, fhirDeliveryDraft) {

    // ── 1. 各來源資料：去重 + 上限 ────────────────────────────────────────────
    var chiefConcerns       = dedupeStrings(clinicianSummary.chief_concerns, 4);
    var symptomObservations = dedupeStrings(clinicianSummary.symptom_observations, 4);
    var safetyFlags         = dedupeStrings(clinicianSummary.safety_flags, 3);
    var followupNeeds       = dedupeStrings(clinicianSummary.followup_needs, 3);
    var clinicalAlerts      = dedupeStrings(fhirDeliveryDraft.clinical_alerts, 3);
    var exportBlockers      = dedupeStrings(fhirDeliveryDraft.export_blockers, 3);
    var hamdEvidenceTable   = asArray(clinicianSummary.hamd_evidence_table);
    var hamdReviewRequired  = dedupeStrings(clinicianSummary.hamd_review_required_items, 3);
    var compositionSections = asArray(fhirDeliveryDraft.composition_sections);
    var patientKeyPoints    = dedupeStrings(patientAnalysis.key_points, 3);
    var patientConfirmItems = dedupeStrings(patientReviewPacket.confirm_items, 3);
    var patientEditableItems = dedupeStrings(patientReviewPacket.editable_items, 3);

    // ── 2. 高風險詞語保護（與 ClinicalImpression 同一套）───────────────────────
    var OVERREACH_PATTERNS = [
      /自我傷害行為/,
      /自傷行為表現/,
      /有自殺/,
      /已有計畫/
    ];
    var hasSafetyEvidence = safetyFlags.length > 0 || clinicalAlerts.length > 0;

    function isSafeToInclude(text) {
      if (!text) return false;
      var hasOverreach = OVERREACH_PATTERNS.some(function (p) { return p.test(String(text)); });
      return !(hasOverreach && !hasSafetyEvidence);
    }

    // ── 3. Safety section：加「疑似」前綴保護 ──────────────────────────────────
    var CONFIRMED_RISK_PATTERNS = [
      /^自傷/,
      /^自殺/,
      /^有自我傷害/
    ];
    function guardSafetyText(text) {
      var s = String(text);
      var isConfirmedRisk = CONFIRMED_RISK_PATTERNS.some(function (p) { return p.test(s); });
      if (isConfirmedRisk && !hasSafetyEvidence) {
        return '疑似' + s + '（尚待臨床確認）';
      }
      return s;
    }

    // ── 4. 組裝 sections ────────────────────────────────────────────────────────
    var sections = [];

    // 4a. Clinician Draft Summary（加過度推論保護）
    var rawDraftSummary = String(clinicianSummary.draft_summary || '').trim();
    if (rawDraftSummary && isSafeToInclude(rawDraftSummary)) {
      sections.push({
        code: { text: 'clinician-draft-summary' },
        title: 'Clinician Draft Summary',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>' + htmlEscape(rawDraftSummary) + '</p></div>'
        }
      });
    }

    // 4b. Chief Concerns（去重後最多 4 點）
    if (chiefConcerns.length) {
      sections.push({
        code: { text: 'chief-concerns' },
        title: 'Chief Concerns',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + chiefConcerns.map(function (item) {
            return '<li>' + htmlEscape(item) + '</li>';
          }).join('') + '</ul></div>'
        }
      });
    }

    // 4c. Symptom Observations（去重後最多 4 點；entry 只放非風險 Observation）
    if (symptomObservations.length) {
      var safeObservationEntries = observationEntries.filter(function (entry) {
        var code = entry.resource && entry.resource.code && entry.resource.code.text;
        var isRisk = /ideation|suicidal/i.test(String(code || ''));
        return !isRisk;
      });
      sections.push({
        code: { text: 'symptom-observations' },
        title: 'Symptom Observations',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + symptomObservations.map(function (item) {
            return '<li>' + htmlEscape(item) + '</li>';
          }).join('') + '</ul></div>'
        },
        entry: safeObservationEntries.map(function (entry) {
          return { reference: entry.fullUrl };
        })
      });
    }

    // 4d. Safety（加保守化前綴）
    if (safetyFlags.length) {
      sections.push({
        code: { text: 'safety-flags' },
        title: 'Safety',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + safetyFlags.map(function (item) {
            return '<li>' + htmlEscape(guardSafetyText(item)) + '</li>';
          }).join('') + '</ul></div>'
        }
      });
    }

    // 4e. Follow-up Needs
    if (followupNeeds.length) {
      sections.push({
        code: { text: 'followup-needs' },
        title: 'Follow-up Needs',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + followupNeeds.map(function (item) {
            return '<li>' + htmlEscape(item) + '</li>';
          }).join('') + '</ul></div>'
        }
      });
    }

    // 4f. HAM-D Evidence Table（保留，資訊密度高）
    if (hamdEvidenceTable.length) {
      sections.push({
        code: { text: 'hamd-evidence-table' },
        title: 'HAM-D Evidence Table',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><table><thead><tr><th>Item</th><th>Evidence Type</th><th>Evidence</th><th>Rationale</th></tr></thead><tbody>' + hamdEvidenceTable.map(function (row) {
            return '<tr><td>' + htmlEscape(row.item_label || '') + '</td><td>' + htmlEscape(row.evidence_type || '') + '</td><td>' + htmlEscape(asArray(row.evidence_summary).join(' | ')) + '</td><td>' + htmlEscape(row.rating_rationale || '') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        }
      });
    }

    // 4g. HAM-D Review Required
    if (hamdReviewRequired.length) {
      sections.push({
        code: { text: 'hamd-review-required' },
        title: 'HAM-D Review Required',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + hamdReviewRequired.map(function (item) {
            return '<li>' + htmlEscape(item) + '</li>';
          }).join('') + '</ul></div>'
        }
      });
    }

    // 4h. Clinical Alerts（有安全證據才加入，避免空洞警示）
    if (clinicalAlerts.length && hasSafetyEvidence) {
      sections.push({
        code: { text: 'clinical-alerts' },
        title: 'Clinical Alerts',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + clinicalAlerts.map(function (item) {
            return '<li>' + htmlEscape(item) + '</li>';
          }).join('') + '</ul></div>'
        }
      });
    }

    // 4i. Patient Analysis（保留）
    if (patientAnalysis.plain_summary || patientKeyPoints.length) {
      sections.push({
        code: { text: 'patient-analysis' },
        title: 'Patient Analysis',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>' + htmlEscape(patientAnalysis.plain_summary || '') + '</p>' +
            (patientKeyPoints.length
              ? '<ul>' + patientKeyPoints.map(function (item) { return '<li>' + htmlEscape(item) + '</li>'; }).join('') + '</ul>'
              : '') +
            '</div>'
        }
      });
    }

    // 4j. Patient Review Packet（保留）
    if (patientReviewPacket.patient_facing_summary || patientConfirmItems.length || patientEditableItems.length) {
      sections.push({
        code: { text: 'patient-review-packet' },
        title: 'Patient Review Packet',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml">' +
            (patientReviewPacket.patient_facing_summary ? '<p>' + htmlEscape(patientReviewPacket.patient_facing_summary) + '</p>' : '') +
            (patientConfirmItems.length ? '<p><b>Confirm items</b></p><ul>' + patientConfirmItems.map(function (item) { return '<li>' + htmlEscape(item) + '</li>'; }).join('') + '</ul>' : '') +
            (patientEditableItems.length ? '<p><b>Editable items</b></p><ul>' + patientEditableItems.map(function (item) { return '<li>' + htmlEscape(item) + '</li>'; }).join('') + '</ul>' : '') +
            '</div>'
        }
      });
    }

    // 4k. Export Blockers（去重收斂，最多 3 筆）
    if (exportBlockers.length) {
      sections.push({
        code: { text: 'export-blockers' },
        title: 'Export Blockers',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + exportBlockers.map(function (item) {
            return '<li>' + htmlEscape(item) + '</li>';
          }).join('') + '</ul></div>'
        }
      });
    }

    // 4l. FHIR Delivery Draft Sections（保留）
    if (compositionSections.length) {
      sections.push({
        code: { text: 'delivery-draft-sections' },
        title: 'FHIR Delivery Draft Sections',
        text: {
          status: 'generated',
          div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul>' + compositionSections.map(function (item) {
            return '<li><b>' + htmlEscape(item.focus || 'section') + ':</b> ' + htmlEscape(item.section || '') + '</li>';
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
          system: INTERNAL_CANONICALS.namingSystems.composition,
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


  function buildClinicalImpressionResource(input, patientFullUrl, encounterFullUrl, questionnaireFullUrl, observationEntries, clinicianSummary, hamdProgress, redFlag, fhirDeliveryDraft) {

    // ── 1. 準備各來源資料（去重 + 上限）
    var chiefConcerns       = dedupeStrings(clinicianSummary.chief_concerns, 3);
    var symptomObservations = dedupeStrings(clinicianSummary.symptom_observations, 3);
    var safetySignals       = dedupeStrings(
      asArray(redFlag.signals).concat(asArray(clinicianSummary.safety_flags)), 3
    );
    var coveredDimensions   = dedupeStrings(hamdProgress.covered_dimensions, 4);

    // ── 2. description：保守版，防止過度推論
    // 高風險詞語：若沒有 safety signal 支撐，不直接寫入
    var OVERREACH_PATTERNS = [
      /自我傷害行為/,
      /自傷行為表現/,
      /有自殺/,
      /已有計畫/
    ];
    var hasSafetyEvidence = safetySignals.length > 0;
    var rawSummary = String(clinicianSummary.draft_summary || '').trim();
    var description;
    var hasOverreach = OVERREACH_PATTERNS.some(function (p) { return p.test(rawSummary); });
    if (rawSummary && !(hasOverreach && !hasSafetyEvidence)) {
      description = rawSummary;
    } else if (chiefConcerns.length) {
      description = 'Patient reports: ' + chiefConcerns.join('; ') + '.';
    } else if (symptomObservations.length) {
      description = 'Observed: ' + symptomObservations.join('; ') + '.';
    } else {
      description = 'AI companion derived pre-visit clinical impression draft.';
    }

    // ── 3. finding：各自綁定對應來源的 basis，上限 5 筆
    var findings = [];

    // 3a. 症狀觀察 findings
    symptomObservations.forEach(function (obs) {
      findings.push({
        itemCodeableConcept: { text: obs },
        basis: chiefConcerns.length ? chiefConcerns.join('；') : obs
      });
    });

    // 3b. HAM-D 維度 findings
    coveredDimensions.forEach(function (dimension) {
      findings.push({
        itemCodeableConcept: { text: 'HAM-D dimension: ' + (DIMENSION_LABELS[dimension] || dimension) },
        basis: symptomObservations[0] || dimension
      });
    });

    // 3c. 安全訊號 findings（加 evidence-limited 標記，不直接斷言）
    safetySignals.forEach(function (signal) {
      findings.push({
        itemCodeableConcept: { text: signal + ' (evidence-limited)' },
        basis: asArray(redFlag.signals).join('；') || signal
      });
    });

    // finding 去重 + 上限 5 筆
    var finalFindings = [];
    var seenKeys = [];
    findings.forEach(function (f) {
      var key = f.itemCodeableConcept.text;
      if (seenKeys.indexOf(key) !== -1) return;
      if (finalFindings.length >= 5) return;
      seenKeys.push(key);
      finalFindings.push(f);
    });

    // ── 4. supportingInfo refs（上限 4 筆 Observation）
    var supportingRefs = [];
    if (questionnaireFullUrl) supportingRefs.push({ reference: questionnaireFullUrl });
    observationEntries.slice(0, 4).forEach(function (entry) {
      supportingRefs.push({ reference: entry.fullUrl });
    });

    // ── 5. note：加上風險等級明確標記
    var notes = [];
    if (safetySignals.length > 0) {
      notes.push({ text: 'Risk signals noted (evidence-limited). Clinical verification required before escalation.' });
      safetySignals.forEach(function (s) { notes.push({ text: s }); });
    } else {
      notes.push({ text: 'No immediate risk signals identified in this session.' });
    }

    return {
      resourceType: 'ClinicalImpression',
      meta: { profile: [CLINICAL_IMPRESSION_PROFILE] },
      identifier: [
        {
          system: INTERNAL_CANONICALS.namingSystems.clinicalImpression,
          value: input.session.encounterKey
        }
      ],
      status: 'preliminary',
      code: {
        text: 'AI Companion risk and context impression'
      },
      subject: { reference: patientFullUrl },
      encounter: { reference: encounterFullUrl },
      effectiveDateTime: input.session.endedAt || input.session.startedAt || new Date().toISOString(),
      date: input.session.endedAt || input.session.startedAt || new Date().toISOString(),
      assessor: input.author ? { display: input.author } : undefined,
      description: description,
      finding: finalFindings,
      supportingInfo: supportingRefs.length ? supportingRefs : undefined,
      note: notes,
      protocol: questionnaireFullUrl ? [questionnaireFullUrl] : undefined
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

  function buildDocumentReferenceResource(input, patientFullUrl, encounterFullUrl, compositionFullUrl, clinicianSummary, patientAnalysis, patientReviewPacket, fhirDeliveryDraft, formalAssessment) {

    // ── 1. 閱讀版 payload（只含高品質臨床欄位，給醫師看）─────────────────────
    var readablePayload = {
      chief_concerns:       dedupeStrings(clinicianSummary.chief_concerns, 4),
      symptom_observations: dedupeStrings(clinicianSummary.symptom_observations, 4),
      safety_flags:         dedupeStrings(clinicianSummary.safety_flags, 3),
      followup_needs:       dedupeStrings(clinicianSummary.followup_needs, 3),
      hamd_signals:         dedupeStrings(clinicianSummary.hamd_signals || asArray(clinicianSummary.hamd_evidence_table).map(function (r) { return r.signal || r.item || ''; }), 6)
    };

    // ── 2. 全量追蹤 payload（internal trace，不是對外閱讀版）──────────────────
    var internalTracePayload = {
      _note: 'Internal trace payload — not intended for clinical reading',
      clinician_summary_draft: clinicianSummary,
      patient_analysis:        patientAnalysis,
      patient_review_packet:   patientReviewPacket,
      fhir_delivery_draft:     fhirDeliveryDraft,
      hamd_formal_assessment:  formalAssessment,
      active_mode:             input.active_mode,
      risk_flag:               input.risk_flag,
      latest_tag_payload:      input.latest_tag_payload,
      burden_level_state:      input.burden_level_state
    };

    // ── 3. 組裝 relatesTo（關聯 Composition）────────────────────────────────────
    var relatesTo = compositionFullUrl
      ? [{ code: 'transforms', targetReference: { reference: compositionFullUrl } }]
      : undefined;

    return {
      resourceType: 'DocumentReference',
      meta: { profile: [TW_CORE_PROFILES.documentReference] },
      status: 'current',
      docStatus: 'preliminary',
      subject: { reference: patientFullUrl },
      context: {
        encounter: [{ reference: encounterFullUrl }]
      },
      type: {
        text: 'AI Companion clinician summary document'
      },
      date: input.session.endedAt || input.session.startedAt || new Date().toISOString(),
      author: input.author ? [{ display: input.author }] : undefined,
      description: 'Clinician-facing AI Companion pre-visit summary draft',
      relatesTo: relatesTo,
      content: [
        {
          attachment: {
            contentType: 'application/json',
            title: 'AI Companion clinician summary draft (readable)',
            data: Buffer.from(JSON.stringify(readablePayload, null, 2), 'utf8').toString('base64')
          }
        },
        {
          attachment: {
            contentType: 'application/json',
            title: 'AI Companion full internal trace payload',
            data: Buffer.from(JSON.stringify(internalTracePayload, null, 2), 'utf8').toString('base64')
          }
        }
      ]
    };
  }


  function buildProvenanceResource(input, patientFullUrl, encounterFullUrl, targetRefs) {
    const shareWithClinician = normalizeShareWithClinician(
      input.patient_authorization_state.share_with_clinician,
      input.patient_authorization_state.authorization_status
    );
    return {
      resourceType: 'Provenance',
      meta: { profile: [TW_CORE_PROFILES.provenance] },
      recorded: input.session.endedAt || input.session.startedAt || new Date().toISOString(),
      target: targetRefs.map(function (reference) {
        return { reference: reference };
      }),
      agent: [
        {
          type: {
            text: 'author'
          },
          who: {
            display: input.author || 'AI Companion'
          }
        }
      ],
      entity: [
        {
          role: 'source',
          what: {
            display: shareWithClinician === 'yes'
              ? 'AI draft with patient share allowed'
              : 'AI draft pending patient sharing permission'
          }
        },
        {
          role: 'derivation',
          what: {
            display: input.patient_authorization_state.authorization_status || 'review_required'
          }
        }
      ],
      reason: [
        {
          text: 'AI companion pre-visit summary generation and patient review tracking'
        }
      ],
      location: {
        display: encounterFullUrl
      },
      patient: {
        reference: patientFullUrl
      }
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

    ['Patient', 'Encounter', 'QuestionnaireResponse', 'ClinicalImpression', 'Composition', 'DocumentReference', 'Provenance'].forEach(function (resourceType) {
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
      patient_analysis: toObject(rawInput && rawInput.patient_analysis, 'patient_analysis', validationErrors),
      patient_review_packet: toObject(rawInput && rawInput.patient_review_packet, 'patient_review_packet', validationErrors),
      fhir_delivery_draft: toObject(rawInput && rawInput.fhir_delivery_draft, 'fhir_delivery_draft', validationErrors),
      hamd_progress_state: toObject(rawInput && rawInput.hamd_progress_state, 'hamd_progress_state', validationErrors),
      hamd_formal_assessment: toObject(rawInput && rawInput.hamd_formal_assessment, 'hamd_formal_assessment', validationErrors),
      red_flag_payload: toObject(rawInput && rawInput.red_flag_payload, 'red_flag_payload', validationErrors),
      patient_authorization_state: toObject(rawInput && rawInput.patient_authorization_state, 'patient_authorization_state', validationErrors),
      delivery_readiness_state: toObject(rawInput && rawInput.delivery_readiness_state, 'delivery_readiness_state', validationErrors),
      active_mode: rawInput && rawInput.active_mode ? rawInput.active_mode : '',
      risk_flag: rawInput && rawInput.risk_flag ? rawInput.risk_flag : '',
      latest_tag_payload: toObject(rawInput && rawInput.latest_tag_payload, 'latest_tag_payload', validationErrors),
      burden_level_state: toObject(rawInput && rawInput.burden_level_state, 'burden_level_state', validationErrors)
    };

    addValidationErrorIfMissing(input.patient.key, 'patient.key', validationErrors);
    addValidationErrorIfMissing(input.session.encounterKey, 'session.encounterKey', validationErrors);

    if (!Object.keys(input.clinician_summary_draft).length) {
      blockingReasons.push('clinician_summary_draft is missing.');
    }

    if (!Object.keys(input.hamd_progress_state).length) {
      blockingReasons.push('hamd_progress_state is missing.');
    }

    const normalizedShareWithClinician = normalizeShareWithClinician(
      input.patient_authorization_state.share_with_clinician,
      input.patient_authorization_state.authorization_status
    );
    input.patient_authorization_state.share_with_clinician = normalizedShareWithClinician;
    const normalizedReadinessStatus = normalizeReadinessStatus(
      input.delivery_readiness_state.readiness_status,
      normalizedShareWithClinician === 'yes'
    );
    input.delivery_readiness_state.readiness_status = normalizedReadinessStatus;

    if (normalizedShareWithClinician !== 'yes') {
      blockingReasons.push('patient_authorization_state does not allow clinician sharing.');
    }

    if (normalizedReadinessStatus !== 'ready_for_backend_mapping') {
      blockingReasons.push('delivery_readiness_state is not ready_for_backend_mapping, so the builder will not emit a delivery bundle.');
    }

    if (validationErrors.length || blockingReasons.length) {
      return {
        bundle_json: null,
        resource_index: {},
        validation_errors: validationErrors,
        blocking_reasons: blockingReasons,
        validation_report: null
      };
    }

    const patientFullUrl = createUrn('patient', input.patient.key);
    const encounterFullUrl = createUrn('encounter', input.session.encounterKey);
    const questionnaireFullUrl = createUrn('questionnaire-response', input.session.encounterKey);
    const compositionFullUrl = createUrn('composition', input.session.encounterKey);
    const clinicalImpressionFullUrl = createUrn('clinical-impression', input.session.encounterKey);
    const documentReferenceFullUrl = createUrn('document-reference', input.session.encounterKey);
    const provenanceFullUrl = createUrn('provenance', input.session.encounterKey);

    const observationEntries = buildObservationResources(
      input,
      patientFullUrl,
      encounterFullUrl,
      questionnaireFullUrl,
      gatherObservationCandidates(
        input.clinician_summary_draft,
        input.hamd_progress_state,
        input.red_flag_payload
      ).concat(gatherFormalObservationCandidates(input.hamd_formal_assessment))
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
        input.hamd_progress_state,
        input.hamd_formal_assessment,
        input.clinician_summary_draft,
        input.patient_review_packet,
        input.fhir_delivery_draft
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
        input.clinician_summary_draft,
        input.patient_analysis,
        input.patient_review_packet,
        input.fhir_delivery_draft
      )
    };

    const clinicalImpressionEntry = {
      fullUrl: clinicalImpressionFullUrl,
      resource: buildClinicalImpressionResource(
        input,
        patientFullUrl,
        encounterFullUrl,
        questionnaireFullUrl,
        observationEntries,
        input.clinician_summary_draft,
        input.hamd_progress_state,
        input.red_flag_payload,
        input.fhir_delivery_draft
      )
    };

    const documentReferenceEntry = {
      fullUrl: documentReferenceFullUrl,
      resource: buildDocumentReferenceResource(
        input,
        patientFullUrl,
        encounterFullUrl,
        compositionFullUrl,
        input.clinician_summary_draft,
        input.patient_analysis,
        input.patient_review_packet,
        input.fhir_delivery_draft,
        input.hamd_formal_assessment
      )
    };

    const provenanceEntry = {
      fullUrl: provenanceFullUrl,
      resource: buildProvenanceResource(
        input,
        patientFullUrl,
        encounterFullUrl,
        [
          questionnaireFullUrl,
          clinicalImpressionFullUrl,
          compositionFullUrl,
          documentReferenceFullUrl
        ].concat(observationEntries.map(function (entry) {
          return entry.fullUrl;
        }))
      )
    };

    const entries = [patientEntry, encounterEntry, questionnaireEntry]
      .concat(observationEntries)
      .concat([clinicalImpressionEntry, compositionEntry, documentReferenceEntry, provenanceEntry]);

    const bundle = buildBundle(entries);
    basicValidation(bundle, input, validationErrors);
    const validationReport = validatorModule && typeof validatorModule.validateBundle === 'function'
      ? validatorModule.validateBundle(bundle)
      : null;

    if (validationReport && !validationReport.valid) {
      validationErrors.push('FHIR/TW Core validation report contains errors.');
    }

    return {
      bundle_json: bundle,
      resource_index: buildResourceIndex(entries),
      validation_errors: validationErrors,
      blocking_reasons: blockingReasons,
      validation_report: validationReport
    };
  }

  return {
    TW_CORE_PROFILES: TW_CORE_PROFILES,
    INTERNAL_CANONICALS: INTERNAL_CANONICALS,
    buildSessionExportBundle: buildSessionExportBundle,
    buildPatientResourceOnly: buildPatientResourceOnly
  };
});
