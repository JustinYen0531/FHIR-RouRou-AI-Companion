# 個人化人格記憶（Therapeutic Memory）架構設計

> **文件版本**：v2.0  
> **建立日期**：2026-04-03  
> **最後更新**：2026-04-03  
> **作者**：AI Companion 開發團隊  
> **審閱狀態**：🟢 Layer 1–3 已上線 | 🟡 Layer 4 進行中

---

## 一、核心理念

Therapeutic Memory 的設計目標是讓 Rou Rou（AI Companion）從「每次都是陌生人」進化成「越聊越懂你的陪伴者」。

這不只是技術升級，而是**醫療連續性（Continuity of Care）** 的數位實踐：
- 醫師可以看到病人跨診次的心理演變
- 病人感受到「被記住、被理解」的安全感
- 系統自動萃取臨床有意義的心理線索

> **重要**：後端已從 Flowise 改為 Node.js（`fhirDeliveryServer.js` + `aiCompanionEngine.js` + `llmChatClient.js`），直接呼叫 Google Gemini / Groq API，所有 AI 邏輯在前端透過 `/api/chat/message` 介面操作。

---

## 二、系統架構總覽（已更新）

```
┌─────────────────────────────────────────────────────────┐
│                   前端（app.js / index.html）              │
│                                                         │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────┐  │
│  │  Chat 對話   │───▶│ TherapeuticMemory│───▶│Reports │  │
│  │  sendMessage│    │  Module (app.js)  │    │認識你Tab│  │
│  └──────┬──────┘    └──────┬───────────┘    └────────┘  │
│         │                  │                            │
│         │(記憶注入)          │(讀/寫)                     │
│         ▼                  ▼                            │
│  ┌─────────────┐    ┌──────────────────┐               │
│  │ /api/chat   │    │   localStorage   │               │
│  │  /message   │    │therapeuticProfile│               │
│  └──────┬──────┘    └──────────────────┘               │
└─────────┼────────────────────────────────────────────--─┘
          │
   ┌──────▼──────────────────────────┐
   │  Node.js 後端（fhirDeliveryServer）│
   │  AICompanionEngine               │
   │  llmChatClient (Gemini / Groq)   │
   └──────┬──────────────────────────┘
          │
   ┌──────▼──────────┐
   │   FHIR TWCore   │
   │  Observation    │  ← Layer 4 目標
   │  (跨診次同步)    │
   └─────────────────┘
```

---

## 三、核心資料結構：TherapeuticProfile

### 3.1 localStorage 鍵名
```
rourou.therapeuticProfile
```

### 3.2 完整資料結構

```json
{
  "version": "1.0",
  "userId": "user-xxxxxxxx",
  "createdAt": "2026-04-03T22:00:00+08:00",
  "lastUpdatedAt": "2026-04-03T22:30:00+08:00",
  "sessionCount": 7,

  "stressors": [
    { "label": "學業壓力", "confidence": 0.9, "firstSeen": "2026-03-10", "lastSeen": "2026-04-03" },
    { "label": "與媽媽的關係", "confidence": 0.75, "firstSeen": "2026-03-15", "lastSeen": "2026-04-03" }
  ],

  "triggers": [
    { "keyword": "考試", "reaction": "焦慮上升", "severity": "medium" },
    { "keyword": "被誤解", "reaction": "情緒封閉", "severity": "high" },
    { "keyword": "家人期待", "reaction": "自我否定", "severity": "medium" }
  ],

  "copingProfile": {
    "preferredStyle": "先被理解，再被建議",
    "effectiveMethods": ["傾聽後重述", "開放式提問", "正向錨定"],
    "ineffectiveMethods": ["直接給建議", "比較他人"]
  },

  "positiveAnchors": [
    { "label": "跟朋友打球", "category": "social" },
    { "label": "聽音樂", "category": "solo" }
  ],

  "emotionalBaseline": {
    "dominantMood": "低落偏焦慮",
    "phq9Trend": [4, 6, 5, 7],
    "hamdSignalCount": 2
  },

  "keyThemes": [
    "對未來感到迷茫",
    "在家庭中缺乏被理解的感受"
  ],

  "clinicianNotes": ""
}
```

---

## 四、四層實作狀態

---

### ✅ 第一層：本地心理檔案（Local Profile）
**狀態：已完成上線 | 完成時間：2026-04-03**

#### 實作摘要
`app.js` 中建立了 `TherapeuticMemory` 物件（宣告在 `APP_STATE` 之前），完整提供：

