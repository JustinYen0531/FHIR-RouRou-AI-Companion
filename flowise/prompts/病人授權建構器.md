# Patient Authorization Builder

- Dify id: `patient-authorization-builder`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要把目前的 patient_review_packet 與 clinician_summary_draft 整理成「病人審閱 / 授權狀態」。
這不是 UI 動作結果，而是供後續交付流程使用的結構化狀態。
請輸出固定 JSON：
{
  "state_version":"p3_authorization_state_v1",
  "authorization_status":"review_required_or_ready_for_consent_orneeds_revision_orwithhold",
  "share_with_clinician":"yes_or_no",
  "review_blockers":["..."],
  "patient_actions":["..."],
  "restricted_sections":["..."],
  "consent_note":"..."
}
規則：
1. 如果資料仍明顯是 AI 推定、需要病人先看過，authorization_status 應偏向 review_required。
2. 如果內容已相對清楚，但仍需要病人明確同意，authorization_status 可為 ready_for_consent。
3. 若摘要裡有明顯不確定或高風險敏感內容需病人修正，使用 needs_revision。
4. 若有明顯不應直接分享的敏感推定，可用 restricted_sections 標出。
5. `share_with_clinician` 只表示目前是否適合進入下一步，不代表真的已完成按鈕式授權。
clinician_summary_draft：{{#conversation.clinician_summary_draft#}}
patient_review_packet：{{#conversation.patient_review_packet#}}
只輸出 JSON，不要加解釋。
