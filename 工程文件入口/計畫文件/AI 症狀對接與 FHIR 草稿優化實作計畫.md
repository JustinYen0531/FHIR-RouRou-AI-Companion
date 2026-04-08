# AI 症狀對接與 FHIR 草稿優化實作計畫

## 摘要
將目前偏規則式的症狀整理流程改為「AI 語意抽取為主、規則保底為輔」的雙層架構，讓 FHIR 草稿中的症狀欄位不再混入操作指令，並新增「證據軌」與「推論軌」並行的輸出方式。  
審核通過後，計畫文件預設存放於 `工程文件入口/計畫文件`，檔名採中文主題式。

## 主要實作變更
1. 重構症狀來源資料流
- 在 [app/aiCompanionEngine.js](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\app\aiCompanionEngine.js) 中，將 `buildLongitudinalEvidence()` 從目前的規則摘要主導，改為「先過濾非臨床訊息，再交給 AI 做症狀對接整理」。
- 強化歷史訊息過濾，排除輸出指令、快捷操作、模式切換、`請幫我生成FHIR草稿` 這類非症狀內容，避免它們進入 longitudinal evidence。
- 保留現有 `CLINICAL_SIGNAL_RULES` 作為 fallback 或補強，不再直接作為主要症狀欄位來源。

2. 新增 AI 雙軌症狀結構
- 新增一個結構化 AI 任務，輸出固定 JSON，至少包含：
  - `evidence_track`: 原句證據、說話者、來源片段、對應症狀候選、信心
  - `inference_track`: AI 整理後的真實症狀、嚴重度/傾向、功能影響、時間脈絡、對應證據索引
  - `excluded_messages`: 被排除的操作句或控制訊號
- clinician summary 與 FHIR draft 都改用這個雙軌結果作為症狀主來源。
- `symptom_observations` 改為以推論軌的臨床可讀句為主，不再直接沿用原句或規則摘要句。
- `observation_candidates` 則同時保留推論結果與 evidence linkage，讓後續 FHIR 映射可追溯。

3. 調整 prompt 與輸出契約
- 更新 [flowise/prompts/醫師摘要建構器.md](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\flowise\prompts\醫師摘要建構器.md) 與 [flowise/prompts/FHIR交付建構器.md](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\flowise\prompts\FHIR交付建構器.md)。
- 明確要求模型：
  - 先判別是否為臨床相關訊息
  - 不可將輸出指令、快捷鍵、模式名稱、系統操作語句視為症狀
  - 每個推論症狀都要能回扣到至少一則 evidence
  - 症狀描述以歸納句呈現，不得整段照抄逐字稿
- 若模型輸出不完整，程式端回退到安全 fallback，但 fallback 也必須先經過非臨床訊息過濾。

4. 更新 FHIR 草稿顯示與映射邏輯
- `fhir_delivery_draft` 的 `composition_sections`、`observation_candidates`、`questionnaire_targets` 改為依雙軌症狀結果建構。
- 前端顯示的「症狀整理」預設展示推論軌摘要；需要時可附帶 evidence 摘要，避免直接裸露操作句或污染內容。
- 保留目前 FHIR bundle builder 的格式化與驗證責任，不讓模型直接輸出最終 transaction bundle。

## 介面與資料結構變更
- `clinician_summary_draft` 新增或內嵌雙軌欄位，例如：
  - `symptom_evidence_track`
  - `symptom_inference_track`
- `fhir_delivery_draft` 的 `observation_candidates` 每筆需可選擇帶有：
  - `focus`
  - `category`
  - `status`
  - `evidence_refs`
  - `inference_basis`
- 若前端或 session export 依賴舊欄位，需保留 `symptom_observations` 作為相容欄位，但其值改由推論軌生成。

## 測試與驗收
- 指令污染案例：輸入「請幫我生成FHIR草稿」「整理給醫師」等句子後，不可出現在症狀欄位。
- 真實症狀案例：睡眠差、惡夢、低落、工作受損等多主題內容，應被合併為臨床可讀摘要，而非逐句照抄。
- 雙軌一致性案例：每個 inference symptom 都能找到至少一筆 evidence 對應。
- 回退案例：模型失敗或 JSON 無法解析時，仍可產出不含操作指令的安全草稿。
- FHIR 相容性案例：既有 `buildSessionExportBundle()` 與驗證流程可正常接收新版 `fhir_delivery_draft`。

## 預設假設
- 以現有 LLM 任務框架 `runJsonTask()` 為基礎擴充，不另開新服務。
- 既有規則引擎保留，但降級為 fallback/輔助訊號來源。
- 審核通過後，文件存放位置預設為 `工程文件入口/計畫文件`。
- 檔名預設採中文主題式，例如：`AI 症狀對接與 FHIR 草稿優化實作計畫.md`。