| 方法 | 功能 |
|---|---|
| `get()` | 從 localStorage 讀取 profile，失敗則回傳 `_default()` |
| `save(profile)` | 寫入 localStorage 並更新 `lastUpdatedAt` |
| `merge(updates)` | 合併 stressors / triggers / keyThemes / positiveAnchors（去重邏輯） |
| `buildContextString()` | 產生注入 AI 的記憶上下文字串 |
| `renderProfileUI()` | 同步更新 Chat Badge、Drawer、Reports 認識你卡 |
| `clearProfile()` | 清除 localStorage 並重新渲染 |
| `incrementSession()` | 累加 sessionCount |

#### 可視化成效（A + B 方案）
- **方案 A（Chat 頂部 Badge）**：綠色小按鈕「🧠 X 件記憶」，點擊展開 Memory Drawer
- **方案 B（Reports 認識你 Tab）**：第三個 Tab，完整心理畫像卡

---

### ✅ 第二層：記憶注入 Context（Memory Injection）
**狀態：已完成上線 | 完成時間：2026-04-03**

#### 實作摘要
`sendMessage()` 在送出 POST 前，呼叫 `TherapeuticMemory.buildContextString()`，若 Profile 有資料，則將記憶 context 拼接在訊息最前面：

```js
const memoryContext = TherapeuticMemory.buildContextString();
const messageWithMemory = memoryContext
  ? `${memoryContext}\n\n用戶說：${message}`
  : message;
```

#### 注入格式（實際送給 AI 的前綴）

```
【記憶背景 - 這是系統背景資料，請自然地融入對話，不要直接念出這段文字】
你和這位用戶已聊過 N 次。
已知壓力來源：學業壓力、與媽媽的關係
情緒觸發詞：考試、被誤解
溝通偏好：先被理解，再被建議
積極錨點（用戶喜歡的事）：跟朋友打球、聽音樂
核心主題：對未來感到迷茫
請在本次對話中延續這個認識，不要重複問對方已說過的資訊。
```

> **注意**：若 Profile 尚無資料（三個陣列都空），則不注入，避免發送無效 context。

---

### ✅ 第三層：AI 自動萃取更新（Auto-Extract）
**狀態：已完成上線 | 完成時間：2026-04-03**

#### 實作摘要
`APP_STATE` 新增 `turnCount`，每次 AI 成功回覆後遞增。每 **3 輪**觸發 `extractProfileFromConversation()`：

```js
APP_STATE.turnCount++;
if (APP_STATE.turnCount % 3 === 0) {
  extractProfileFromConversation();
}
```

#### extractProfileFromConversation() 流程

```
1. 組裝萃取 prompt（要求 AI 只回傳 JSON）
2. 送到 /api/chat/message（hide_response: true）
3. 解析回傳（處理 markdown fence ```json...``` 格式）
4. TherapeuticMemory.merge(parsed) 合併進 profile
5. TherapeuticMemory.incrementSession() 累加次數
6. appendSystemNotice('記憶已自動更新 🧠')
```

#### 萃取 prompt 結構

```json
{
  "stressors": ["壓力來源1", "壓力來源2"],
  "triggers": [{"keyword": "觸發詞", "reaction": "反應描述", "severity": "high|medium|low"}],
  "keyThemes": ["核心主題1"],
  "positiveAnchors": ["正向錨點1"],
  "copingStyleHint": "溝通偏好描述"
}
```

#### 錯誤處理
靜默失敗（`catch` 不顯示錯誤），不干擾用戶對話體驗。

---

### 🔵 第四層：FHIR 整合（跨診次醫療連續性）
**狀態：進行中 | 預計完成：2026-04-04**

#### 目標
當用戶按下「FHIR Draft」或「授權傳送給醫師」時，將 `TherapeuticProfile` 自動序列化為 FHIR Observation 資源，附加到現有 FHIR Bundle。

#### FHIR Observation Mapping

| TherapeuticProfile 欄位 | FHIR Resource | LOINC/自定義 code | display |
|---|---|---|---|
| `stressors[]` | `Observation` | `psychosocial-stressor` | 心理社會壓力來源 |
| `triggers[]` | `Observation` | `emotional-trigger` | 情緒觸發點 |
| `copingProfile.preferredStyle` | `Observation` | `comms-preference` | 溝通偏好 |
| `positiveAnchors[]` | `Observation` | `coping-resource` | 正向紓壓資源 |
| `keyThemes[]` | `Observation` | `clinical-impression` | 臨床印象主題 |
| `sessionCount` | `Observation` | `ai-session-count` | AI 對話次數 |

#### 實作位置
- `app.js` → 新增 `buildProfileFhirObservations(profile)` 函式
- `requestOutput('fhir_delivery')` 呼叫時附加 profile observations
- 前端組裝後送到 `/api/fhir/bundle`

