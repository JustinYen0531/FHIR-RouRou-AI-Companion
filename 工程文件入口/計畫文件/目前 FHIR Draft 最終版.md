# 目前 FHIR Draft 最終版

更新日期：`2026-04-30`

## 一句話結論
這一輪 `FHIR Draft` 的最終收斂，不再只是把資源「送得出去」，而是把整條交付鏈整理成：  
**資料來源更清楚、摘要內容更可讀、各資源分工更合理、FHIR delivery gating 更穩、病人與醫師流程也更能接得上。**

---

## 這一版最重要的變化

### 1. FHIR draft 不再只是空骨架
先前最大問題是：

- 有 `resource`
- 有 `bundle`
- 有 `JSON`
- 但內容像草稿、像拼貼、像 placeholder

這一輪之後，重點已經從「會不會生」轉成「生出來的東西像不像正式交付草稿」。

最明顯的改變包括：

1. `QuestionnaireResponse` 不再只是塞原始句子，而是開始做 `recent_evidence` 清洗、去掉操作句、過短句與重複句。
2. `Observation` 不再只是一個抽象訊號殼，`valueString` 已改成較可讀的臨床摘要句。
3. `ClinicalImpression` 不再停在資源宣告，而是真的進 bundle，並且改成較保守的 `preliminary` 臨床印象。
4. `Composition` 已從雜亂摘要進步到有 section 分工的正式文件骨架，同時開始控制重複與過重警示語氣。
5. `DocumentReference` 已分成 readable summary 與 internal trace payload 兩層，不再把所有內容混成一包。
6. `Provenance` 已開始能清楚說明 AI 生成、病人審閱、來源 session 與交付治理。

---

## 資源層的最後收斂

### 1. Patient
這一輪不再讓 `Patient` 停留在 placeholder 殼，而是往「可展示的人物輪廓」收斂。

主要變化：

1. 病人基本資料不再只是 demo user 影子，而是能接真實 profile 欄位。
2. 病人 profile intake 正式接進 FHIR draft。
3. refresh 時會優先用最新病人資料重建 builder 輸出，而不是沿用舊草稿。

代表 commits：

- `53a5f58` Improve patient draft defaults
- `3de87ee` feat: wire patient profile intake into FHIR draft
- `ab1a7e4` fix: refresh patient using latest profile data
- `5c3197f` fix: sync patient profile into fhir drafts

### 2. Encounter
這一輪把 `Encounter` 從「看起來像系統時間戳」收斂成「比較像正式照護接觸記錄」。

主要變化：

1. `status` 改為 `finished`，不再用 `in-progress` 模糊帶過。
2. `period.start/end` 分開，對話時間區間語意更清楚。
3. 補上 `serviceType`，讓 encounter 的照護情境更完整。

代表 commits：

- `38b70e4` fix(Encounter): status 改為 finished 預設、period 分離 sessionStartedAt/sessionEndedAt、補 serviceType

### 3. QuestionnaireResponse
這一輪的核心不是多塞欄位，而是把內容從髒、碎、重複，整理成可被後續資源承接的問卷層。

主要變化：

1. `recent_evidence` 開始套用清洗規則。
2. 操作句、求助句、過短句、重複句會被排除。
3. PHQ-9 與病人自評資料開始正式進入 structured drafts 與 FHIR 流程。

代表 commits：

- `28d2f35` fix(QR): recent_evidence 套用清洗規則，移除操作句/求助句/過短句/重複句，上限5筆
- `11c5549` Align QuestionnaireResponse notes with actual test payload
- `c24ebb4` Add PHQ-9 dual-track assessment flow
- `925cd04` Integrate PHQ-9 into structured drafts

### 4. Observation
這一輪把 `Observation` 從「有 signal」收斂成「人類看得懂這在觀察什麼」。

主要變化：

1. `valueString` 改成可讀的臨床摘要句。
2. `note` 開始限制數量並搭配 `cleanEvidence`。
3. `Observation` 開始更像 symptom summary 的正式承接層，而不是對話碎句容器。

代表 commits：

- `f581b3a` fix(Observation): valueString 改為可讀臨床摘要句，note 上限2筆並套用cleanEvidence

### 5. ClinicalImpression
這一層是這輪最關鍵的成熟點之一，因為它直接碰到「AI 會不會過度診斷」的邊界。

主要變化：

1. `ClinicalImpression` 真正進 bundle，不再只停在 draft 宣告。
2. `description` 改得更保守。
3. `finding` 開始各自綁定 `basis`。
4. `note` 補進風險標記。
5. `status` 改為 `preliminary`，降低過滿語氣。

代表 commits：

- `e7a092f` Fix HAPI ClinicalImpression delivery status
- `e197c47` fix(ClinicalImpression): description保守化、finding各自綁basis、note加風險標記、status改preliminary

### 6. Composition
這一輪的 `Composition` 已經不只是有 section，而是開始懂得哪些 section 該收、哪些語氣該保守。

主要變化：

1. `section` 去重並限制上限。
2. `Safety` 語氣改得更保守。
3. `clinicalAlerts` 只有在真的有 evidence 時才加入。
4. `entry` 只放非風險 `Observation`，避免把不該放的內容全部塞進文件。

代表 commits：

