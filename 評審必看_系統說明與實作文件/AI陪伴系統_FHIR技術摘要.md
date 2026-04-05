# FHIR 基礎實作說明（主辦方審閱用）

## 1. 主題與應用情境

本專案的主題是：

**以 AI Companion 對話系統協助心理健康診前整理，並將整理後的資料轉換為 FHIR / TW Core 導向的結構化資訊。**

應用情境如下：

- 病人在看診前，先與 AI Companion 對話描述近期情緒、睡眠、壓力與功能影響
- 系統將對話內容整理成醫師摘要、病人審閱稿與 FHIR Draft
- FHIR Draft 可再被組裝為 Bundle，供後續交付或與 FHIR Server 串接

本專案的重點不是把聊天內容直接當成病歷，而是先做整理、標籤化、結構化，再輸出成較符合臨床交換需求的資料。

---

## 2. 本專案已使用的 FHIR 基礎實作

以下列出目前專案中已實作或已具雛形的 FHIR 相關內容。

### 2.1 已實作的核心 Resource 映射

目前程式中已實作或已明確建立映射結構的 FHIR Resource 包括：

- `Patient`
- `Encounter`
- `QuestionnaireResponse`
- `Observation`
- `Composition`
- `DocumentReference`
- `Provenance`

上述資源已在 FHIR Bundle Builder 中有對應組裝邏輯，可由 session export 資料轉換而來。

### 2.2 已實作的 FHIR Bundle 產生

本專案已有可執行的 Bundle Builder，可將系統輸出的 session export 轉換成 FHIR Bundle。

目前具備的能力包括：

- 建立 Bundle JSON
- 產生 validation report
- 標示 validation errors
- 標示 blocking reasons

### 2.3 已實作的 FHIR Delivery API

目前專案已提供本地 API，可接收整理後的資料並進行：

- dry run
- Bundle 驗證
- 視情況送往外部 FHIR Server

這代表本專案不只停留在文件設計，而是已有實際的程式路徑可驗證 FHIR 交付流程。

### 2.4 已納入的 TW Core 導向設計

本專案在 Builder 中已納入多個 TW Core profile URL 概念，包括：

- TW Core Patient
- TW Core Encounter
- TW Core QuestionnaireResponse
- TW Core Observation Screening Assessment
- TW Core Composition
- TW Core DocumentReference
- TW Core Provenance

這表示專案設計方向不是一般自訂 JSON，而是有意識地朝台灣在地 FHIR 實作指引靠攏。

---

## 3. 目前對話資料如何被轉成 FHIR

本專案目前的資料流程為：

1. 病人與 AI Companion 進行自然語言對話
2. 系統整理出症狀線索、風險標籤、HAM-D 相關維度與摘要草稿
3. 系統產出 session export
4. `fhirBundleBuilder.js` 將 session export 轉成 FHIR Bundle
5. `fhirDeliveryServer.js` 可提供本地 API 進行 dry run 或後續外送

目前可作為 FHIR 輸入依據的重要資料狀態包括：

- `clinician_summary_draft`
- `hamd_progress_state`
- `red_flag_payload`
- `patient_authorization_state`
- `delivery_readiness_state`
- `patient_review_packet`
- `fhir_delivery_draft`

---

## 4. 主要程式碼位置

以下是本專案中與 FHIR 基礎實作最直接相關的程式位置：

- [app/fhirBundleBuilder.js](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\app\fhirBundleBuilder.js)
- [app/fhirBundleBuilder.test.js](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\app\fhirBundleBuilder.test.js)
- [app/fhirBundleValidator.js](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\app\fhirBundleValidator.js)
- [app/fhirDeliveryServer.js](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\app\fhirDeliveryServer.js)
- [app/fhirDeliveryServer.test.js](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\app\fhirDeliveryServer.test.js)
- [app/buildBundleDemo.js](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\app\buildBundleDemo.js)
- [app/sampleSessionExport.json](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\app\sampleSessionExport.json)
- [app/sampleBundleOutput.json](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\app\sampleBundleOutput.json)

---

## 5. 可執行結果與驗證方式

### 5.1 執行 Bundle Builder 測試

```powershell
node app\fhirBundleBuilder.test.js
```

### 5.2 以範例資料產生 Bundle

```powershell
node app\buildBundleDemo.js
```

執行後可產生 Bundle 輸出檔，作為展示與驗證依據。

### 5.3 啟動交付層 API

```powershell
node app\fhirDeliveryServer.js
```

啟動後可測試：

- `GET /health`
- `POST /api/fhir/bundle`

若設定外部 FHIR Server URL，也可嘗試做 transaction delivery。

---

## 6. 說明文件位置

本專案另有多份文件說明 FHIR 與系統整合設計，包括：

- [AI陪伴系統_FHIR_TWCore整合說明.md](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\AI陪伴系統_FHIR_TWCore整合說明.md)
- [競賽實作內容說明.md](C:\Users\閻星澄\Desktop\FHIR-main\FHIR-main\docs\競賽實作內容說明.md)

---

## 7. 實作現況標註

為避免誤解，以下補充目前 FHIR 相關內容的實作狀態。

### 7.1 已完成或已有可執行成果

- FHIR Bundle 建立流程
- 基本 Resource 映射
- Bundle 驗證報告輸出
- 本地 FHIR Delivery API
- Session export 到 Bundle 的轉換流程

### 7.2 部分完成

- TW Core 導向欄位對接
- 病人審閱狀態與交付狀態映射
- 醫師摘要到 FHIR 文件型資源的整合表達

### 7.3 待後續擴充

- 完整醫院端正式上線驗證
- OAuth 2.0 / 醫療身分授權整合
- 更完整的正式 LOINC / 術語綁定
- ClinicalImpression 等進階資源輸出
- 與真實 HIS / EHR 環境的端到端驗證

---

## 8. 可能延伸應用

本專案的 FHIR 基礎實作，未來可延伸到：

- 心理健康診前整理
- 情緒追蹤與遠距照護
- 醫院內部診前摘要交換
- 跨院轉介資料標準化
- 與 TW Core 導向系統之後續整合

---

## 9. Github 繳交說明

本專案已將程式碼、文件與 FHIR 基礎實作相關內容放入 Github 倉庫中，供公開檢閱或分享給大會人員審閱。

繳交內容包括：

- FHIR Bundle Builder 程式碼
- FHIR Delivery API 程式碼
- 範例輸入與輸出結果
- 系統規劃文件
- FHIR / TW Core 整合說明文件

本文件目的，是協助主辦方快速確認：

- 本專案確實有使用 FHIR 標準概念
- 已有實作程式碼與輸出結果
- 不只是概念設計，而是已有可執行的基礎交付流程
