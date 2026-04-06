# FHIR 草稿摘要輸出調整說明

## 文件目的
這份文件說明 RouRou 在 `FHIR 草稿` 與相關摘要輸出上的近期調整，重點是記錄：

- 為什麼原本的摘要輸出不夠好
- 這次實際改了哪些邏輯
- 改完後預期會看到什麼差異
- 哪些地方之後還可以繼續加強

---

## 原本的問題
先前的 FHIR 草稿摘要雖然已經能產出結構，但內容品質有幾個明顯問題：

- 容易只抓最後一句話，忽略前面整段對話脈絡
- `symptom_observations` 常常直接貼上病人的原句，像逐字稿，不像整理
- `composition_sections` 常出現 `待補...` 這種 placeholder
- `observation_candidates` 與 `questionnaire_targets` 常常太空，資訊密度不足
- `summary_draft_state` 有時候還會出現「目前沒有具體症狀」這類舊 fallback，和前面摘要互相矛盾

這些問題會讓整份 FHIR 草稿看起來像：

- 有欄位
- 有 JSON
- 但沒有真正把病人的敘述整理成臨床可讀內容

---

## 這次改動的核心方向
這次不是只調 prompt，而是直接重做草稿生成的核心邏輯，方向改成：

**先從整段對話抽取症狀與功能證據，再把證據整理成 FHIR 草稿摘要。**

也就是說，現在不是先相信模型自由發揮，而是先由程式做一輪較穩定的整理，再把結果組成：

- 醫師摘要草稿
- 給病人的分析
- FHIR 交付草稿

---

## 已實作的重點變更

### 1. 不再只關注最後一句
草稿生成現在會優先讀取整段 session 內較近期、但仍屬於真正對話內容的訊息，而不是只看最後一句。

同時：

- 模式切換
- 快捷鍵
- 輸出操作

這些控制訊號不會再污染 FHIR 草稿摘要。

---

### 2. 對話會先被轉成整理句，而不是直接照抄
針對較常見的臨床線索，系統現在會先做規則式整理，例如：

- 持續低落、空虛或失去意義感
- 自我評價矛盾與人際敏感
- 迴避、盜汗與惡夢等創傷式反應
- 睡眠與生理症狀困擾
- 作息失調與日夜顛倒
- 依賴菸酒協助入睡
- 工作或日常功能受損

這代表 `symptom_observations` 不再只是把病人的長句複製進去，而是會轉成比較像：

- 可讀的症狀整理句
- 可用於交付的觀察描述
- 後續可映射 FHIR 的輸出內容

---

### 3. 醫師摘要草稿改成以證據整理為主
`clinician_summary_draft` 目前會優先整合：

- `chief_concerns`
- `symptom_observations`
- `hamd_signals`
- `followup_needs`
- `safety_flags`
- `draft_summary`

這些欄位現在比較偏「整理後的摘要」，而不是模板句或泛泛而談的空話。

---

### 4. FHIR 草稿的 section 不再只留 placeholder
`fhir_delivery_draft` 裡的重點欄位已改成會主動填入內容：

- `narrative_summary`
- `composition_sections`
- `observation_candidates`
- `questionnaire_targets`

目前的設計會直接把對話中已抓到的症狀與功能影響，整理進：

- `chief_concerns`
- `symptom_timeline`
- `functional_impact`
- `care_goal`

所以不應再一直看到：

- `待補主要困擾`
- `待補症狀與時間線`
- `待補功能受損與日常影響`

這種像沒生成完成的內容。

---

### 5. `observation_candidates` 與 `questionnaire_targets` 會跟證據連動
先前這兩塊很容易空掉，現在改成會直接根據已抓到的 signal 來填：

- `depressed_mood`
- `insomnia`
- `somatic_anxiety`
- `guilt`
- `work_interest`

並且附上對應的整理句，避免只剩下一個抽象標籤。

---

### 6. 拔掉會自打臉的舊 fallback
這次也特別修掉一個很煩的問題：

前面明明抓到了很多內容，`summary_draft_state.draft_summary` 卻還可能寫成：

- 目前沒有顯示出任何具體的症狀或需求

現在這條舊 fallback 已經被壓掉，摘要主幹會優先使用真正從整段對話整理出的內容。

---

## 改完後預期差異
如果病人在對話裡說了較完整的內容，現在生成的 FHIR 草稿應該會比之前更接近：

- 有主訴重點
- 有症狀整理
- 有功能影響
- 有後續需要補問或複核的方向

而不是只剩：

- 最後一句
- 逐字稿片段
- 模板式空話
- placeholder 欄位

---

## 目前仍然不是最終完成版的地方
雖然這次已經比先前好很多，但仍有幾個可繼續提升的方向：

- 更細的時間軸整理
- 更明確的症狀嚴重度推估
- 更穩定的人際、自我價值與創傷線索分類
- 更接近正式 FHIR resource mapping 的 section 設計
- 對睡眠、生理症狀與精神症狀的分流註記

也就是說，這次比較像是把「摘要骨架」先修成能看、能用、能交付，而不是已經到最終醫療文件品質。

---

## 相關程式位置
本次調整主要集中在：

- [app/aiCompanionEngine.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/aiCompanionEngine.js)

對應的兩次重要修改 commit：

- `06972c8`：重置草稿生成方向，改成先抽取證據再整理摘要
- `1c882be`：補強三刀，讓摘要不再照抄、FHIR section 不再留白、舊 fallback 不再互相打架

---

## 一句話總結
這次 FHIR 草稿摘要輸出的重點改動是：

**從「把對話塞進欄位」改成「先整理整段對話，再輸出成可讀、可交付的 FHIR 草稿摘要」。**
