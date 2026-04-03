# 個人化人格記憶（Therapeutic Memory）架構設計

> **文件版本**：v1.0  
> **建立日期**：2026-04-03  
> **作者**：AI Companion 開發團隊  
> **審閱狀態**：🟡 待審閱

---

## 一、核心理念

Therapeutic Memory 的設計目標是讓 Rou Rou（AI Companion）從「每次都是陌生人」進化成「越聊越懂你的陪伴者」。

這不只是技術升級，而是**醫療連續性（Continuity of Care）** 的數位實踐：
- 醫師可以看到病人跨診次的心理演變
- 病人感受到「被記住、被理解」的安全感
- 系統自動萃取臨床有意義的心理線索

---

## 二、系統架構總覽

```
┌─────────────────────────────────────────────────────────┐
│                   前端（app.js / index.html）              │
│                                                         │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │  Chat 對話   │───▶│ Profile 引擎  │───▶│ Reports 頁 │  │
│  │  sendMessage│    │ (本文件核心)  │    │ 心理畫像卡 │  │
│  └─────────────┘    └──────┬───────┘    └────────────┘  │
│                            │                            │
│                    ┌───────▼────────┐                   │
│                    │  localStorage  │                   │
│                    │therapeuticProf │                   │
│                    └───────┬────────┘                   │
└────────────────────────────┼────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Flowise / API   │
                    │  AI 萃取 + 回覆  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   FHIR TWCore   │
                    │  Observation    │
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

## 四、四層實作計劃

### 🟢 第一層：本地心理檔案（Local Profile）
**優先度：最高 | 工期：半天**

#### 功能說明
- 建立 `TherapeuticMemory` 物件，負責讀寫 `therapeuticProfile`
- 提供 `get()`, `update()`, `merge()` 方法

#### 實作位置
`app.js` — 在 `APP_STATE` 定義之後加入新模組

```js
const TherapeuticMemory = {
  KEY: 'rourou.therapeuticProfile',

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || this._default();
    } catch { return this._default(); }
  },

  save(profile) {
    profile.lastUpdatedAt = new Date().toISOString();
    localStorage.setItem(this.KEY, JSON.stringify(profile));
  },

  merge(updates) {
    const profile = this.get();
    // 合併 stressors（去重）
    if (updates.stressors) {
      updates.stressors.forEach(s => {
        const existing = profile.stressors.find(e => e.label === s.label);
        if (existing) {
          existing.confidence = Math.min(1, existing.confidence + 0.1);
          existing.lastSeen = new Date().toISOString().slice(0,10);
        } else {
          profile.stressors.push({ ...s, firstSeen: new Date().toISOString().slice(0,10), lastSeen: new Date().toISOString().slice(0,10) });
        }
      });
    }
    // 合併 triggers（去重）
    if (updates.triggers) {
      updates.triggers.forEach(t => {
        if (!profile.triggers.find(e => e.keyword === t.keyword)) {
          profile.triggers.push(t);
        }
      });
    }
    // 合併 keyThemes（去重）
    if (updates.keyThemes) {
      updates.keyThemes.forEach(theme => {
        if (!profile.keyThemes.includes(theme)) {
          profile.keyThemes.push(theme);
        }
      });
    }
    // 合併正向錨定
    if (updates.positiveAnchors) {
      updates.positiveAnchors.forEach(a => {
        if (!profile.positiveAnchors.find(e => e.label === a.label)) {
          profile.positiveAnchors.push(a);
        }
      });
    }
    this.save(profile);
    return profile;
  },

  _default() {
    return {
      version: '1.0',
      userId: APP_STATE.userId,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      sessionCount: 0,
      stressors: [],
      triggers: [],
      copingProfile: { preferredStyle: '', effectiveMethods: [], ineffectiveMethods: [] },
      positiveAnchors: [],
      emotionalBaseline: { dominantMood: '', phq9Trend: [], hamdSignalCount: 0 },
      keyThemes: [],
      clinicianNotes: ''
    };
  }
};
```

---

### 🟡 第二層：記憶注入 Context（Memory Injection）
**優先度：高 | 工期：半天**

#### 功能說明
在每次 `sendMessage()` 送出前，自動把 Profile 摘要注入為 system context。

#### 注入格式（送給 AI 的隱藏前綴）

```
【記憶背景 - 不要直接念出這段】
你和這位用戶已聊過 {sessionCount} 次。
已知壓力來源：{stressors}
情緒觸發詞：{triggers}
溝通偏好：{copingProfile.preferredStyle}
積極錨點：{positiveAnchors}

