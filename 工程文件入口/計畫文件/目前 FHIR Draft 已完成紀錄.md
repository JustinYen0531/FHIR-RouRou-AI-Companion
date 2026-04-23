# 目前 FHIR Draft 已完成紀錄

更新日期：`2026-04-24`

## 一句話結論
目前這份 FHIR draft 已經不只是「可以成功送到 HAPI 測試伺服器」，而是開始進入「內容可信、結構完整、可拿來決賽展示」的階段。  
目前最大剩餘風險已不再是 `Patient / Encounter` 骨架，而是：**摘要內容污染、重複句過多、風險判斷口徑過重，以及展示版去識別包裝仍需更精緻。**

---

## 2026-04-24 正式測試結論（Patient / Encounter / QuestionnaireResponse / Observation / ClinicalImpression / Composition / DocumentReference / Provenance）

### 已確認改善很多的地方
1. `Patient` 已能穩定輸出 `TW Core Patient` profile，不再只是空殼或明顯 demo placeholder。
2. `Patient.identifier`、`name`、`telecom`、`gender`、`birthDate`、`contact` 已能形成完整的人物輪廓，評審一眼就看得出來這不是假的骨架。
3. `Encounter` 已能穩定輸出 `TW Core Encounter` profile，且 `status = finished`、`class = AMB`、`serviceType`、`subject`、`period.start/end` 都有實際語意。
4. `Encounter.identifier` 已能對應 AI 陪伴 session key，表示對話流程與 FHIR 交付之間的關聯更清楚。
5. 兩個資源都已具備「可以現場展示結構完整性」的說服力，不再只是工程內部測試用 payload。

### Patient 正式測試版的成熟度判讀
1. 已具備 `meta.profile`、`identifier`、`active`、`name`、`telecom`、`gender`、`birthDate`、`contact`，完整度明顯高於早期版本。
2. 已不再落回 `web-demo-user` 這類一看就很假的病人名稱。
3. 已能呈現真實測試情境下的聯絡資訊與緊急聯絡人欄位，代表資料整合不是只停在單欄位填充。
4. 對決賽展示而言，這份 `Patient` 已經可以當成「正式測試成果」來說明。
5. 唯一需要額外注意的是：若決賽現場會投影、錄影或截圖，展示版應再做去識別處理，避免直接暴露真實個資。

### Patient 前後對比
1. 一開始的版本比較像 demo 身分容器。
   當時最容易被挑的就是名字、識別與整體人物感都太薄，像在證明系統會生 `Patient`，但不像真的病人資料。
2. 一開始的版本比較缺乏展示說服力。
   即使 technically 合法，也容易被看成 placeholder，而不是正式測試產物。
3. 現在的版本已經變成完整人物輪廓。
   有 `identifier`、`name`、`telecom`、`gender`、`birthDate`、`contact`，而且能直接對接整份 bundle 的其他資源。
4. 現在的版本比較能支撐決賽答辯。
   你可以很直接地說這不是假骨架，而是有實際測試資料流進來後生成的正式 `Patient`。
5. 現在剩下的重點不是「有沒有 Patient」，而是「決賽展示時怎麼做去識別」。

### Patient 可以明確說有改善的地方
1. 從「比較像 placeholder 病人」進步到「有完整基本欄位的人物資源」。
2. 從「只證明會產生 Patient」進步到「能承接真實測試資料」。
3. 從「demo 感偏重」進步到「已具備展示說服力」。
4. 從「識別與聯絡資訊很薄」進步到「有姓名、電話、email、生日、緊急聯絡人」。
5. 從「像測試帳號殼」進步到「像正式病人草稿」。

### Encounter 正式測試版的成熟度判讀
1. `status = finished` 比早期長期卡在 `in-progress` 的版本成熟很多，語意上更符合「一段已完成的診前整理」。
2. `class.code = AMB` 與 `serviceType = AI Companion pre-visit mental health screening` 讓 encounter 的情境更完整，不會像單純機器生成時間戳。
3. `subject.reference = Patient/3680176` 已正確接回病人資源，這讓展示時可以直接說明資源之間的臨床鏈接。
4. `period.start` 與 `period.end` 已經是可讀的真實對話區間，不再像之前那種幾乎同秒生成、很像假資料的樣子。
5. 這份 `Encounter` 已經可以作為決賽答辯時的加分點，因為它會讓人感覺你們真的有在處理醫療流程語意，而不是只拚資源數量。

