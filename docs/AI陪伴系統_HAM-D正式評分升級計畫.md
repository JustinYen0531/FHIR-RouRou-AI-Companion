# AI 陪伴系統 HAM-D 正式評分升級計畫

## 1. 文件目的

本文件說明本專案如何從原本的 `HAM-D 線索追蹤`，升級為較正式、可供醫療端審閱的 `HAM-D 題項級評分草稿流程`。

這份文件的重點不是宣稱系統已經變成最終醫療量表系統，而是清楚說明：

- 為何要升級
- 升級後資料怎麼表示
- Smart Hunter 如何補正式題項
- 證據如何分型
- clinical draft 如何處理
- FHIR 如何承接這些正式草稿

---

## 2. 為何要從線索追蹤升級

原本的 `hamd_progress_state` 可以追蹤：

- 目前觸及哪些 HAM-D 維度
- 哪些維度尚未覆蓋
- 下一輪最值得追問的面向

但它仍偏向「症狀線索整理」，而不是正式題項級評估。若要讓醫師更容易使用，系統需要補上：

- 題項級分數草稿
- 每題的證據摘要
- 這題是病人直接回答還是系統間接觀察
- 哪些題目需要人工覆核

因此，本次升級新增 `hamd_formal_assessment`，讓系統能同時保留：

- 輕量追蹤：`hamd_progress_state`
- 正式草稿：`hamd_formal_assessment`

---

## 3. 正式 HAM-D 草稿的核心設計

### 3.1 正式題項級狀態

新增的 `hamd_formal_assessment` 會保存：

- `scale_version = HAM-D17`
- `status`
- `assessment_mode`
- `recall_window`
- `items`
- `ai_total_score`
- `clinician_total_score`
- `severity_band`
- `review_flags`

### 3.2 每題保存的資料

每一題至少包含：

- `item_code`
- `item_label`
- `scale_range`
- `evidence_type`
- `direct_answer_value`
- `ai_suggested_score`
- `clinician_final_score`
- `evidence_summary`
- `rating_rationale`
- `confidence`
- `review_required`

---

## 4. Smart Hunter 如何做低干擾正式探針

在自然聊天模式 `Smart Hunter` 中，系統不會突然切成整頁問卷，而是：

1. 先用 `hamd_progress_state` 判斷目前缺少哪個維度
2. 再對應到正式 HAM-D 題項
3. 每次只插入一題自然語氣的正式探針
4. 將病人回應映射回正式 HAM-D 分制

這些探針的原則是：

- 每次最多一題
- 問法自然、不僵硬
- 不使用自訂 `1-10` 分
- 保留正式 HAM-D 原始分制概念

---

## 5. 證據分型規則

正式 HAM-D 草稿中的每一題，都要標示證據類型：

### 5.1 `direct_answer`

病人直接回答頻率、程度或量表導向內容。

例如：

- 「幾乎每天都睡不好」
- 「這週常常覺得很自責」

### 5.2 `indirect_observation`

主要來自對話互動中的觀察，而不是病人直接自評。

例如：

- 回應變慢
- 語句縮短
- 坐立不安感

### 5.3 `mixed`

同時包含病人直接回答與系統互動觀察。

例如：

- 病人表示提不起勁，同時系統也觀察到活動與興趣下降

這樣的設計能讓醫師明確知道：

- 哪些題目較可靠地來自病人自述
- 哪些題目主要來自 AI 觀察
- 哪些題目需要人工覆核

---

## 6. Clinical Draft 如何處理

升級後的 `clinician_summary_draft` 會新增：

- `hamd_item_scores`
- `hamd_total_score_ai`
- `hamd_total_score_clinician`
- `hamd_severity_band`
- `hamd_evidence_table`
- `hamd_review_required_items`

這表示醫師端摘要不再只有「有 HAM-D 線索」，而是每一題都能看到：

- 建議分數
- 最終分數是否已確認
- 證據類型
- 證據摘要
- 評分理由

若尚未有臨床確認，則維持 draft 性質，不當作正式最終量表結果。

---

## 7. FHIR 如何承接正式 HAM-D 草稿

本次第一階段不是直接做醫院正式版 payload，而是先讓 FHIR draft 能承接正式題項級內容。

### 7.1 QuestionnaireResponse

承接逐題草稿，包括：

- 題項代碼
- direct / AI suggested / clinician final
- 證據摘要

### 7.2 Observation

承接：

- 各題建議分數
- 總分
- 嚴重度
- review-required 題目

### 7.3 Composition

醫師摘要中納入：

- HAM-D evidence table
- 需覆核題項

### 7.4 Provenance

保留：

- AI 建議分數
- 臨床尚未確認
- 病人授權狀態

---

## 8. 第一階段與第二階段差異

### 第一階段

- 建立正式 HAM-D 題項級草稿
- 建立 direct / indirect / mixed 分型
- 建立 Smart Hunter 單題探針
- clinical draft 題項化
- FHIR draft 可帶正式草稿欄位

### 第二階段

- 醫師覆核 UI
- `clinician_final_score` 正式操作流程
- 鎖版、簽署、版本控管
- 更正式的醫院端 FHIR 對接

---

## 9. 結論

本次升級的目的，不是讓 AI 直接取代臨床評分，而是把原本鬆散的 HAM-D 線索整理，提升成較正式、可追溯、可審閱的題項級草稿。

這樣的設計能同時兼顧：

- 病人端自然互動
- 醫師端可讀性
- 後續正式臨床覆核
- FHIR / TW Core 導向的資料交換
