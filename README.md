# 星澄遠征軍｜Rou Rou AI Companion

## 專案簡介

AI Companion 是一套以心理健康診前整理為核心的 AI 陪伴系統。  
使用者可以先透過自然語言描述近期情緒、睡眠、壓力、功能影響與生活困擾，系統再把對話內容整理成：

- 醫師摘要
- 病人審閱稿
- FHIR Draft / FHIR Bundle
- 治療性記憶與個人化理解

本專案的目標不是讓 AI 直接做醫療診斷，而是降低病人的表達門檻，提升醫療端閱讀效率，並把對話資料轉換成可驗證、可交換的標準格式。

## 直接使用

如果你只是想直接體驗，不需要先下載專案。

- 線上 Demo：[https://fhir-xingcheng.vercel.app](https://fhir-xingcheng.vercel.app)
- YouTube 介紹影片：[https://youtu.be/xgSwaATVUeA](https://youtu.be/xgSwaATVUeA)

建議使用方式：

1. 想直接操作系統：打開線上 Demo
2. 想先快速理解功能：先看 YouTube 介紹影片
3. 想看程式與技術細節：再下載本 repository

## 系統亮點

- AI 陪伴式對話，可先接住情緒，再逐步整理重要資訊
- 支援多種互動模式，例如樹洞模式、靈魂陪伴、任務引導、選項引導與自動分流
- 內建治療性記憶，會逐步記住壓力來源、觸發點、正向錨點與溝通偏好
- 支援醫師摘要、病人審閱稿、FHIR Draft 按需輸出
- 支援病人授權後再送出，不是對話一結束就自動上傳
- 可將整理結果映射成 FHIR / TW Core 導向結構
- 首頁目前已支援保留並存取「上一段對話」，可從首頁直接繼續剛剛那次聊天
- 已支援 OpenRouter / Google Gemini / Groq 等模型來源
- 目前預設模型與連線設定已整理好，線上版可直接使用，不需要使用者自行填 API key

## 目前推薦的使用方式

### 方式一：直接使用線上版

適合評審、老師、一般體驗者。

- 入口：[https://fhir-xingcheng.vercel.app](https://fhir-xingcheng.vercel.app)
- 不需要下載專案
- 不需要自行設定 API key
- 可直接體驗聊天、記憶、報表與 FHIR 相關流程
- 目前首頁至少可保留上一段對話，回到首頁後可直接續聊，對整體體驗已經是一個很實用的突破

### 方式二：先看影片理解系統

適合想先快速掌握整體概念的人。

- 影片：[https://youtu.be/xgSwaATVUeA](https://youtu.be/xgSwaATVUeA)
- 可先了解系統定位、互動流程、臨床整理邏輯與展示方式

### 方式三：本機啟動開發版

適合要讀程式、改功能、做本地測試的人。

## 競賽資訊

- 隊伍名稱：星澄遠征軍
- 作品名稱：AI Companion
- 主題領域：醫療資訊 / 心理健康
- 主要使用情境：病人看診前整理、醫療端閱讀、FHIR 結構化交付
- 核心 FHIR Resources：Patient、Encounter、Observation、QuestionnaireResponse、Composition、DocumentReference、Provenance

## 本機執行方式

### 1. 環境需求

- Node.js 18 以上
- Windows PowerShell 或其他可執行 Node.js 的終端機

### 2. 啟動本地伺服器

```powershell
node app\fhirDeliveryServer.js
```

啟動後可開啟：

- [http://localhost:8787/](http://localhost:8787/)
- [http://localhost:8787/health](http://localhost:8787/health)

FHIR 預設測試目標：

- [https://hapi.fhir.org/baseR4](https://hapi.fhir.org/baseR4)

### 3. AI 模型設定

目前專案支援：

- OpenRouter
- Google Gemini
- Groq

如果你要在本機自行指定模型，可使用 `.env.local`。

先複製：

```powershell
Copy-Item .env.example .env.local
```

再依需求填入。

OpenRouter 範例：

```env
LLM_PROVIDER=openrouter
OPENROUTER_API_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
LLM_MODEL=openai/gpt-4o-mini
```

Google Gemini 範例：

```env
LLM_PROVIDER=google
GOOGLE_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY
```

Groq 範例：

```env
LLM_PROVIDER=groq
GROQ_API_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=YOUR_GROQ_API_KEY
```

說明：

- `.env.local` 不會被提交到 git
- 若未另外覆蓋，本地會讀取你目前的預設設定
- 線上展示版不需要使用者自己填 API key

## 主要功能

### 1. AI 陪伴對話

- 接住病人的自然語言輸入
- 根據內容切換互動模式
- 可處理情緒困擾、壓力、睡眠、功能影響等主題

### 2. 治療性記憶

- 累積壓力來源
- 累積情緒觸發點
- 記住正向錨點與偏好
- 記住溝通風格

### 3. 按需輸出

- 整理給醫師
- 病人審閱稿
- FHIR Draft
- 交付前檢查與授權流程

### 4. FHIR / TW Core 導向整合

- 將對話內容映射為結構化資料
- 提供後續交付與互通的實作基礎
- 支援 HAPI FHIR 測試環境驗證

## 專案結構

- [app](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app)：前端、Node 伺服器、FHIR 與 AI 引擎主程式
- [評審必看_系統說明與實作文件](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/評審必看_系統說明與實作文件)：目前主要說明文件、系統亮點與測試紀錄
- [廢棄之Dify聊天流](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/廢棄之Dify聊天流)：舊版 Dify chatflow 匯出檔，作為歷史資料保留
- [flowise](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/flowise)：過往 Flowise 相關資產與轉換資料
- [tools](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/tools)：開發用工具腳本

## 重要文件

目前建議優先看這些：

- [競賽實作內容說明](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/評審必看_系統說明與實作文件/競賽實作內容說明.md)
- [AI陪伴系統_產品需求文件](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/評審必看_系統說明與實作文件/AI陪伴系統_產品需求文件.md)
- [AI陪伴系統_白話流程說明](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/評審必看_系統說明與實作文件/AI陪伴系統_白話流程說明.md)
- [AI陪伴系統_Node引擎說明](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/評審必看_系統說明與實作文件/AI陪伴系統_Node引擎說明.md)
- [AI陪伴系統_FHIR技術摘要](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/評審必看_系統說明與實作文件/AI陪伴系統_FHIR技術摘要.md)
- [AI陪伴系統_HAM-D正式評分升級計畫](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/評審必看_系統說明與實作文件/AI陪伴系統_HAM-D正式評分升級計畫.md)
- [AI陪伴系統_測試檢查清單](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/評審必看_系統說明與實作文件/AI陪伴系統_測試檢查清單.md)
- [AI陪伴系統_專案大事記](/C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/評審必看_系統說明與實作文件/AI陪伴系統_專案大事記.md)

## 補充說明

- 本專案目前主線以 `master` 為主
- `main` 保留為較早期的另一條演進分支，不是目前主要展示內容
- 若你看到 README、舊 chatflow、舊資料夾名稱不完全一致，請以 `app` 與 `評審必看_系統說明與實作文件` 內目前內容為準

## License / 使用說明

本 repository 主要作為競賽展示、技術驗證與開發紀錄使用。若需進一步引用或延伸使用，建議先聯絡作者確認。