### Encounter 前後對比
1. 一開始的版本比較像系統事件紀錄。
   `status` 容易卡在 `in-progress`，`period` 也比較像輸出當下時間，不像一段真的診前整理會談。
2. 一開始的版本語意沒有現在這麼清楚。
   評審若問這是什麼 encounter，很容易只能回答「這是系統生成的一筆會談資源」。
3. 現在的版本已經更像正式流程節點。
   `finished`、`AMB`、`serviceType`、`subject`、`period.start/end` 放在一起時，就很像一段完成的門診前心理健康整理 encounter。
4. 現在的版本更能拿來講流程。
   你可以直接把它當作「AI 陪伴 session 如何轉成臨床流程 encounter」的證據點。
5. 現在剩下的不是骨架問題，而是展示時如何把它跟其他資源的故事講得更漂亮。

### Encounter 可以明確說有改善的地方
1. 從「比較像系統時間戳資源」進步到「比較像正式會談 encounter」。
2. 從 `in-progress` 語意模糊，進步到 `finished` 語意清楚。
3. 從「只有 class 與時間」進步到「有 serviceType 與完整情境說明」。
4. 從「reference 存在但故事感不強」進步到「可以清楚接回 Patient 與 session 流程」。
5. 從「只是 FHIR 資源之一」進步到「可拿來當決賽流程答辯亮點」。

### QuestionnaireResponse 正式測試版的成熟度判讀
1. 這份 `QuestionnaireResponse` 已經具備 `TW Core QuestionnaireResponse` profile、`identifier`、`questionnaire`、`status`、`subject`、`encounter`、`authored`、`author` 與完整 `item`，結構上比早期成熟很多。
2. `subject.reference = Patient/3680176` 與 `encounter.reference = Encounter/3680177` 都已正確接上，表示它不是孤立資源，而是有進入整體流程。
3. `extension` 已經補進 `ai-companion-generated`、`patient-review-status`、`review-source`，這點非常重要，因為它讓這份資源不只是問卷答案，還帶有病人審閱與授權流程痕跡。
4. `item` 內除了症狀相關欄位，還有 `patient_confirm_*`、`patient_editable_*`、`questionnaire_target_*`、`authorization_prompt`，代表這份輸出已經開始承接病人審閱與後續整理流程，而不只是單純塞症狀。
5. 對決賽展示來說，這份資源的進步點主要是「流程完整度」與「可治理性」變高了，不再只是基本 FHIR 殼。

### QuestionnaireResponse 前後對比
1. 一開始比較像「先把會有的欄位湊出來」。
   能生成 resource，但比較難說服人這份資源真的承接了病人審閱、授權與後續問卷整理流程。
2. 一開始比較偏單純症狀草稿。
   缺少現在這種把 `patient_confirm_*`、`patient_editable_*`、`questionnaire_target_*`、`authorization_prompt` 一起納進來的流程感。
3. 一開始比較像工程輸出。
   評審可能只會看到「有 QuestionnaireResponse」，但不一定能看出病人審閱流程與交付治理。
4. 現在的版本變成比較完整的病人審閱問卷容器。
   不只保留症狀欄位，也把確認題、可編輯題、問卷目標與授權提示一起放進 resource。
5. 現在的版本雖然內容品質還能更精煉，但已經更適合拿來說明「AI 陪伴對話如何轉成病人可審閱、可授權的 FHIR 問卷回應」。

### QuestionnaireResponse 可以明確說有改善的地方
1. 從「單純有 QuestionnaireResponse」進步到「有完整 `subject / encounter / questionnaire / authored / author` 關聯」。
2. 從「只有基本問卷答案」進步到「帶有 `patient-review-status` 與 `review-source` 的流程 extension」。
3. 從「比較像系統內部草稿」進步到「可以展示病人確認、可編輯欄位與授權提示」。
4. 從「只證明會產生 resource」進步到「可以說明 AI 陪伴到病人審閱交付的中介流程」。
5. 從「偏工程骨架」進步到「已經有決賽展示價值的流程型 QuestionnaireResponse」。

