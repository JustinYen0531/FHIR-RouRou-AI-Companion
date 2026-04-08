# FHIR 交付一致性與臨床映射補強計畫

## 摘要
本計畫聚焦在先補齊目前 FHIR 交付流程的前後一致性，不一次擴張到正式醫療交換治理。目標是讓 `FHIR draft`、前端顯示、bundle builder、validator、測試樣本維持同一組資源契約，避免草稿宣告與實際輸出脫節。

## 主要實作方向
1. 定義單一交付真相來源
- 將 `fhir_delivery_draft.resources` 收斂成受控欄位，只允許列出 bundle builder 目前會真正輸出的資源。
- 在 `aiCompanionEngine` 中建立固定資源定義，至少對齊 `Patient`、`Encounter`、`QuestionnaireResponse`、`Observation`、`ClinicalImpression`、`Composition`、`DocumentReference`、`Provenance`。
- 避免 prompt 或 merge 流程再把未實作資源帶回 draft。

2. 補齊 `ClinicalImpression`
- 讓 `ClinicalImpression` 真正進入 bundle，而不是只停留在 draft 宣告。
- 資料來源固定使用 `clinician_summary_draft`、`red_flag_payload`、`symptom_inference_track`、`hamd_progress_state` 與現有 observation references。
- 若資訊不足，降階輸出 preliminary 臨床印象，只保留 `description`、`summary`、`finding`、`supportingInfo` 等低風險欄位。

3. 收斂 internal canonical 命名
- 將 extension、NamingSystem、Questionnaire、CodeSystem URL 集中為單一常數區。
- 本階段改成內部 canonical 命名空間，明確標示為待正式治理，而不是散落 `example.org` 樣板值。
- 更新相關測試與樣本輸出，確保 canonical 命名與實際 bundle 一致。

4. 同步 validator 與前端顯示
- `fhirBundleValidator` 新增 `ClinicalImpression` 驗證規則，至少檢查 profile、subject、status、description/summary。
- 前端資源排序與授權頁摘要需納入 `ClinicalImpression`，讓顯示順序和 bundle entry 一致。
- `FHIR draft` 頁面上的資源說明改成「目前將輸出的實際資源」，不再保留理想型宣告。

## 驗收與測試
- `fhir_delivery_draft.resources` 宣告的每種資源，都能在 `buildSessionExportBundle()` 的輸出 bundle 中找到對應 `resourceType`。
- bundle 中實際輸出的每種資源，都能在 draft / UI / `resource_index` 中被一致呈現。
- `ClinicalImpression` 必須同時通過 builder、validator、前端排序與測試案例。
- 所有 extension URL、NamingSystem、Questionnaire、CodeSystem 來源都來自集中常數，不再散落硬編碼。
- `sampleBundleOutput.json`、`fhirBundleBuilder.test.js`、前端資源順序與實際 bundle 輸出一致。

## 預設假設
- 本階段只做一致性補強，不處理正式外部 canonical 註冊或醫療院所交換治理。
- 預設採補齊 `ClinicalImpression`，不採移除 draft 宣告。
- 沿用現有 `app/aiCompanionEngine.js`、`app/fhirBundleBuilder.js`、`app/fhirBundleValidator.js` 與前端顯示責任分工，不另開新服務。
