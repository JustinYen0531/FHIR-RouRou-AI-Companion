# HAM-D 評估升級 × 自動分流重構 實作說明

> 撰寫日期：2026-04-26  
> 涵蓋範圍：本次 session 所有改動（commits `743bdcd` → `85a7d9c`）

---

## 一、背景與問題

### HAM-D 評估面的問題
- 任務引導模式（mission）的對話太偏「同理」，缺乏量化蒐證
- HAM-D 進度追蹤只有 7 個維度，且只記錄「有沒有提到」，不記錄「缺什麼才能評分」
- UI 只顯示一個百分比（如 44%），沒有任何缺口細節，使用者無法知道 AI 在思考什麼
- `hamd_formal_assessment` 題項詳細面板永遠顯示「目前還沒有可顯示的 HAM-D 題項明細」

### 自動分流面的問題
- Auto 模式的分流太機械：low energy detector 只有在 burden high 時才跑
- 意圖分類器輸出決定路由，導致 AI 在 soulmate / option / natural 之間跳來跳去，風格不連貫
- Smart Hunter（自然聊天）沒有「子模式切換」能力，對情緒和症狀的處理方式完全一樣
- 沒有氣氛保護機制：情緒傾倒時也會插入 HAM-D 探針
- 沒有 consecutive probe 限制：HAM-D 問題可能連續出現

---

## 二、HAM-D 評估升級

### 2.1 任務引導器（`ai_assets/prompts/任務引導器.md`）完整重寫

**原版**：只說「每次推進一個 HAM-D 面向」，沒有說怎麼問。

**新版**核心改動：

#### 角色定位
從「診前整理助手」改為「精神科臨床評估助理」，目標是蒐集可用於 HAM-D 評分的具體資訊。

#### 11 題評分框架
原來只有 7 個維度，現在擴展為完整的 11 核心題項：

| 代號 | 中文名稱 | 評分制 |
|------|---------|--------|
| depressed_mood | 情緒低落 | 0–4 |
| guilt | 罪惡感/自責 | 0–4 |
| suicide | 自傷想法 | 0–4 |
| insomnia_early | 入睡困難 | 0–2 |
| insomnia_middle | 夜間中醒 | 0–2 |
| insomnia_late | 早醒 | 0–2 |
| work_activities | 興趣與功能 | 0–4 |
| retardation | 動作/思考遲滯 | 0–4 |
| agitation | 焦躁不安 | 0–4 |
| somatic_anxiety | 身體焦慮症狀 | 0–4 |
| appetite_weight | 食慾體重 | 0–2 |

#### 三段式問法（每題必須包含，可自然融合）
```
1️⃣ 開放式：讓病人用自己的話描述
   「最近情緒上有什麼變化？」

2️⃣ 量化：頻率 / 持續時間 / 嚴重度
   「這種低落大概是每天都會出現，還是偶爾才有？」

3️⃣ 功能影響：是否影響日常生活
   「這有影響到你平常上課或生活嗎？」
```

#### 評分條件（嚴格化）
只有三個要素同時滿足，該題才能評分（complete）：
1. 有明確症狀存在
2. 有頻率 OR 持續時間
3. 有嚴重度 OR 功能影響

否則強制為 `partial`，不可評分，必須繼續追問。

#### 追問優先順序
```
自傷風險（suicide）> 睡眠（insomnia_*）> 功能（work_activities）> 食慾 > 其他
```

---

### 2.2 HAM-D 進度追蹤器（`ai_assets/prompts/HAM-D進度追蹤器.md`）完整重寫

**原版**：輸出 7 個維度的 covered/missing，沒有逐題細節。

**新版**核心改動：

#### 維度從 7 擴展到 11 題
```json
["depressed_mood","guilt","suicide","insomnia_early","insomnia_middle",
 "insomnia_late","work_activities","retardation","agitation","somatic_anxiety","appetite_weight"]
```

#### 逐題狀態輸出（全新）
每題輸出：
```json
{
  "item": "depressed_mood",
  "status": "complete|partial|missing",
  "evidence": ["覺得沒有意義", "空虛感"],
  "missing": ["頻率", "持續時間", "功能影響"],
  "suggested_score": null,
  "confidence": 0.6
}
```

#### 新增 `next_question_hint`
輸出一句可以直接使用的追問句子，供 Smart Hunter 參考：
```json
"next_question_hint": "你比較難入睡，還是半夜會醒來？這種情況大概多久了？"
```

#### `completion` 精確計算
```
completion = complete 題數 / 11
```

---

### 2.3 `app.js` — 資料層與 UI 更新