### Observation 正式測試版的成熟度判讀
1. 這份 `Observation` 已經具備 `TW Core Observation-screening-assessment` profile、`identifier`、`status`、`category`、`code`、`subject`、`encounter`、`effectiveDateTime`、`valueString`、`method`、`derivedFrom`，結構成熟度明顯提升。
2. `extension` 同樣帶有 `ai-companion-generated`、`patient-review-status`、`review-source`，這代表治理邏輯不只停在 `QuestionnaireResponse`，而是有延續到觀察資源。
3. `valueString = reports persistent low mood` 比早期那種抽象或機械式寫法成熟很多，至少一眼就知道這筆 Observation 在說什麼。
4. `derivedFrom.reference = QuestionnaireResponse/3680178` 很加分，因為這讓 Observation 的來源脈絡清楚，不像憑空長出來的症狀判斷。
5. 對決賽展示來說，這份 Observation 的進步點是「開始長得像真的臨床觀察草稿」，不是只會吐出一個形式正確的 `Observation` 殼。

### Observation 前後對比
1. 一開始的版本比較像中繼資料。
   `valueString` 偏抽象時，很容易讓人覺得系統只是標一個 signal，沒有真正把症狀整理成可讀觀察。
2. 一開始的版本比較弱在可讀性。
   即使 `Observation` 合法，醫師或評審點開後也不一定能快速知道這筆 observation 到底想表達什麼。
3. 現在的版本比較像一筆有語意的觀察。
   `Depressed mood` 搭配 `reports persistent low mood`、`method`、`derivedFrom`，整體就比較像可以交付的 screening assessment observation。
4. 現在的版本也更有流程鏈。
   它不只接上 `Patient` 和 `Encounter`，還明確回指 `QuestionnaireResponse`，這讓整個資料流很完整。
5. 現在剩下的主要不是骨架，而是還能不能再補更具體的 evidence note，讓觀察內容更厚。

### Observation 可以明確說有改善的地方
1. 從「比較像 signal 標記」進步到「比較像可讀 observation」。
2. 從 `valueString` 偏抽象進步到 `reports persistent low mood` 這種可理解句子。
3. 從「只有 observation 本體」進步到「有 review / authorization extension」。
4. 從「來源脈絡不夠強」進步到「有 `derivedFrom QuestionnaireResponse`」。
5. 從「FHIR 殼存在」進步到「可以拿來講臨床前 observation 萃取流程」。

### ClinicalImpression 正式測試版的成熟度判讀
1. 這份 `ClinicalImpression` 已經具備 `identifier`、`status`、`code`、`description`、`subject`、`encounter`、`effectiveDateTime`、`date`、`assessor`、`protocol`、`finding`、`supportingInfo`、`note`，完整度明顯高於早期只停在草稿宣告的狀態。
2. `subject.reference = Patient/3680176`、`encounter.reference = Encounter/3680177`、`protocol = QuestionnaireResponse/3680178`、`supportingInfo` 連到 `QuestionnaireResponse` 與 `Observation`，表示它已經開始像一個有上下游脈絡的臨床印象資源。
3. `description` 已經不是空白或純技術欄位，而是能用一句話概括情境、情緒與功能影響，這在展示上很有感。
4. `finding` 已經會整理出焦慮、不安、學業壓力反應與 HAM-D 維度，代表系統確實在嘗試把對話轉成臨床印象，而不是只複製原始文本。
5. 但它同時也暴露出目前最真實的邊界：`status = completed` 偏太滿、`finding` 混入「請幫我看看我現在的狀態」這種操作句、`basis` 重複度高，所以這份資源是「已經成熟很多，但還沒有完全收乾淨」。