- `f8091ea` fix(Composition): section去重上限、Safety保守化、clinicalAlerts有evidence才加、entry只放非風險Observation

### 7. DocumentReference
這一輪把 `DocumentReference` 從「有附檔」升級成「知道什麼給人看、什麼留給系統追」。

主要變化：

1. readable summary 與 internal trace payload 分離。
2. 補上和 `Composition` 的 `relatesTo` 關聯。
3. 附件開始有分層用途，而不是單純 payload 打包。

代表 commits：

- `68c758d` fix(DocumentReference): 分離閱讀版與internal trace payload，補relatesTo關聯Composition

### 8. Provenance
這一輪的 `Provenance` 不再只是 technical trace，而是開始長出治理語言。

主要變化：

1. `location` 改成人類可讀的 session 說明。
2. 補上 `patient-reviewer agent`。
3. `entity` 改得更白話。
4. `reason` 補進治理說明，而不是只剩技術來源。

代表 commits：

- `811826b` fix(Provenance): location改可讀session說明、補patient-reviewer agent、entity人話描述、reason加白話治理說明

---

## 交付流程層的最後收斂

除了 resource 內容本身，這一輪其實還做了另一條很重要的事：  
把「FHIR 交付到底穩不穩」這件事，從靠感覺改成靠 gating、quick check、validator 與 refresh flow 控制。

### 1. draft / bundle / validator / UI 一致性

主要變化：

1. `FHIR draft.resources` 收斂成目前真的會輸出的資源。
2. draft、bundle builder、validator、sample output 開始對齊。
3. 不再放任 prompt 宣告未實作資源混進交付草稿。

代表 commits：

- `92276d0` Align FHIR draft and bundle delivery resources
- `8c79630` fix: align fhir bundle statuses with validator

### 2. delivery gating 與 quick check

主要變化：

1. 補強 auth / readiness state normalization。
2. 新增一鍵 FHIR delivery quick check。
3. runtime key 優先讀 `.env.local`，降低環境配置失誤。

代表 commits：

- `1905704` fix: normalize auth/readiness states for FHIR delivery gating
- `6f54f2c` feat: add one-click FHIR delivery quick check
- `8819530` fix: prefer .env.local runtime keys over inherited env

### 3. refresh / rebuild / persistence

主要變化：

1. 新增 patient-only FHIR refresh flow。
2. refresh 時會檢查是否真的用最新 profile 重建 builder 輸出。
3. FHIR history 已可 preview，不再只是存在而已。

代表 commits：

- `69d1e57` Add patient-only FHIR refresh flow
- `eba7211` fix: verify patient refresh rebuilds builder output
- `6260575` feat: add preview for fhir history entries

### 4. delivery hardening

主要變化：

1. 送出流程不再只求能送，而是開始處理 HAPI status、validator 對齊與 submission 穩定性。
2. 病人資料、FHIR draft、bundle 狀態開始更一致。

代表 commits：

- `baf56f1` fix: harden fhir submission delivery
- `e7a092f` Fix HAPI ClinicalImpression delivery status

---

## 和早期版本相比，這一版真正進步在哪裡

### 早期版本比較像

1. 有 draft，但內容偏像對話拼貼。
2. 有 resource，但醫師不一定看得懂重點。
3. 有交付流程，但 readiness、refresh、validator 還不夠穩。
4. 有治理資源，但語言還偏工程、偏技術。

### 現在的版本比較像

1. `QuestionnaireResponse -> Observation -> ClinicalImpression -> Composition -> DocumentReference -> Provenance` 這條鏈開始有各自的分工。
2. FHIR 資源不只結構合法，內容也開始有臨床可讀性。
3. 病人 profile、PHQ-9、自評摘要已能接進交付鏈。
4. delivery gating、quick check、refresh flow、validator 對齊後，整條交付比較穩。
5. 資料不再只是「會上傳」，而是比較接近「可以展示、可以解釋、可以答辯」。

---

## 這一版可以明確說已完成的收斂

1. `FHIR Draft` 從 placeholder 式草稿，進步到有內容品質意識的交付中介層。
2. `ClinicalImpression`、`Composition`、`DocumentReference`、`Provenance` 不再只是為了湊資源，而是各自長出臨床、文件與治理角色。
3. `Patient / Encounter / QuestionnaireResponse / Observation` 已不再只是底層骨架，而能支撐上層摘要與交付。
4. `FHIR delivery` 已不只追求能送，而是開始講一致性、穩定性與可檢查性。
5. 整個系統從「AI 對話輸出」真正往「病人可確認、醫師可閱讀、FHIR 可交付」的方向走完一大段。

---

## 目前版本的合理定位

這份最終版不代表：

- 已完全達到正式醫院上線等級
- 已完整處理所有 TW Core / production compliance 細節
- 已完全消除所有內容品質風險

這份最終版代表的是：

**在決賽 / PoC / 展示層級下，FHIR Draft 已經從工程原型，收斂成一套有資料流邏輯、有資源分工、有交付治理概念的可展示版本。**

---

## 一句話總結

這一輪 `FHIR Draft` 最終版最大的意義，不是又多了幾個資源，而是：  
**你把原本只是「AI 能吐 FHIR」的系統，收斂成「AI、病人、醫師三方都比較站得住位置的 FHIR 交付流程」。**