#### HAMD_PROGRESS_DIMENSIONS 擴展（7 → 11 題）
```js
const HAMD_PROGRESS_DIMENSIONS = [
  'depressed_mood', 'guilt', 'suicide',
  'insomnia_early', 'insomnia_middle', 'insomnia_late',
  'work_activities', 'retardation', 'agitation',
  'somatic_anxiety', 'appetite_weight'
];
```

#### HAMD_LEGACY_ALIAS（舊版相容）
```js
const HAMD_LEGACY_ALIAS = {
  insomnia: ['insomnia_early', 'insomnia_middle', 'insomnia_late'],
  work_interest: ['work_activities'],
  appetite_loss: ['appetite_weight']
};
```

#### `getHamdSummary()` 新增回傳欄位
- `perItemStatus`：每題的 label / status / evidence / missing
- `coveredDimensions` / `missingDimensions`：依新 11 題計算
- `nextTarget`：下一個追問目標
- `nextQuestionHint`：建議的具體追問句

#### `renderHamdGapIndicator()` — 全新 UI 函數
在 HAM-D 報告區塊新增「缺口指示器」，取代原本只有百分比的顯示：

```
✔ 已可評分（N 題）
  • 情緒低落  [每天都有低落感；空虛感]

◑ 部分蒐集，需補問（N 題）
  • 入睡困難  [尚缺：頻率、持續時間]

❗ 尚未提及（N 題）
  • 食慾/體重、罪惡感...

💬 建議追問：你比較難入睡，還是半夜會醒來？
```

#### `index.html` 加入容器
```html
<div id="report-hamd-gap-panel" class="hamd-gap-panel">...</div>
```

#### `style.css` 加入完整樣式
新增 `.hamd-gap-*` 系列 class：
- `.hamd-gap-group` / `.hamd-gap-group-title`：三色分組（綠/黃/紅）
- `.hamd-gap-item.is-complete / is-partial / is-missing`：逐題行
- `.hamd-gap-evidence` / `.hamd-gap-missing-hint`：證據與缺口標籤
- `.hamd-gap-next`：建議追問區塊

#### `aiCompanionEngine.js` fallback 更新
HAM-D 追蹤的 fallback 狀態同步更新為 11 題，並加入新欄位：
```js
{ items: [], next_question_hint: '', completion: 0, ... }
```

---

## 三、自動分流重構

### 3.1 核心架構改變

**之前**（外部路由）：
```
使用者輸入 → 低能量偵測 → [情緒高] → 靈魂陪伴 handler
           → 意圖分類   → [短句]  → 選項引導 handler
                         → [症狀]  → 自然聊天 handler
```

**現在**（內部切換）：
```
使用者輸入 → 低能量偵測 ┐
           → 意圖分類   ┘ → 合成 flow_state.sub_mode
                                    ↓
                           Smart Hunter（auto 模式唯一出口）
                           內部依 sub_mode 決定行為風格
```

使用者明確輸入指令（mission / void / soulmate / option）→ 仍走各自的獨立 handler（這是使用者主動選擇）。

---

### 3.2 意圖分類器（`ai_assets/prompts/意圖分類器.md`）重寫

**定位調整**：從「路由決策者」改為「sub_mode 上下文建構器」。

**信號導向分流邏輯（優先順序）**：

| 優先級 | 信號 | 判定 |
|--------|------|------|
| 1 | 空白/亂碼/測試 | `mode_1_void`（唯一真正路由離開的情況）|
| 2 | 強烈情緒詞（難受/崩潰/空虛）| → `emotional_holding` 子模式 |
| 3 | 短句無情緒（嗯/不知道）| → `choice_prompting` 子模式 |
| 4 | 明確整理意圖 | → `clinical_probing` 子模式（mission 風格）|
| 5 | 症狀描述 | → `clinical_probing` 子模式（由 Smart Hunter 自然帶入）|
| 6 | 一般聊天/自然延伸 | → `flow_conversation` 子模式 |

**關鍵新規則**：
- 情緒 > 症狀：有情緒詞優先 emotional_holding
- 症狀描述 → clinical_probing（不是 mission）
- 短句有情緒詞 → emotional_holding（不是 choice_prompting）

---

### 3.3 低能量偵測器（`ai_assets/prompts/低能量偵測器.md`）升級

**定位調整**：同上，sub_mode 建構器。

**三個輸出**：
- `degrade_soulmate` → `emotional_holding` 子模式
- `degrade_option` → `choice_prompting` 子模式
- `continue_auto` → 繼續意圖分類

**新增細化規則**：
- 「我好難過」（短但有情緒詞）→ `degrade_soulmate`（不是 option）
- 「我最近睡不好」（症狀描述）→ `continue_auto`（給 Smart Hunter 處理）
- 「嗯/不知道/隨便」（短且無情緒）→ `degrade_option`