### ClinicalImpression 前後對比
1. 一開始的版本比較像系統想做 ClinicalImpression，但還不夠站得住腳。
   就算有這個資源，評審也可能覺得它只是把一些句子包進 `description` 跟 `finding`，沒有真正的臨床印象感。
2. 一開始的版本比較缺少流程脈絡。
   很難像現在這樣透過 `protocol`、`supportingInfo` 去說明它是根據哪份問卷和哪些觀察長出來的。
3. 現在的版本已經更像正式印象草稿。
   它至少有了摘要句、有 supporting resources、有 finding、有 note，整體上不再只是「FHIR 裡硬塞一個 ClinicalImpression」。
4. 但現在的版本也讓問題變得更明顯、更具體。
   因為它已經夠像真的東西，所以像 `completed` 太滿、操作句混入 finding、basis 重複這些問題就會更容易被看見。
5. 換句話說，這份資源現在已經走到「可以被細看」的階段。
   這其實是進步，因為它不再只是骨架問題，而是進入品質拋光問題。

### ClinicalImpression 可以明確說有改善的地方
1. 從「只有 ClinicalImpression 這個資源名義」進步到「有 description、finding、supportingInfo 的完整印象草稿」。
2. 從「比較像獨立輸出」進步到「能接上 QuestionnaireResponse 與 Observation 來源鏈」。
3. 從「只有症狀字眼堆疊」進步到「開始整合風險、情境、功能影響敘述」。
4. 從「難以展示」進步到「可以在決賽上展示，並順便說明你們知道它哪裡還要修」。
5. 從「骨架型資源」進步到「品質型資源」，也就是問題已經從有沒有，變成寫得夠不夠精準。

### Composition 正式測試版的成熟度判讀
1. 這份 `Composition` 已具備 `TW Core Composition` profile、`identifier`、`status`、`type`、`subject`、`encounter`、`date`、`author`、`title`、`confidentiality`、`relatesTo` 與完整多 section 結構，成熟度明顯比早期高。
2. `extension` 同樣帶有 `ai-companion-generated`、`patient-review-status`、`review-source`，表示這份摘要文件已經被放進病人審閱與授權流程裡，而不是單純產出一份 text。
3. `section` 已經不只一兩塊，而是有 `Clinician Draft Summary`、`Chief Concerns`、`Symptom Observations`、`Follow-up Needs`、`Clinical Alerts`、`Patient Review Packet`、`Export Blockers`、`FHIR Delivery Draft Sections`，這讓它很像真正的交付摘要文件。
4. `relatesTo -> QuestionnaireResponse/3680178` 與 `entry -> Observation/...` 很加分，因為它讓 Composition 不只是獨立說故事，而是能回接前面的問卷與觀察資源。
5. 但它也很明確暴露出目前的品質邊界：`Chief Concerns` 與 `Symptom Observations` 有重複、混入 `請幫我看看我現在的狀態`、`Clinical Alerts` 口氣偏重，所以這份 Composition 是「已經很像正式摘要，但仍需要做內容收斂」。

### Composition 前後對比
1. 一開始的版本比較像把各種文字片段拼成 summary。
   即使有 `Composition`，也比較像證明系統能生成 section，還不太像一份真的交付摘要。
2. 一開始的版本比較缺少文件感。
   很難像現在這樣同時承接臨床摘要、病人審閱、export blockers 與 FHIR draft section mapping。
3. 現在的版本已經更像正式交付文件。
   光是 section 的完整度、標題分工、`title`、`confidentiality = R`、`relatesTo`，就已經能讓評審感覺這不是只是聊天輸出。
4. 現在的版本也更容易被精細檢查。
   因為它已經夠像真的文件，所以 section 去重不夠、操作句混入、alerts 太重這些問題都會更醒目。
5. 換句話說，這份 Composition 已經從「有沒有」進步到「像不像正式成品」的階段。

### Composition 可以明確說有改善的地方
1. 從「只有 summary 殼」進步到「有完整多 section 的正式文件骨架」。
2. 從「比較像聊天摘要」進步到「比較像 pre-visit summary 文件」。
3. 從「獨立文件」進步到「能接上 QuestionnaireResponse 與 Observation」。
4. 從「只有臨床端視角」進步到「同時包含 patient review packet 與 export blockers」。
5. 從「FHIR 裡有 Composition」進步到「可以拿來展示交付文件治理與結構設計」。

