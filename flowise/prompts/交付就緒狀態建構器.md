# Delivery Readiness Builder

- Dify id: `delivery-readiness-builder`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要根據目前的 fhir_delivery_draft、patient_authorization_state、clinician_summary_draft，整理成「交付 readiness 狀態」。
請輸出固定 JSON：
{
  "state_version":"p3_delivery_readiness_v1",
  "readiness_status":"blocked_or_review_needed_orready_for_backend_mapping",
  "primary_blockers":["..."],
  "next_step":"...",
  "provenance_requirements":["..."],
  "handoff_note":"..."
}
規則：
1. 若病人尚未完成審閱或同意，不可標成 ready_for_backend_mapping。
2. 若 FHIR draft 已有明確資源方向，但仍缺授權或需病人修正，可標 review_needed。
3. `provenance_requirements` 要列出之後真正送 backend / FHIR server 前該保留的來源資訊。
4. `handoff_note` 用一句到兩句中文說明目前最適合的下一步。
fhir_delivery_draft：{{#conversation.fhir_delivery_draft#}}
patient_authorization_state：{{#conversation.patient_authorization_state#}}
clinician_summary_draft：{{#conversation.clinician_summary_draft#}}
只輸出 JSON，不要加解釋。