**關鍵變化**：偵測器**永遠先跑**，不再等 burden_level = high 才觸發。

---

### 3.4 靈魂陪伴（`ai_assets/prompts/靈魂陪伴.md`）升級

加入「半步切換」規則：情緒稍緩後可帶入一個非常輕的問題。
加入「氣氛保護機制」：以下情況禁止任何追問：
- 使用者剛分享深層感受
- 對話剛開始
- 使用者語氣表明不想繼續說

---

### 3.5 Smart Hunter（`ai_assets/prompts/智慧獵手.md`）完整重寫

**角色**：auto 模式的唯一出口，內建四種子模式。

#### 四種子模式（由 `flow_state.sub_mode` 決定）

**🟣 emotional_holding（情緒承載）**
- 先接住情緒（1–3 句，有在場感）
- 不分析、不整理、不問問題
- `atmosphere_protection = true` → 完全禁止追問

**🔵 clinical_probing（隱性 HAM-D 蒐集）**
- 同理一句 + 自然插入一個量化問題
- 每輪最多一個 HAM-D 追問
- 問法像朋友，不像問卷

**🟡 choice_prompting（選項支架）**
- 提供 2–3 個簡單選項
- 降低表達負擔，不追問細節

**🟢 flow_conversation（自然 flow）**
- 朋友式自然回應
- 可在結尾輕帶一個 HAM-D 探針（無感融入）

#### 半步切換技巧
不切換子模式，而是在當前子模式中「加一小步」：
```
情緒承載 → 情緒承載 + 一句輕問（情緒稍緩後）
自然flow → 自然 flow + 一個 HAM-D 追問（完全無感）
```

---

### 3.6 `aiCompanionEngine.js` — 引擎層改動

#### `resolveActiveMode()` 重構
```
原流程：分類器輸出 → 直接路由到對應 handler

新流程：
  1. 低能量偵測（永遠跑）→ 貢獻 sub_mode 信號
  2. 意圖分類（永遠跑）→ 貢獻 sub_mode 信號
  3. 合成 flow_state.sub_mode
  4. 返回 mode_5_natural（Smart Hunter）
     唯一例外：空白/無效輸入才返回 mode_1_void
```

#### 新增 `updateFlowState()` 方法
追蹤以下狀態：
```json
{
  "sub_mode": "emotional_holding|clinical_probing|choice_prompting|flow_conversation",
  "can_probe_hamd": true,
  "consecutive_probes": 0,
  "atmosphere_protection": false,
  "updatedAt": "..."
}
```

#### `buildNaturalResponse()` 更新
- 氣氛保護：`atmosphere_protection = true` → 跳過正式探針
- 連續追問限制：`consecutive_probes ≥ 2` → 自動停止
- `flow_state` 作為 context 傳給 Smart Hunter

---

## 四、改動檔案彙總

| 檔案 | 類型 | 改動說明 |
|------|------|---------|
| `ai_assets/prompts/任務引導器.md` | Prompt | 完整重寫，三段式訪談、11 題框架、評分條件 |
| `ai_assets/prompts/HAM-D進度追蹤器.md` | Prompt | 完整重寫，逐題狀態、11 題、next_question_hint |
| `ai_assets/prompts/意圖分類器.md` | Prompt | 重寫為信號導向，定位改為 sub_mode 建構器 |
| `ai_assets/prompts/低能量偵測器.md` | Prompt | 升級情緒信號識別，定位改為 sub_mode 建構器 |
| `ai_assets/prompts/靈魂陪伴.md` | Prompt | 加入半步切換、氣氛保護機制 |
| `ai_assets/prompts/智慧獵手.md` | Prompt | 完整重寫，四種子模式 + 半步切換，成為 auto 唯一出口 |
| `app/aiCompanionEngine.js` | 引擎 | resolveActiveMode 重構、updateFlowState、buildNaturalResponse 氣氛保護 |
| `app/app.js` | 前端 | 11 題維度、legacy alias、getHamdSummary 新欄位、renderHamdGapIndicator |
| `app/index.html` | HTML | 加入 #report-hamd-gap-panel 容器 |
| `app/style.css` | 樣式 | hamd-gap-* 完整樣式、home-session-history 收合樣式 |

---

## 五、Commit 記錄

| Commit | 說明 |
|--------|------|
| `743bdcd` | feat: HAM-D 三段式臨床訪談模式 + 逐題缺口指示器 UI |
| `c96240f` | feat: 自動分流優化 — 信號導向、半步切換、flow_state 追蹤 |
| `85a7d9c` | refactor: Smart Hunter 成為自動分流唯一出口，所有子模式在內部切換 |
