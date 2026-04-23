# FHIR Delivery Builder

- Dify id: `fhir-delivery-builder`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要把目前的 clinician_summary_draft、patient_review_packet、patient_authorization_state、red_flag_payload、hamd_progress_state、hamd_formal_assessment、phq9_assessment 整理成「FHIR / TW Core 映射草稿」。
這不是最終 server payload，而是交付前的結構化 draft。
請盡量保留較早對話裡的重要症狀、功能受損、就醫目標與時間脈絡，不要因模式切換或快捷操作而改寫重點。
請輸出固定 JSON：
{
  "draft_version":"p3_fhir_delivery_v1",
  "delivery_status":"pre_review_or_ready_for_mapping_orblocked",
  "consent_gate":"review_required_or_ready_for_consent_orblocked",
  "resources":[
    {"resource_type":"Patient","status":"preliminary","purpose":"subject_identity"},
    {"resource_type":"Encounter","status":"preliminary","purpose":"session_context"},
    {"resource_type":"QuestionnaireResponse","status":"preliminary","purpose":"dialogue_to_scale_mapping"},
    {"resource_type":"Observation","status":"preliminary","purpose":"symptom_tracking"},
    {"resource_type":"ClinicalImpression","status":"preliminary","purpose":"risk_and_context"},
    {"resource_type":"Composition","status":"preliminary","purpose":"clinical_summary"},
    {"resource_type":"DocumentReference","status":"preliminary","purpose":"summary_export"},
    {"resource_type":"Provenance","status":"preliminary","purpose":"generation_traceability"}
  ],
  "composition_sections":[{"section":"...","focus":"..."}],
  "observation_candidates":[{"focus":"...","category":"...","status":"preliminary","evidence_refs":["..."],"inference_basis":"..."}],
  "symptom_evidence_track":[{"evidence_id":"...","speaker":"...","source_text":"...","symptom_candidate":"...","category":"...","confidence":"..."}],
  "symptom_inference_track":[{"symptom_label":"...","summary":"...","category":"...","hamd_signal":"...","severity_hint":"...","functional_impact":"...","timeframe":"...","evidence_refs":["..."],"confidence":"..."}],
  "clinical_alerts":["..."],
  "questionnaire_targets":["..."],
  "phq9_assessment":"...",
  "phq9_total_score":0,
  "phq9_severity_band":"...",
  "phq9_summary":"...",
  "phq9_questionnaire_targets":[{"item_code":"...","item_label":"...","score":0,"narrative":"...","status":"preliminary"}],
  "hamd_formal_targets":[{"item_code":"...","evidence_type":"...","status":"preliminary"}],
  "patient_review_required":"yes_or_no",
  "export_blockers":["..."],
  "notes":"..."
}
規則：
1. resources 只能列出目前實際會被 bundle builder 輸出的資源，全部先固定用 preliminary。
2. composition_sections 整理會放進摘要文件的段落。
3. observation_candidates 整理情緒、行為、認知、睡眠、焦慮等可映射 Observation 的重點。
4. clinical_alerts 整理風險與需要醫師注意的事項。
5. questionnaire_targets 整理目前可映射到量表或 HAM-D 線索的面向。
6. hamd_formal_targets 整理正式題項級 HAM-D 草稿，並保留 evidence_type。
6. 若病人審閱或授權尚未完成，不可把 delivery_status 寫成 ready_for_mapping。
7. export_blockers 要明確指出授權、內容修正、欄位不足等阻塞因素。
8. notes 說明這仍是交付前 draft，不是最終正式醫療文件。
9. composition_sections、observation_candidates 與 questionnaire_targets 應根據整段對話整合，不要只反映最後一句。
10. 請避免把逐字原句整段貼入；優先轉成可交付、可讀的整理句。
11. observation_candidates 要盡量保留 evidence_refs 與 inference_basis，讓後續 FHIR 映射可追溯。
12. 不可把操作指令、快捷鍵、模式切換、FHIR 輸出控制語句當成症狀內容。
13. phq9_assessment 與 phq9_questionnaire_targets 代表病人自評資料，若沒有聊天內容也要把它納入 QuestionnaireResponse 與交付草稿。
clinician_summary_draft：{{#conversation.clinician_summary_draft#}}
patient_review_packet：{{#conversation.patient_review_packet#}}
patient_authorization_state：{{#conversation.patient_authorization_state#}}
red_flag_payload：{{#conversation.red_flag_payload#}}
hamd_progress_state：{{#conversation.hamd_progress_state#}}
hamd_formal_assessment：{{#conversation.hamd_formal_assessment#}}
phq9_assessment：{{#conversation.phq9_assessment#}}
symptom_bridge_state：{{#conversation.symptom_bridge_state#}}
recent_chat_history：{{#retrieval.recent_chat_history_text#}}
longitudinal_dialogue：{{#retrieval.longitudinal_dialogue#}}
只輸出 JSON，不要加解釋。