### DocumentReference 正式測試版的成熟度判讀
1. 這份 `DocumentReference` 已具備 `TW Core DocumentReference` profile、`status`、`docStatus`、`type`、`subject`、`date`、`author`、`description`、`content` 與 `context.encounter`，結構上已經很完整。
2. 最明顯的進步是 `content` 已分成兩個 attachment：一個是 `AI Companion clinician summary draft (readable)`，一個是 `AI Companion full internal trace payload`，這不是單純附檔，而是開始做閱讀層與追蹤層分離。
3. 第一個 attachment 的 `title` 和內容設計都很加分，因為它明確告訴評審這是一份 clinician-facing readable summary，而不是把所有內部欄位一股腦塞出去。
4. 第二個 attachment 帶有 `_note = Internal trace payload — not intended for clinical reading` 的意思，這很有治理感，因為它等於公開承認「有一份給人看，一份給系統追」。
5. 對決賽展示來說，這份資源的成熟點不是只有能存 Base64，而是已經開始有正式文件交付與可追溯 payload 分層的概念。

### DocumentReference 前後對比
1. 一開始的版本比較像「有一份匯出附件」。
   即使 technically 成立，也比較像把資料打包起來，還沒有現在這種明確區分閱讀版與追蹤版的設計。
2. 一開始的版本比較缺少交付角色感。
   評審可能看得出來有文件，但不一定看得出哪份是給醫師看的、哪份是內部 trace。
3. 現在的版本已經更像正式交付文件容器。
   你可以很清楚地說第一份 attachment 是 clinician summary draft，第二份是 internal trace payload。
4. 現在的版本也更有產品與治理味道。
   因為它不是只把資料丟進去，而是開始考慮不同閱讀者需要看到不同層級的內容。
5. 目前剩下的問題不在有沒有 DocumentReference，而是在 readable payload 本身是否還有重複、過滿或過髒的內容。

### DocumentReference 可以明確說有改善的地方
1. 從「單純有附件」進步到「分成 readable 與 internal trace 兩層 attachment」。
2. 從「文件存在」進步到「文件用途被清楚命名」。
3. 從「像打包匯出」進步到「像正式臨床摘要交付容器」。
4. 從「只有 technical payload」進步到「開始有 clinician-facing 文件治理概念」。
5. 從「FHIR 有 DocumentReference」進步到「可以拿來答辯資料分層與追溯策略」。

### Provenance 正式測試版的成熟度判讀
1. 這份 `Provenance` 已具備 `TW Core Provenance` profile、`target`、`recorded`、`location`、`reason`、`agent`、`entity`，結構上已經不是裝飾品，而是能真的解釋來源的治理資源。
2. `target` 一次指向 `QuestionnaireResponse`、`ClinicalImpression`、`Composition`、`DocumentReference`、`Observation`，代表它不是只追一筆，而是在追整個交付鏈。
3. `location.display` 已經是人類看得懂的 session 說明，這比早期那種只有技術 reference 的感覺成熟很多。
4. `reason`、`agent`、`entity` 的內容已經能清楚說出「AI 生成」、「病人審閱」、「授權狀態」、「來源 session」，這讓它很適合拿來決賽解釋你們不是亂送資料。
5. 這份資源現在最大的進步，是它真的開始有治理與可追溯味道，不再只是 bundle 裡一個存在感很低的附屬資源。

### Provenance 前後對比
1. 一開始的版本比較像技術追蹤紀錄。
   可能能對上 target，但一般人不一定看得懂它到底在證明什麼。
2. 一開始的版本比較缺少白話治理感。
   就算有 `Provenance`，評審也可能只覺得你有加這個資源，但不知道它對病人審閱與授權有什麼意義。
3. 現在的版本已經更像正式治理說明。
   `reason`、`agent`、`entity`、`location` 一起看時，可以很清楚講出資料來源、產生者、審閱者與授權狀態。
