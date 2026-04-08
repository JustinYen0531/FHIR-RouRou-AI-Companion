# AI 提示資產全量重建實作文檔

## 1. 目標
- 來源流程：[AI_Chat_Companion_New_Skeleton (4).yml](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Chat_Companion_New_Skeleton%20(4).yml)
- 目標平台：chatflow runtime + 現有前端 + 現有 FHIR API
- 目標效果：保留 Dify 版本的命令切換、風險分流、follow-up、六條模式、Mission/Option 檢索、summary/FHIR 長鏈

## 2. Repo 內交付內容
- AI 狀態結構：[AI_STATE_SCHEMA.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/ai_assets/AI_STATE_SCHEMA.json)
- Dify 節點映射：[DIFY_NODE_MAP.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/ai_assets/DIFY_NODE_MAP.json)
- chatflow 藍圖：[AI_Companion_Chatflow_Blueprint.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/ai_assets/flows/AI_Companion_Chatflow_Blueprint.json)
- 節點 prompt 資產：[prompts](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/ai_assets/prompts)
- Dify 抽取來源：[source](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/ai_assets/source)
- chatflow 環境變數範本：[chatflow.env.example](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/ai_assets/chatflow.env.example)
- RAG 說明：[rag/RAG說明.md](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/ai_assets/rag/RAG說明.md)

## 3. 架構
### 3.1 執行路徑
- 前端：[app/app.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/app.js)
- Node proxy：[app/fhirDeliveryServer.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirDeliveryServer.js)
- chatflow client：[app/chatflowRuntimeClient.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/chatflowRuntimeClient.js)
- FHIR builder：[app/fhirBundleBuilder.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirBundleBuilder.js)

執行模式：
1. 前端只呼叫 `/api/chat/message`
2. Node proxy 轉發到 chatflow Prediction API
3. Node proxy 保持 `/api/fhir/bundle`
4. 前端不直接暴露 chatflow API key

### 3.2 chatflow 狀態
- chatflow 的 `sessionId` 由 Node proxy 傳入，對應現有 `conversation_id/user`
- 目前 Dify conversation variables 已整理成 JSON schema
- 這些變數仍由聊天流程負責讀寫：
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

## 4. Dify 節點到 chatflow 映射
### 4.1 路由 / 判斷
- `question-classifier` -> `Custom JS Function + If Else + Set Variable`
- `if-else` -> `If Else`
- `assigner` -> `Set Variable`

### 4.2 生成
- `llm` -> `LLM / Prompt Chain`
- `answer` -> `Final output node`

### 4.3 檢索
- `knowledge-retrieval` -> `Document Store + Retriever + QA Chain`
- Mission / Option 共用同一份來源 PDF，但在 chatflow 內要拆成不同 retriever flow 或不同 prompt 鏈

## 5. RAG 資料來源
- 現有來源檔案：[AI_Companion_RAG/CompanionAI_RAG資料.pdf](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Companion_RAG/CompanionAI_RAG%E8%B3%87%E6%96%99.pdf)
- chatflow 版規劃：
  - Mission 與 Option 使用同一份原始資料
  - 匯入 chatflow Document Store
  - 使用本地向量庫持久化
  - 由不同的 audit / answer prompt 控制知識使用方式

## 6. API 介面
### 6.1 Node -> chatflow
- Endpoint: `POST {CHATFLOW_API_BASE_URL}/api/v1/prediction/{CHATFLOW_ID}`
- Request body:
  - `question`
  - `streaming`
  - `overrideConfig.sessionId`
  - `overrideConfig.vars`
- Header:
  - `Authorization: Bearer {CHATFLOW_API_KEY}`，若執行平台未啟用 flow auth 可省略

### 6.2 前端 -> Node
- `POST /api/chat/message`
  - `message`
  - `conversation_id`
  - `user`
  - `api_base_url`
  - `api_key`
  - `chatflow_id`
- `POST /api/fhir/bundle`

## 7. 實作與生成流程
1. 來源 Dify YAML 先抽成 JSON source
2. 用 [tools/build_ai_assets.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/tools/build_ai_assets.js) 生成：
   - node map
   - state schema
   - prompts
   - flow blueprint
3. 設定 chatflow base URL / chatflow id / key
4. 啟動 [app/fhirDeliveryServer.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirDeliveryServer.js)
5. 用 [app/index.html](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/index.html) 測試聊天與 FHIR 流程

## 8. 驗收
- `node app/fhirDeliveryServer.test.js`
- `node app/fhirBundleBuilder.test.js`
- 前端模式切換可送出到 Node proxy
- chatflow health config 在 `/health` 可看到對應設定狀態
- `你好` 可回覆
- `我想死` 能進安全回應
- Mission / Option RAG 可命中 PDF 內容
- summary / patient / authorization / FHIR draft 狀態能被後續流程消費

## 9. 已知限制
- chatflow 平台 export/import JSON 會隨版本差異而變動；repo 目前保存的是可重建藍圖與完整 prompt/state 資產，而不是鎖死某一版 UI export。
- Dify 的 assigner 與 question-classifier 是平台專有 UI 概念；chatflow 版本會改成 JS function、變數節點與 prompt chain 組合。
- 若要做到完全圖形化 1:1 視覺流程，需要依實際平台版本在 UI 內完成最後的節點拼裝。

## 10. 後續擴充
- 把 chatflow worker flow 和 RAG flow 各自固定成一組正式 chatflow id
- 為 Mission / Option 建立獨立的 document ingestion script
- 讓 summary / FHIR draft 直接輸出到現有 sample session export 格式


