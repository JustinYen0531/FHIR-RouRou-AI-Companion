# 目前 FHIR Draft 待補強問題

更新日期：`2026-04-24`

## 目前狀態判讀

### 已經做對的部分
1. `Patient / Encounter / QuestionnaireResponse / Observation / ClinicalImpression / Composition / DocumentReference / Provenance` 已完整建立。
2. 各資源 reference 關係成立，表示 bundle 骨架正確。
3. 有授權狀態、review extension、Provenance，代表流程上已有最小治理概念。
4. 已可成功送到 `https://hapi.fhir.org/baseR4`，代表交換鏈不是假的。
5. `Patient` 與 `Encounter` 已完成一輪正式測試驗證，成熟度已明顯提升到可展示層級。
6. `QuestionnaireResponse` 已經開始具備病人審閱、授權提示與後續問卷目標整理的流程完整度。
7. `Observation` 已具備可讀的症狀摘要句、來源鏈結與審閱授權 extension，不再只是抽象訊號殼。
8. `ClinicalImpression` 已能接上 `QuestionnaireResponse` 與 `Observation`，開始具備真正的臨床印象草稿樣貌。
9. `Composition` 已具備多 section 正式摘要文件樣貌，開始能承接臨床摘要、病人審閱與交付阻塞說明。
10. `DocumentReference` 已開始做 readable summary 與 internal trace payload 分層，具備正式交付與可追溯設計概念。
11. `Provenance` 已能追蹤整個交付鏈，並清楚表達病人授權與生成來源，治理感明顯提升。

### 目前最明顯的缺口
1. `ClinicalImpression.description` 與 `Composition` 內文仍有過度推論風險。
2. `QuestionnaireResponse.item` 混入太多原始碎句、重複句、操作句。
3. `Observation` 可送出，但內容太薄，醫師看不出重點。
4. `DocumentReference` 雖然保留完整 payload，但 payload 本身仍偏髒。
5. 展示版本仍需要額外的去識別包裝，避免正式測試資料直接上台。

---

## 各層待補強問題

### 1. Patient 層
> 註：以下多數是早期版本的缺口。到 `2026-04-24` 的正式測試版為止，`Patient` 結構完整度已明顯改善，現在主要剩下的是「決賽展示時要不要改成去識別版」。

#### 目前問題
1. 正式測試版已能帶出真實病人欄位，但展示版若直接使用，會有個資暴露風險。
2. `contact.relationship` 目前可讀，但若要追求更嚴謹的 FHIR 味道，仍可再補 coding。

#### 為什麼要修
1. 現在不是「送不出去」，而是要讓正式測試成果在決賽呈現時更安全、更漂亮。
2. 評審若看到真實資料雖然會覺得完整，但也可能反問隱私與展示治理。

---

### 2. Encounter 層
> 註：這一層在 `2026-04-24` 的正式測試版已經改善很多，目前主要是把成果寫清楚，讓答辯時能直接拿來講。

#### 目前問題
1. 舊版曾有 `period.start` 與 `period.end` 幾乎相同的問題，會看起來像系統生成時間。
2. 舊版 `status = in-progress` 和已完成交付情境不一致，現在正式測試版已改善為 `finished`。

#### 為什麼要修
1. `Encounter` 是評審最容易秒懂的流程型資源，語意對了，整個系統成熟度就會一起被抬高。
2. 現在這層已經變成可以拿來加分的地方，不該讓文件還停在舊狀態。

---

### 3. QuestionnaireResponse 層
> 註：這一層到 `2026-04-24` 的正式測試版為止，也已經明顯比早期成熟很多。現在不是完全不能看，而是還可以再往更精簡、更像臨床摘要的方向推。

#### 目前問題
1. `depressed_mood.answer` 目前仍是 `Observed via AI companion conversation.`，合法但偏泛，不夠像真正可讀的臨床證據句。
2. `recent_evidence` 雖然已改成高訊號欄位，但目前只有 `出現持續低落或失去意義感的描述`，仍偏抽象。
3. `patient_confirm_*` 中有明顯同義重複，例如低落/失去意義感的描述被拆成多題重複確認。
4. `phq9_total_score = 0` 與整體低落敘述並列時，展示上容易被問「這是未填、無症狀，還是暫無有效 PHQ-9 結果」。
5. `questionnaire_target_*` 與 `patient_editable_*` 已經有流程價值，但語句風格仍略混雜，還不夠統一。