請在本次對話中延續這個認識，不要問對方已說過的事情。
```

#### 實作位置
`app.js` → `sendMessage()` 的 `body` 組裝處，加入 `system_context` 欄位

---

### 🟠 第三層：AI 自動萃取更新（Auto-Extract on N turns）
**優先度：中 | 工期：1天**

#### 功能說明
每 **3 輪** 對話後，發送一個 side-call 給 AI：

```
【系統指令，不要對用戶顯示】
請分析以上對話，萃取以下 JSON 格式的心理線索：
{
  "stressors": [],
  "triggers": [],
  "keyThemes": [],
  "positiveAnchors": [],
  "copingStyleHint": ""
}
只回傳 JSON，不需要解釋。
```

#### 觸發時機
```
每 3 輪 AI 回覆 → 觸發 extractProfile()
                 → 送 side-call 給 /api/chat/message（hide_response: true）
                 → 解析 JSON → TherapeuticMemory.merge(result)
```

#### 流程圖
```
sendMessage() 成功後
    │
    ▼
turnCount++ (APP_STATE 新增)
    │
    ├── turnCount % 3 === 0 ?
    │         │
    │         YES ─▶ extractProfileFromConversation()
    │                    │
    │                    ▼
    │               POST /api/chat/message
    │               (訊息：萃取指令)
    │                    │
    │                    ▼
    │               TherapeuticMemory.merge(parsed)
    │
    └── (繼續一般對話)
```

---

### 🔵 第四層：FHIR 整合（跨診次醫療連續性）
**優先度：中（評審亮點） | 工期：1-2天**

#### FHIR Observation Mapping

| TherapeuticProfile 欄位 | FHIR Resource | code |
|---|---|---|
| `stressors` | `Observation` | `social-history` / `stress-source` |
| `triggers` | `Observation` | `emotional-trigger` |
| `copingProfile.preferredStyle` | `Observation` | `comms-preference` |
| `positiveAnchors` | `Observation` | `coping-resource` |
| `emotionalBaseline.phq9Trend` | `Observation` | `phq-9` |
| `keyThemes` | `Observation` | `clinical-impression` |

#### 傳輸時機
- 病人按下「授權傳送給醫師」按鈕時
- 報告生成（FHIR Draft）時自動附加

#### FHIR Bundle 範例
```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "resource": {
        "resourceType": "Observation",
        "code": { "coding": [{ "code": "stress-source", "display": "壓力來源" }] },
        "valueString": "學業壓力, 與媽媽的關係",
        "subject": { "reference": "Patient/user-xxxxxxxx" }
      }
    }
  ]
}
```

---

## 五、Reports 頁：心理畫像卡 UI

在 Reports 頁新增「**認識你**」區塊，展示目前累積的 Profile：

```
╔══════════════════════════════════╗
║  🧠 Rou Rou 認識你                ║
║  ─────────────────────────────  ║
║  已陪伴你 7 次對話                 ║
║                                  ║
║  📌 主要壓力                       ║
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
╚══════════════════════════════════╝
```

---

## 六、隱私與安全考量

| 考量 | 設計決策 |
|---|---|
| 資料存在哪裡 | 第一期：localStorage（純本地，無伺服器） |
| 病人能看到嗎 | 是。Reports 頁顯示「Rou Rou 認識你」卡 |
| 病人能修改嗎 | 是。提供「編輯 / 清除」按鈕 |
| 醫師能看到嗎 | 只有病人授權後，透過 FHIR 傳輸 |
| 資料加密 | 第二期：Web Crypto API 本地加密 |

---

## 七、開發里程碑

```
Week 1（現在可以開始）
  ✅ 第一層：TherapeuticMemory 模組 + localStorage 讀寫
  ✅ 第二層：Memory Injection 注入 sendMessage()

Week 2
  🔲 第三層：AI 自動萃取（每 3 輪）
  🔲 Reports 頁：心理畫像卡 UI

Week 3（評審前衝刺）
  🔲 第四層：FHIR Observation 輸出整合
  🔲 「認識你」卡編輯功能
```

---

## 八、評審亮點摘要

1. **醫療連續性**：跨診次的心理線索自動累積，不是一次性的資料
2. **主動式個人化**：不等病人說「記得我喜歡什麼」，AI 自己記住
3. **FHIR 標準化**：與台灣 TWCore 對接，可交換性強
4. **病人主權**：病人可以看到 AI 對自己的理解，並修正

---

*此文件為架構設計稿，實作前請與開發者確認 API 介面與 Flowise 節點支援狀況。*
