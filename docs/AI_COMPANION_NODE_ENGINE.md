# AI Companion Node Engine

## Summary
- 主聊天流程不再依賴 Dify 或 Flowise。
- 現在由 Node server 直接管理：
  - session state
  - command routing
  - risk / safety
  - follow-up
  - six modes
  - Mission / Option RAG
  - summary / patient / FHIR draft chain
- 一般聊天走輕量記憶路徑，不再每輪自動跑完整 clinician / patient / FHIR 長鏈。
- 重型輸出改成按需生成，支援前端按鈕與聊天指令兩種觸發。

## Plain-Language Flow
- 使用者輸入後，系統先依序判斷：
  - 是不是模式指令
  - 是不是高風險內容
  - 是不是輸出指令
  - 如果都不是，才走一般聊天模式
- 一般聊天只更新少量重要記憶，不會每輪自動做完整摘要鏈。
- 醫師摘要、病人審閱稿、FHIR draft 改成按需生成。
- 白話版完整說明見：
  - [AI_COMPANION_FLOW_PLAIN_LANGUAGE.md](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/docs/AI_COMPANION_FLOW_PLAIN_LANGUAGE.md)
- 其中已補充：
  - `Auto` 分流機制
  - 互動負擔如何影響 `Option / Soulmate / 其他模式`
  - 六個模式實際偏向條件
- 手動測試清單見：
  - [AI_COMPANION_TEST_CHECKLIST.md](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/docs/AI_COMPANION_TEST_CHECKLIST.md)

## Runtime
- 主 server: [app/fhirDeliveryServer.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirDeliveryServer.js)
- 主引擎: [app/aiCompanionEngine.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/aiCompanionEngine.js)
- 模型 client: [app/llmChatClient.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/llmChatClient.js)

## State Schema
- 來源: [FLOWISE_STATE_SCHEMA.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/flowise/FLOWISE_STATE_SCHEMA.json)
- 引擎完整維護以下欄位：
  - `pending_question`
  - `risk_flag`
  - `red_flag_payload`
  - `followup_turn_count`
  - `followup_status`
  - `active_mode`
  - `latest_tag_payload`
  - `hamd_progress_state`
  - `summary_draft_state`
  - `clinician_summary_draft`
  - `routing_mode_override`
  - `command_feedback`
  - `patient_review_packet`
  - `fhir_delivery_draft`
  - `mission_retrieval_audit`
  - `option_retrieval_audit`
  - `burden_level_state`
  - `patient_authorization_state`
  - `delivery_readiness_state`

## Routing
- Command:
  - `auto`
  - `void`
  - `soulmate`
  - `mission`
  - `option`
  - `natural`
  - `clarify`
- Risk:
  - keyword / phrase based high-risk detection
- Follow-up:
  - 使用 `pending_question` + `followup_turn_count`
- Normal modes:
  - `mode_1_void`
  - `mode_2_soulmate`
  - `mode_3_mission`
  - `mode_4_option`
  - `mode_5_natural`
  - `mode_6_clarify`

## RAG
- PDF source: [CompanionAI_RAG資料.pdf](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Companion_RAG/CompanionAI_RAG%E8%B3%87%E6%96%99.pdf)
- Extracted text: [CompanionAI_RAG資料.txt](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/rag/CompanionAI_RAG%E8%B3%87%E6%96%99.txt)
- Extraction script: [extract_rag_pdf.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/tools/extract_rag_pdf.js)

## API
- `POST /api/chat/message`
  - input:
    - `message`
    - `conversation_id`
    - `user`
    - `api_provider`
    - `api_key`
    - `api_base_url`
    - `api_model`
  - output:
    - `conversation_id`
    - `answer`
    - `metadata`
    - `session_export`
- `POST /api/chat/output`
  - input:
    - `conversation_id`
    - `user`
    - `output_type`
    - `instruction`
    - `api_provider`
    - `api_key`
    - `api_base_url`
    - `api_model`
  - output:
    - `conversation_id`
    - `output_type`
    - `output`
    - `formatted_text`
    - `metadata`
    - `session_export`
- `POST /api/fhir/bundle`

## FHIR Integration
- 引擎輸出的 `session_export` 維持和 [sampleSessionExport.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/sampleSessionExport.json) 相容。
- [fhirBundleBuilder.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirBundleBuilder.js) 不需要知道 Dify/Flowise 是否存在。

## Environment Variables
- `LLM_PROVIDER`
- `GOOGLE_API_KEY`
- `GOOGLE_API_BASE_URL`
- `GROQ_API_KEY`
- `GROQ_API_BASE_URL`
- `LLM_MODEL`
- `FHIR_SERVER_URL`

## Tests
- [fhirDeliveryServer.test.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirDeliveryServer.test.js)
- [fhirBundleBuilder.test.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirBundleBuilder.test.js)
- [aiCompanionEngine.test.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/aiCompanionEngine.test.js)
- [aiCompanionOutput.test.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/aiCompanionOutput.test.js)