4. 現在的版本也更能支撐答辯。
   你可以直接用這份 Provenance 回答「你們怎麼證明這份摘要不是黑盒亂生的」。
5. 目前剩下的不是有沒有 Provenance，而是要不要再把 wording 精煉得更短、更像正式政策語句。

### Provenance 可以明確說有改善的地方
1. 從「有一個追蹤資源」進步到「能追整個 FHIR 交付鏈」。
2. 從「只有 technical trace」進步到「有病人審閱與授權語意」。
3. 從「location 不好讀」進步到「session 說明一眼能懂」。
4. 從「評審不一定看得懂用途」進步到「可以直接拿來答辯治理與追溯策略」。
5. 從「存在感低」進步到「是很能加分的治理型資源」。

### 決賽展示建議結論
1. `Patient`、`Encounter`、`QuestionnaireResponse`、`Observation`、`ClinicalImpression`、`Composition`、`DocumentReference`、`Provenance` 現在都可以展示，而且是可以拿來講「我們確實優化成熟度」的那種展示，不只是勉強能用。
2. 如果要更穩，決賽版只需要再補「展示用假資料包裝」、「更標準化的人名 / relationship coding」，以及 `QuestionnaireResponse / Observation / ClinicalImpression / Composition / DocumentReference / Provenance` 的文字去重與臨床可讀性收斂，而不是整個重做。
3. 因此目前優化計畫的重心，應從「補骨架」轉向「摘要可讀性、風險敘述節制、展示版去識別」。

---

## 已完成實作紀錄

> 更新日期：`2026-04-22`  
> 實作位置：`app/fhirBundleBuilder.js`

---

### ✅ Encounter 層（已完成）

**Commit**：`fix(Encounter): status 改為 finished 預設、period 分離 sessionStartedAt/sessionEndedAt、補 serviceType`

#### 實作了什麼

| 項目 | 修改前 | 修改後 |
|------|--------|--------|
| `status` | 永遠寫死 `"in-progress"` | 讀 `session.encounterStatus`，預設 `"finished"` |
| `period.start` | 讀 `session.startedAt` | 優先讀 `session.sessionStartedAt`，退回 `startedAt` |
| `period.end` | 讀 `session.endedAt` | 優先讀 `session.sessionEndedAt`，退回 `endedAt` |
| `serviceType` | 無 | 補上，讀 `session.serviceType`，預設文字說明情境 |

#### 新增函式
- `resolveEncounterStatus(session)`：驗證並回傳合法的 FHIR Encounter status，不合法時預設 `finished`

#### 如何傳入新欄位（input.session）
```json
{
  "session": {
    "encounterKey": "session-2026-04-22-001",
    "encounterStatus": "finished",
    "sessionStartedAt": "2026-04-22T14:00:00+08:00",
    "sessionEndedAt": "2026-04-22T14:30:00+08:00",
    "serviceType": "AI Companion pre-visit mental health screening"
  }
}
```

---

### ✅ QuestionnaireResponse 層（已完成）

**Commit**：`fix(QR): recent_evidence 套用清洗規則，移除操作句/求助句/過短句/重複句，上限5筆`

#### 實作了什麼

新增 `cleanEvidence(evidenceArray, maxCount)` 清洗函式，套用於 `recent_evidence` 欄位輸出：

| 規則 | 說明 | 範例（被過濾） |
|------|------|--------------|
| ①過短句 | 少於 6 字元 | `"好"` `"嗯嗯"` |
| ②操作句 | 帶系統操作意圖 | `"請幫我看看我現在的狀態"` `"繼續"` |
| ③純求助句 | 只有「不知道怎麼辦」，無症狀訊號 | `"我現在不知道怎麼辦"` |
| ④重複句 | 與前面已保留句完全相同 | 第二次出現的相同句子 |
| ⑤上限 5 筆 | 保留清洗後最前面 5 筆 | 第 6 筆之後丟棄 |

`linkId` 標題改為 `'Recent evidence (high-signal)'`，讓閱讀者知道這是清洗過的版本。

---

### ✅ Observation 層（已完成）