#### 為什麼要修
1. `QuestionnaireResponse` 應該是結構化問答或證據整理，不是逐字稿垃圾桶。
2. 這份資源現在的強項是流程完整，但如果內容文字再更精煉，評審會更容易同時看到「流程感」和「臨床可讀性」。

---

### 4. Observation 層
> 註：這一層到 `2026-04-24` 的正式測試版為止，也明顯成熟很多。它現在的強項是「可讀性」與「流程來源鏈」都有了，但還有機會再把內容補得更厚。

#### 目前問題
1. `valueString = reports persistent low mood` 已經比早期好很多，但仍偏短，還可以再更具體一些。
2. 目前沒有 `note` 保留代表性 evidence，所以雖然可讀，但證據厚度仍偏薄。
3. 目前只呈現一個 `depressed_mood` observation，若要展示完整 symptom map，之後可能還需要更多維度一起出來。
4. `method = AI companion conversation extraction` 已有交代來源，但若未來要更正式，還可再補得更標準化。

#### 為什麼要修
1. 結構合法不等於人類可讀。
2. 現在雖然已經比 `supported signal` 時代好很多，但若要更像正式臨床草稿，還需要把觀察句與證據再補厚一點。

---

### 5. ClinicalImpression 層
> 註：這一層到 `2026-04-24` 的正式測試版為止，已經從「FHIR 裡有這個資源」進步到「看起來像一份真的臨床印象草稿」。但同時它也是目前最容易被評審細挑的一層，因為內容品質問題已經比骨架問題更突出。

#### 目前問題
1. `status = completed` 對 AI 生成草稿來說偏滿，若拿去展示，容易被問為什麼不是 `preliminary`。
2. `finding` 裡混入 `請幫我看看我現在的狀態` 這種操作句，這是很明確的不該進臨床印象的內容。
3. 前兩筆 `finding.basis` 幾乎相同，資訊重複度高，看起來像還沒真正做 evidence 對位。
4. `description` 雖然已經可讀，但 `情緒波動顯著，影響日常生活，需進一步關注與支持` 這種寫法仍偏摘要口吻，還能再更保守、更貼證據。
5. `finding` 已經開始整理壓力與焦慮，但語句風格有的像臨床摘要、有的像原句殘留，還不夠一致。

#### 為什麼要修
1. `ClinicalImpression` 是最像臨床判讀的位置，錯一句就很傷。
2. 這個資源最容易被評審質疑「AI 是否過度診斷、過度推論」，也是最容易看出你們有沒有真正理解臨床語意邊界的地方。

---

### 6. Composition 層
> 註：這一層到 `2026-04-24` 的正式測試版為止，已經很像真正的 pre-visit summary 文件。它現在最明顯的進步不是「有 Composition」，而是已經有 section 設計、病人審閱段落與 export blockers；但同時也因為像真的文件，所以內容重複和語氣過滿會更容易被看到。

#### 目前問題
1. `Chief Concerns` 裡有明顯近義重複，例如 `持續低落、空虛或失去意義感` 和 `近期，出現持續低落或失去意義感的描述` 很接近。
2. `Symptom Observations` 混入 `請幫我看看我現在的狀態` 這種操作句，這種句子不該出現在正式摘要 section。
3. `Clinical Alerts` 的句子偏重，像 `高風險的情緒波動和社交焦慮` 這種寫法，若證據有限，展示時很容易被追問依據。
4. `FHIR Delivery Draft Sections` 很有工程價值，但目前放進 Composition 後，對一般評審來說會顯得資訊密度過高、閱讀負擔偏重。
5. `Patient Review Packet` 已經很完整，但和前面 section 有部分重疊，還可以再收斂避免整份文件太長。

#### 為什麼要修
1. `Composition` 是最像給人看的正式摘要。
2. 如果這裡沒有收乾淨，前面資源就算很完整，評審最後看到的仍會是「文件太亂、太滿、太像草稿」。

---

