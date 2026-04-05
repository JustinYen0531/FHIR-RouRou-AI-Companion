# 星澄遠征軍｜AI Companion

## 專案簡介

AI Companion 是一套以心理健康診前整理為核心的 AI 陪伴系統。病人可先透過自然語言描述近期情緒、睡眠、壓力與功能影響，系統再將對話內容整理成醫師摘要、病人審閱稿，以及符合 FHIR / TW Core 導向的結構化資料，作為臨床閱讀與後續交換的基礎。

本專案聚焦的不是「讓 AI 直接診斷」，而是降低病人表達門檻、提升醫療端閱讀效率，並把對話資料轉換成可驗證、可交換的標準格式。

## 競賽資訊

- 隊伍名稱：星澄遠征軍
- 作品名稱：AI Companion
- 主題領域：醫療資訊 / 心理健康
- 使用者角色：病人、醫師、護理師、個管師、心理師、系統管理者
- 核心 FHIR Resources：Patient、Encounter、Practitioner、Observation、QuestionnaireResponse、Composition、DocumentReference、Provenance

## Demo 入口

- Web Demo：啟動本地伺服器後開啟 `http://localhost:8787/`
- FHIR API：`http://localhost:8787/api/fhir/bundle`
- 健康檢查：`http://localhost:8787/health`
- 帳密：目前無固定示範帳密；可直接以本機啟動方式操作

Demo 操作建議：

1. 啟動 `node app\fhirDeliveryServer.js`
2. 開啟 `http://localhost:8787/`
3. 在聊天畫面輸入情緒或睡眠困擾內容
4. 透過按鈕或文字指令產生 `整理給醫師`、`病人審閱稿`、`FHIR Draft`

## 如何執行

### 1. 環境需求

- Node.js 18 以上
- Windows PowerShell 或其他可執行 Node.js 的終端機
- 若要啟用 AI 對話模型，需準備 Google Gemini 或 Groq API Key

### 2. 啟動本地 Demo

```powershell
node app\fhirDeliveryServer.js
```

啟動後可直接使用：

- `http://localhost:8787/`
- `http://localhost:8787/health`

若未另外指定，FHIR 交付會預設送往公開測試站：

- `https://hapi.fhir.org/baseR4`

### 3. 啟用 AI 對話模型

建議做法是先在專案根目錄建立 `\.env.local`，伺服器啟動時會自動讀取。

1. 複製範例檔：

```powershell
Copy-Item .env.example .env.local
```

2. 編輯 `\.env.local`，填入你的 API Key。

Groq `\.env.local` 範例：

```powershell
LLM_PROVIDER=groq
GROQ_API_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=YOUR_GROQ_API_KEY
```

OpenRouter `\.env.local` 範例：

```powershell
LLM_PROVIDER=openrouter
OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
LLM_MODEL=openai/gpt-4o-mini
```

Google Gemini `\.env.local` 範例：

```powershell
LLM_PROVIDER=google
GOOGLE_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
```

3. 啟動伺服器：

```powershell
node app\fhirDeliveryServer.js
```

若同時存在系統環境變數與 `\.env.local`，系統會優先使用已存在的系統環境變數。

Google Gemini：

```powershell
$env:LLM_PROVIDER="google"
$env:GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
node app\fhirDeliveryServer.js
```

Groq：

```powershell
$env:LLM_PROVIDER="groq"
$env:GROQ_API_BASE_URL="https://api.groq.com/openai/v1"
$env:GROQ_API_KEY="YOUR_GROQ_API_KEY"
node app\fhirDeliveryServer.js
```

若未提供 API Key，系統仍可啟動本地介面與 FHIR 交付層，但 AI 對話功能需由前端設定或補上金鑰後才能完整使用。

### 4. 指定 FHIR 上傳目標

若要改送其他 FHIR Server，可在啟動前指定：

```powershell
$env:FHIR_SERVER_URL="https://hapi.fhir.org/baseR4"
node app\fhirDeliveryServer.js
```

若未設定 `FHIR_SERVER_URL`，Demo 會自動使用上面的 HAPI 測試站。

### 5. 建立與驗證 FHIR Bundle

執行 Bundle Builder 測試：

```powershell
node app\fhirBundleBuilder.test.js
```

以範例資料產生 Bundle：

```powershell
node app\buildBundleDemo.js
```

啟動 FHIR Delivery API 測試：

```powershell
node app\fhirDeliveryServer.test.js
```

## 系統亮點

- AI 陪伴式對話，協助病人在看診前逐步整理情緒與症狀
- 支援醫師摘要、病人審閱稿、FHIR Draft 按需輸出
- 對話資料可映射為 FHIR Bundle，具備與 TW Core 導向整合的實作基礎
- 內含 HAM-D 線索追蹤、風險標籤整理與交付前檢查流程

## 主要檔案位置

- 前端與本地伺服器：`app\index.html`、`app\fhirDeliveryServer.js`
- FHIR Bundle Builder：`app\fhirBundleBuilder.js`
- 範例輸入：`app\sampleSessionExport.json`
- 範例輸出：`app\sampleBundleOutput.json`
- 競賽說明文件：`docs\競賽實作內容說明.md`

## 相關文件

- `docs\競賽實作內容說明.md`
- `docs\AI陪伴系統_產品需求文件.md`
- `docs\AI陪伴系統_白話流程說明.md`
- `docs\AI陪伴系統_FHIR技術摘要.md`
- `docs\AI陪伴系統_測試檢查清單.md`