**Commit**：`fix(Observation): valueString 改為可讀臨床摘要句，note 上限2筆並套用cleanEvidence`

#### 實作了什麼

**新增 `OBSERVATION_VALUE_STRINGS` 對映表** — 將抽象的 `"supported signal"` 替換為可讀摘要句：

| focus（維度） | 舊 valueString | 新 valueString |
|---|---|---|
| `depressed_mood` | `"supported signal"` | `"reports persistent low mood"` |
| `insomnia` | `"supported signal"` | `"reports sleep disruption or difficulty maintaining sleep"` |
| `work_interest` | `"supported signal"` | `"reports decline in work engagement and interest"` |
| `somatic_anxiety` | `"supported signal"` | `"reports somatic anxiety symptoms"` |
| `passive_disappearance_ideation` | `"supported signal"` | `"reports passive ideation (evidence-limited; no confirmed plan)"` |
| `suicidal_ideation` | `"supported signal"` | `"reports suicidal ideation (requires clinical verification)"` |
| 未知維度 | `"supported signal"` | `"reports <label小寫>"` |

**`note` 清洗**：
- 舊：把所有 `candidate.evidence` 全部塞進 note
- 新：重用 `cleanEvidence()` 過濾，最多保留 **2 筆**最有代表性的 evidence

---

### ✅ ClinicalImpression 層（已完成）

**Commit**：`fix(ClinicalImpression): description保守化、finding各自綁basis、note加風險標記、status改preliminary`

#### 實作了什麼

**① description 保守化**

新增 `OVERREACH_PATTERNS` 高風險詞語偵測，若 `draft_summary` 包含以下詞語，且沒有 `safetySignals` 支撐，則不使用，改用 chiefConcerns 組合保守描述：

- `自我傷害行為` / `自傷行為表現` / `有自殺` / `已有計畫`

| 情況 | description 產生方式 |
|------|---------------------|
| draft_summary 沒有高危詞 | 直接使用 draft_summary |
| draft_summary 有高危詞 + 有 safetySignals 支撐 | 直接使用 draft_summary |
| draft_summary 有高危詞 + 無 safetySignals 支撐 | 改為 `Patient reports: <chiefConcerns>.` |
| 無任何摘要 | 預設保守文字 |

**② finding 結構化，各自綁定獨立 basis**

| finding 來源 | basis 來源 |
|---|---|
| 症狀觀察（symptomObservations） | chiefConcerns 串接 |
| HAM-D 維度（coveredDimensions） | 第一筆 symptomObservation |
| 安全訊號（safetySignals） | redFlag.signals 串接 |

- finding 統一去重 + 上限 **5 筆**
- safetySignals finding 加上 `(evidence-limited)` 標記，不直接斷言

**③ note 補充風險等級標記**

| 狀況 | note 內容 |
|------|----------|
| 有 safetySignals | `Risk signals noted (evidence-limited). Clinical verification required before escalation.` + 各訊號 |
| 無 safetySignals | `No immediate risk signals identified in this session.` |

**④ status 從 `completed` 改為 `preliminary`**（AI 草稿，待醫師確認）

**⑤ supportingInfo Observation 上限從 6 改為 4**

---

### ✅ Composition 層（已完成）

**Commit**：`fix(Composition): section去重上限、Safety保守化、clinicalAlerts有evidence才加、entry只放非風險Observation`

#### 實作了什麼

**① 所有 sections 套用 `dedupeStrings` 去重 + 上限**

| section | 舊（無上限） | 新上限 |
|---------|------------|--------|
| `chief_concerns` | 無限 | **4 筆** |
| `symptom_observations` | 無限 | **4 筆** |
| `safety_flags` | 無限 | **3 筆** |
| `followup_needs` | 無限 | **3 筆** |
| `clinical_alerts` | 無限 | **3 筆** |
| `export_blockers` | 無限 | **3 筆** |
| `patient_key_points` | 無限 | **3 筆** |

**② `clinician-draft-summary` 加過度推論保護**
- 套用 `isSafeToInclude()`：若摘要包含高風險詞（`自我傷害行為` / `有自殺` 等），且沒有 safetyFlags 或 clinicalAlerts 支撐，則整段不輸出