### 7. DocumentReference 層
> 註：這一層到 `2026-04-24` 的正式測試版為止，成熟很多，而且成熟的方向很對。它現在最大的亮點不是「有附件」，而是已經開始懂得把給醫師看的內容和給系統追蹤的內容分開。

#### 目前問題
1. `readable` attachment 雖然方向很對，但解碼後內容仍可看到一些重複與偏髒的摘要句，表示 readable layer 還沒完全收乾淨。
2. `internal trace payload` 非常完整，但資訊量極大，若展示時直接展開，會讓評審很容易失焦。
3. `DocumentReference` 本體目前沒有額外 extension 補上病人審閱狀態；雖然內容裡有 trace，但資源本體層的治理訊號還可以更一致。
4. `content.data` 全部是 Base64，對系統當然合理，但若要做展示，最好同時準備解碼後的可視版本，不然現場不容易一眼看出價值。

#### 為什麼要修
1. `DocumentReference` 不只是「有附檔」而已，附檔品質也會影響可讀性。
2. 現在這份資源的強項已經不是骨架，而是分層設計；所以下一步真正要修的是內容品質與展示方式。

---

### 8. Provenance 層
> 註：這一層到 `2026-04-24` 的正式測試版為止，其實已經成熟很多，而且很適合當答辯亮點。它現在不是單純 technical trace，而是已經能把來源、審閱、授權和交付鏈講清楚。

#### 目前問題
1. `reason.text` 雖然完整，但一句話塞了很多資訊，展示時如果直接念出來會有點過長。
2. `entity` 的三層設計已經不錯，但 wording 還可以再更一致，讓 `source / derivation / quotation` 看起來更像同一套治理語言。
3. `target` 雖然完整，但目前還是偏工程視角列法；若要更偏展示，可另外做一份白話對應表輔助。

#### 為什麼要修
1. Provenance 是你答辯時很有分數的資源，而你現在這份其實已經有治理感了，下一步主要是把它講得更漂亮、更容易被非技術評審秒懂。

---

## 優化優先順序

### P0：立刻要修
1. 修正 `Patient` 的 demo 識別與匿名策略，避免再出現 `web-demo-user` 類型輸出。
2. 移除 `ClinicalImpression` 與 `Composition` 中的危險過度推論句。
3. 清除 `QuestionnaireResponse`、`Composition` 裡的操作句、碎句、重複句。
4. 將 `Observation` 改成更可讀的症狀摘要。

### P1：決賽前要補強
1. 收斂 section 數量，提升 `Composition` 的臨床可讀性。
2. 將 `DocumentReference` 內容分成閱讀版與追蹤版。
3. 補強 Provenance 的治理說明。

### P2：展示品質提升
1. 改善 `Patient` 匿名策略與 demo 呈現方式。
2. 調整 `Encounter` 時間與狀態語意。
3. 收斂 internal canonical 的展示說法。

---

## 建議實作順序
1. 先修 `symptom_observations / chief_concerns / finding` 的內容清理。
2. 再修 `ClinicalImpression.description` 的風險口徑。
3. 再修 `Observation.valueString` 與 `basis` 綁定邏輯。
4. 最後整理 `DocumentReference` 與 `Provenance` 的展示品質。

---

## 驗收標準
1. `Patient` 不再直接輸出登入帳號或 demo handle 作為病人姓名。
2. 若沒有病人基本資料，應輸出乾淨的匿名 patient draft。
3. 若已有明確病人資料，應優先保留該資料。
4. 不再出現操作句或無意義求助句進入 `ClinicalImpression`、`Composition`、`QuestionnaireResponse`。
5. `ClinicalImpression` 不可在證據不足時直接下重判斷。
6. `Composition` 每個 section 都能被人類快速看懂，不再像原始對話拼貼。
7. `Observation` 單筆內容要能讓醫師知道「觀察到了什麼」。
8. 送到 HAPI 仍然成功，且 bundle 結構不被破壞。

---

## 下一步建議
建議直接從以下任務開始：

1. `先做內容清理規則`  
目標：把重複句、操作句、低訊號句從 draft 移除。

2. `再做 ClinicalImpression 降風險`  
目標：避免沒有足夠證據時寫出過重的判斷。

3. `最後做 Composition 精簡化`  
目標：讓這份輸出變得更像真正可展示的臨床摘要。

