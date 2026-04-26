# HAM-D 臨床對話後處理器 優化文件

## 📅 更新日期
2026-04-27

## 🎯 核心目標

LLM 自由生成 → **唯一後處理器** → 最終輸出

允許 LLM 自由發揮，但最終輸出必須可控且可評分（HAM-D）。

---

## 🧠 架構

```
LLM（smartHunter prompt，自由生成）
    ↓
clinicalPostProcessor（唯一控制點）
    ↓
最終輸出（保證單問句 + 可評分 + 正確 item）
```

---

## 🔧 統一後處理器 `clinicalPostProcessor()`

位置：`app/aiCompanionEngine.js`

### 處理流程（優先順序）

| 層級 | 規則 | 動作 |
|------|------|------|
| 第 0 層 | 移除安慰句 | `stripComfortPhrases()` |
| 氣氛保護 | `atmosphereProtected = true` | 只做單問句，不介入 |
| 第 1 層 | **風險訊號最高優先** | 偵測到「不想活/想死/消失」→ 強制替換為安全確認問題 |
| 第 2 層 | 取得 `next_item` | `pickNextUnlockedItemCode(state)` |
| 第 3 層 | **系統閉嘴條件** | 問句可評分 + 命中正確 item + 有具體情境 → 完全不介入 |
| 第 4 層 | 介入策略 | 沒問句 → 補一題；問錯/不可評分/禁止類型 → **替換**（不追加）|
| 第 5 層 | 單問句規則 | `enforceSingleQuestion()` — 永遠只保留最後一個問句 |
| 防 crash | 任何錯誤 | catch → 強制 fallback probe |

---

## 📋 各判斷函式

### `shouldIntervene(draft, targetItemCode)`
```
介入 = 沒有問句 OR 問句不可評分 OR 問錯 item OR 禁止類型
```

### `isScoreableQuestion(question)`
問句必須包含以下任一：
- 頻率：一週幾天 / 幾乎每天 / 偶爾
- 時間：多久 / 持續多久
- 程度：輕微 / 明顯 / 嚴重
- 功能：影響工作 / 上課 / 日常事情

### `isCorrectItem(question, targetItemCode)`
問句必須同時：
1. 命中該 item 的症狀關鍵詞（`ITEM_SYMPTOM_KEYWORDS`）
2. 包含「具體情境」（`SPECIFIC_CONTEXT_KEYWORDS`）

### `enforceSingleQuestion(text)`
多問句 → 只保留最後一個，前面的問句全部移除

---

## 🚫 禁止類型（後處理攔截，不用 prompt 限制）

| 類型 | 範例 |
|------|------|
| coping | 怎麼調整 / 有什麼方法 |
| 開放反思 | 你怎麼看 / 為什麼 |
| 安慰邀請 | 願不願意 / 想不想 |
| 舒緩導向 | 有沒有什麼方法讓你好一點 |
| 泛問 | 感覺如何？ / 還好嗎？ |

---

## ⚠️ 風險訊號處理

偵測模式：
- 沒有意義 / 不想活 / 想消失 / 撐不下去 / 想死

→ 下一題必須優先轉為**安全確認問題**（`RISK_PROBE`）

---

## 🔇 系統閉嘴條件

若同時成立：
1. ✅ 問句可評分（`isScoreableQuestion`）
2. ✅ 問題正確（`isCorrectItem`）
3. ✅ 有具體情境

**→ 系統完全不介入**

---

## 📁 影響檔案

| 檔案 | 變更 |
|------|------|
| `app/aiCompanionEngine.js` | 新增 `clinicalPostProcessor`、`isCorrectItem`、`shouldIntervene`、`enforceSingleQuestion`，重構 `buildNaturalResponse` |

---

## ✅ 測試結果

- `aiCompanionEngine.test.js` — ✅ pass
- `fhirDeliveryServer.test.js` — ✅ pass