**③ Safety section 加保守化前綴**
- `guardSafetyText()`：若句子以 `自傷` / `自殺` / `有自我傷害` 開頭，且無 safety evidence，自動加上「疑似…（尚待臨床確認）」

**④ `Symptom Observations.entry` 只放非風險 Observation**
- 過濾條件：`entry.resource.code.text` 不包含 `ideation` 或 `suicidal`
- 風險相關 Observation 不出現在 Symptom section 的 reference 裡

**⑤ `Clinical Alerts` section 加條件**
- 舊：有 clinicalAlerts 就輸出
- 新：`clinicalAlerts.length && hasSafetyEvidence` — 必須同時有安全訊號支撐才加入，避免空洞警示

**⑥ `delivery-draft-sections` 移到最後輸出**（非核心 section 不搶前面位置）

---

### ✅ DocumentReference 層（已完成）

**Commit**：`fix(DocumentReference): 分離閱讀版與internal trace payload，補relatesTo關聯Composition`

#### 實作了什麼

**① 閱讀版 vs 追蹤版 attachment 明確分離**

| 附件 | 舊 | 新 |
|------|----|----|
| attachment[0] title | `"AI Companion clinician summary draft"` | `"AI Companion clinician summary draft (readable)"` |
| attachment[0] 內容 | 整個 `clinicianSummary`（含大量中繼欄位） | 只含 5 個高品質臨床欄位的 `readablePayload` |
| attachment[1] title | `"AI Companion full export payload"` | `"AI Companion full internal trace payload"` |
| attachment[1] 內容 | 無標示 | 加上 `_note: 'Internal trace payload — not intended for clinical reading'` |

**② `readablePayload` 內容（閱讀版只含這些）**

```json
{
  "chief_concerns":       [...最多4筆，去重],
  "symptom_observations": [...最多4筆，去重],
  "safety_flags":         [...最多3筆，去重],
  "followup_needs":       [...最多3筆，去重],
  "hamd_signals":         [...最多6個有效訊號維度]
}
```

**③ 補上 `relatesTo` 關聯 Composition**
- 若 `compositionFullUrl` 存在，補上 `{ code: 'transforms', targetReference: { reference: compositionFullUrl } }`
- 讓 DocumentReference 與 Composition 之間有明確的 FHIR 依賴鏈

---

### 🔲 尚未完成

| 層 | 狀態 |
|----|------|
| Provenance | 待實作 |
| Patient 展示版去識別策略 | 待實作 |

---

### ✅ Provenance 層（已完成）

**Commit**：`fix(Provenance): location改可讀session說明、補patient-reviewer agent、entity人話描述、reason加白話治理說明`

#### 實作了什麼

**① `location.display` — 從 urn:uuid 改為人類可讀說明**

| 舊 | 新 |
|----|---|
| `"urn:uuid:..."` | `"AI Companion Platform – Session <encounterKey> (<YYYY-MM-DD>)"` |

**② `agent` — 補上 patient-reviewer（新增第二筆）**

- author：`{ "display": "AI Companion" }`
- patient-reviewer（新增）：`{ "reference": "urn:uuid:<Patient>" }`

**③ `entity` — 改為人話授權狀態說明（三層）**

| role | 舊 | 新 |
|------|----|----|
| `source` | `"AI draft with patient share allowed"` | `"AI companion conversation session (<日期>)"` |
| `derivation` | authorization_status code 原文 | `"Patient has authorized sharing with clinician"` 等人話 |
| `quotation`（新增）| 無 | `"Patient authorization status: <status>"` |

**④ `reason` — 白話治理說明**

> 「This record traces the origin of the FHIR bundle, confirms patient-level review has been initiated, and documents the sharing authorization status at time of export.」

**⑤ `patient_authorization_state` 防護性存取**
- 舊：直接存取，undefined 會崩潰
- 新：`var authState = input.patient_authorization_state || {}`

---

### 🔲 尚未完成

| 層 | 狀態 |
|----|------|
| Patient 展示版去識別策略 | 待實作 |