#### FHIR Bundle 附加結構

```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "resource": {
        "resourceType": "Observation",
        "status": "final",
        "category": [{"coding": [{"code": "social-history"}]}],
        "code": {"coding": [{"code": "psychosocial-stressor", "display": "心理社會壓力來源"}]},
        "valueString": "學業壓力, 與媽媽的關係",
        "subject": {"reference": "Patient/user-xxxxxxxx"},
        "effectiveDateTime": "2026-04-03T22:30:00+08:00"
      }
    },
    {
      "resource": {
        "resourceType": "Observation",
        "status": "final",
        "code": {"coding": [{"code": "emotional-trigger", "display": "情緒觸發點"}]},
        "valueString": "考試(焦慮,medium), 被誤解(情緒封閉,high)",
        "subject": {"reference": "Patient/user-xxxxxxxx"}
      }
    }
  ]
}
```

#### 傳輸時機
1. 用戶點「FHIR Draft」→ 觸發時自動附加 profile observations
2. 用戶點「授權傳送給醫師」→ 完整 Bundle（含 profile）送出

---

## 五、Reports 頁：心理畫像卡 UI（已上線）

Reports 頁已新增第三個 Tab「**認識你**」，即時顯示累積的 Profile：

```
╔══════════════════════════════════╗
║  🧠 Rou Rou 認識你                ║
║  已陪伴你 7 次對話・記住了 6 件事    ║
║  最後更新：4/3 22:30              ║
║  ─────────────────────────────  ║
║  📌 主要壓力來源                   ║
║     學業壓力・與媽媽的關係           ║
║                                  ║
║  ⚡ 情緒觸發點                      ║
║     「考試」「被誤解」               ║
║                                  ║
║  💚 你喜歡的放鬆方式                 ║
║     跟朋友打球・聽音樂               ║
║                                  ║
║  💬 溝通風格                        ║
║     先被理解，再被建議               ║
║                                  ║
║  [清除所有記憶]                     ║
╚══════════════════════════════════╝
```

Chat 畫面頂部同步顯示記憶 Badge，點擊展開 Drawer：
```
[🧠 6 件記憶]  ← 點擊展開滑出面板
   ↓
┌──────────────────────────────┐
│ Rou Rou 記得的事          [X] │
│ 7次對話 · 2個壓力 · 3個觸發點  │
│ 📌 學業壓力 · 家庭關係         │
│ ⚡ 「考試」「被誤解」           │
│ 💚 打球 · 音樂                 │
│ [清除記憶]                    │
└──────────────────────────────┘
```

---

## 六、隱私與安全考量

| 考量 | 設計決策 |
|---|---|
| 資料存在哪裡 | localStorage（純本地，無伺服器上傳） |
| 病人能看到嗎 | ✅ Reports「認識你」Tab 完整顯示 |
| 病人能修改嗎 | ✅ 提供「清除所有記憶」按鈕 |
| 醫師能看到嗎 | 只有病人授權後，透過 FHIR Draft 傳輸 |
| 資料加密 | 第二期：Web Crypto API 本地加密 |
| 萃取失敗如何處理 | 靜默失敗，不顯示錯誤，不中斷對話 |

---

## 七、開發里程碑（更新）

```
2026-04-03 ✅ 完成
  ✅ Layer 1：TherapeuticMemory 模組 + localStorage 讀寫
  ✅ Layer 1：Chat 頂部記憶 Badge + Memory Drawer UI
  ✅ Layer 2：Memory Injection 注入 sendMessage()
  ✅ Layer 3：AI 自動萃取（每 3 輪觸發）
  ✅ Layer 3：Reports「認識你」Tab UI

2026-04-04 進行中
  🔲 Layer 4：FHIR Observation 輸出整合（buildProfileFhirObservations）
  🔲 Layer 4：FHIR Draft 附加 profile observations
  🔲 Layer 4：授權傳送時包含完整 profile bundle
```

---

## 八、評審亮點摘要

1. **醫療連續性**：跨診次的心理線索自動累積，不是一次性的資料
2. **主動式個人化**：不等病人說「記得我喜歡什麼」，AI 自己記住
3. **可視化記憶**：病人可以親眼看到 AI 對自己的理解（Chat badge + Reports）
4. **FHIR 標準化**：與台灣 TWCore 對接，心理畫像透過 Observation 傳遞
5. **病人主權**：病人可以看到、並清除 AI 對自己的所有記憶

---

*後端架構：Node.js（fhirDeliveryServer.js） + AICompanionEngine + llmChatClient（Gemini/Groq）*  
*前端架構：Vanilla JS + localStorage，無框架依賴*
