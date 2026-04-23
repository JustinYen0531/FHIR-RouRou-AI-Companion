# 目前 FHIR Draft 具體優化計畫

更新日期：`2026-04-24`

## 一句話結論
目前這份 FHIR draft 已經不只是「可以成功送到 HAPI 測試伺服器」，而是開始進入「內容可信、結構完整、可拿來決賽展示」的階段。  
目前最大剩餘風險已不再是 `Patient / Encounter` 骨架，而是：**摘要內容污染、重複句過多、風險判斷口徑過重，以及展示版去識別包裝仍需更精緻。**

---

## 2026-04-24 正式測試結論（Patient / Encounter / QuestionnaireResponse / Observation / ClinicalImpression / Composition / DocumentReference）

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

### 決賽展示建議結論
1. `Patient`、`Encounter`、`QuestionnaireResponse`、`Observation`、`ClinicalImpression`、`Composition`、`DocumentReference` 現在都可以展示，而且是可以拿來講「我們確實優化成熟度」的那種展示，不只是勉強能用。
2. 如果要更穩，決賽版只需要再補「展示用假資料包裝」、「更標準化的人名 / relationship coding」，以及 `QuestionnaireResponse / Observation / ClinicalImpression / Composition / DocumentReference` 的文字去重與臨床可讀性收斂，而不是整個重做。
3. 因此目前優化計畫的重心，應從「補骨架」轉向「摘要可讀性、風險敘述節制、展示版去識別」。

---

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

### 目前最明顯的缺口
1. `ClinicalImpression.description` 與 `Composition` 內文仍有過度推論風險。
2. `QuestionnaireResponse.item` 混入太多原始碎句、重複句、操作句。
3. `Observation` 可送出，但內容太薄，醫師看不出重點。
4. `DocumentReference` 雖然保留完整 payload，但 payload 本身仍偏髒。
5. 展示版本仍需要額外的去識別包裝，避免正式測試資料直接上台。

---

## 這份 Draft 具體可以優化哪些地方

### 1. Patient 層
> 註：以下多數是早期版本的缺口。到 `2026-04-24` 的正式測試版為止，`Patient` 結構完整度已明顯改善，現在主要剩下的是「決賽展示時要不要改成去識別版」。

#### 目前問題
1. 正式測試版已能帶出真實病人欄位，但展示版若直接使用，會有個資暴露風險。
2. `contact.relationship` 目前可讀，但若要追求更嚴謹的 FHIR 味道，仍可再補 coding。

#### 為什麼要修
1. 現在不是「送不出去」，而是要讓正式測試成果在決賽呈現時更安全、更漂亮。
2. 評審若看到真實資料雖然會覺得完整，但也可能反問隱私與展示治理。

#### 建議優化
1. 保留正式測試版對真實欄位的支援，但決賽輸出應可一鍵切成展示版匿名資料。
2. `Patient.name` 在展示情境可切成較中性的匿名顯示格式，例如 `Anonymous Patient` 或 `Demo Patient A`。
3. `contact.relationship` 可再補標準 coding，讓懂 FHIR 的評審也挑不太到毛病。

#### 一個好的 Patient Draft 應該長什麼樣
1. 不直接把登入帳號、測試帳號、`web-demo-user` 這類 system handle 當成病人姓名。
2. 有明確的 `key`，但這個 key 不應該直接長得像前端帳號或操作暱稱。
3. `name` 要嘛是真正可讀的人名，要嘛是清楚的匿名名稱，例如 `Anonymous Patient`。
4. `gender` 與 `birthDate` 若沒有可靠來源，可以省略，但不能亂猜。
5. 最少要讓人一眼看懂：這是匿名病人，還是已提供基本資料的病人。

#### 建議最小版本
```json
{
  "key": "anon-a1b2c3d4e5f6",
  "name": "Anonymous Patient",
  "identity_strategy": "anonymous_default",
  "name_source": "anonymous_default",
  "demographics_status": "anonymous_minimal"
}
```

#### 建議較完整版本
```json
{
  "key": "pt-jane-lin",
  "name": "Jane Lin",
  "gender": "female",
  "birthDate": "1998-04-03",
  "identity_strategy": "provided_identity",
  "name_source": "patient_profile.name",
  "demographics_status": "basic_demographics_present"
}
```

#### 本次實作目標
1. 保留真實病人欄位通路，因為這已經證明系統真的能承接正式測試資料。
2. 補一層展示版去識別策略，而不是把已完成的正式測試能力砍掉重來。
3. 將 `Patient` 從「正式測試可用」再提升到「正式測試可用，而且決賽展示也安全」。

---

### 2. Encounter 層
> 註：這一層在 `2026-04-24` 的正式測試版已經改善很多，目前主要是把成果寫清楚，讓答辯時能直接拿來講。

#### 目前問題
1. 舊版曾有 `period.start` 與 `period.end` 幾乎相同的問題，會看起來像系統生成時間。
2. 舊版 `status = in-progress` 和已完成交付情境不一致，現在正式測試版已改善為 `finished`。

#### 為什麼要修
1. `Encounter` 是評審最容易秒懂的流程型資源，語意對了，整個系統成熟度就會一起被抬高。
2. 現在這層已經變成可以拿來加分的地方，不該讓文件還停在舊狀態。

#### 建議優化
1. 保留 `finished` 與真實 `period.start/end` 的作法，這已經是對的方向。
2. 在答辯文件中直接把 `serviceType` 與 `class = AMB` 當成你們理解就醫情境的證據點。
3. 若後續還要再補強，可加入更清楚的會談階段說明，但不再需要回頭修基本骨架。

#### 建議完整版範例
```json
{
  "resourceType": "Encounter",
  "status": "finished",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "AMB",
    "display": "ambulatory"
  },
  "subject": { "reference": "urn:uuid:<Patient UUID>" },
  "period": {
    "start": "2026-04-22T14:00:00+08:00",
    "end": "2026-04-22T14:30:00+08:00"
  },
  "identifier": [
    {
      "system": "https://rourou.ai/fhir/internal/NamingSystem/ai-companion-session-key",
      "value": "session-2026-04-22-001"
    }
  ],
  "serviceType": {
    "text": "AI Companion pre-visit mental health screening"
  }
}
```
> **重點**：`status` 改為 `finished`；`period.start/end` 取真實對話起訖；`serviceType` 補充情境說明。

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

#### 建議優化
1. 將 `depressed_mood.answer` 從泛用句改成更具體的症狀摘要句，而不是只寫 `Observed via AI companion conversation.`。
2. 把 `recent_evidence` 從抽象標籤改成更接近病人原意、但仍經整理的高訊號句。
3. 對 `patient_confirm_*` 做去重與合併，避免低落/失去意義感被拆成太多近義確認題。
4. 明確定義 `phq9_total_score = 0` 的語意；若是未完成量表，應避免看起來像正式零分。
5. 統一 `patient_editable_*`、`questionnaire_target_*`、`authorization_prompt` 的語氣，讓整份問卷更像同一個產品產出的。

#### 前後對比摘要
| 面向 | 早期版本 | 現在版本 |
|------|----------|----------|
| 資源定位 | 基本問卷輸出 | 病人審閱與授權流程容器 |
| `subject / encounter` 關聯 | 較弱或不夠有存在感 | 已明確串上 Patient 與 Encounter |
| 治理資訊 | 較少 | 已有 review / authorization extension |
| 題目型態 | 比較偏單一症狀草稿 | 已含 confirm、editable、target、authorization prompt |
| 內容品質 | 容易顯得像系統草稿 | 流程更完整，但文字仍待去重與精煉 |
| 展示說服力 | 只能說「有 QuestionnaireResponse」 | 可以說「病人審閱流程已進入 FHIR 資源」 |

#### 建議完整版範例
```json
{
  "resourceType": "QuestionnaireResponse",
  "status": "completed",
  "questionnaire": "https://rourou.ai/fhir/internal/Questionnaire/ai-companion-previsit-hamd17-draft-v1",
  "subject": { "reference": "urn:uuid:<Patient UUID>" },
  "encounter": { "reference": "urn:uuid:<Encounter UUID>" },
  "authored": "2026-04-22T14:30:00+08:00",
  "author": { "display": "AI Companion MVP" },
  "item": [
    {
      "linkId": "depressed_mood",
      "text": "Depressed mood",
      "answer": [{ "valueString": "Patient reports persistent low mood or loss of meaning based on AI companion conversation." }]
    },
    {
      "linkId": "phq9_total_score",
      "text": "PHQ-9 total score",
      "answer": [{ "valueInteger": 0 }]
    },
    {
      "linkId": "recent_evidence",
      "text": "Recent evidence (high-signal)",
      "answer": [{ "valueString": "出現持續低落或失去意義感的描述。" }]
    },
    {
      "linkId": "next_recommended_dimension",
      "text": "Next recommended dimension",
      "answer": [{ "valueString": "depressed_mood" }]
    },
    {
      "linkId": "patient_confirm_0",
      "text": "Patient review confirm item",
      "answer": [{ "valueString": "主要困擾是否包含：持續低落、空虛或失去意義感" }]
    },
    {
      "linkId": "patient_editable_0",
      "text": "Patient editable item",
      "answer": [{ "valueString": "您對於學業和社交活動的興趣是否受到影響？" }]
    },
    {
      "linkId": "questionnaire_target_0",
      "text": "Questionnaire target",
      "answer": [{ "valueString": "持續低落、空虛或失去意義感：持續低落、空虛或失去意義感" }]
    },
    {
      "linkId": "authorization_prompt",
      "text": "Authorization prompt",
      "answer": [{ "valueString": "請在審閱後授權提供這些信息給醫師。" }]
    }
  ]
}
```
> **重點**：保留 `subject / encounter / extension / review items / authorization prompt` 的流程完整性；下一步不是重做骨架，而是把文字內容去重、收斂、變得更可讀。

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

#### 建議優化
1. 保留 `valueString = reports persistent low mood` 這種可讀句型，但可再補上時間感或功能影響，讓內容更完整。
2. 增加 `note`，保留 1 到 2 則最有代表性的證據句，讓 observation 不只可讀，還能回看依據。
3. 維持 `derivedFrom QuestionnaireResponse` 這條來源鏈，這是現在很加分的地方。
4. 若後續增加更多 observation，建議每筆都維持「一個維度、一句摘要、一條來源」的風格，不要重新變回雜亂拼貼。

#### 前後對比摘要
| 面向 | 早期版本 | 現在版本 |
|------|----------|----------|
| `valueString` 可讀性 | 偏抽象，像 signal 標記 | 已是 `reports persistent low mood` |
| 資源定位 | 比較像中繼資料 | 比較像 screening observation 草稿 |
| 治理資訊 | 較少 | 已有 review / authorization extension |
| 來源鏈 | 較弱 | 已有 `derivedFrom QuestionnaireResponse` |
| 臨床語意 | 不夠直接 | 已能一眼看懂在講低落情緒 |
| 下一步重點 | 先求有輸出 | 補 evidence 厚度與多維 observation |

#### 建議完整版範例（一筆 Observation）
```json
{
  "resourceType": "Observation",
  "id": "3680179",
  "status": "preliminary",
  "category": [
    {
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
        "code": "survey",
        "display": "Survey"
      }]
    }
  ],
  "code": {
    "coding": [{
      "system": "https://rourou.ai/fhir/internal/CodeSystem/ai-companion-signals",
      "code": "depressed_mood",
      "display": "Depressed mood"
    }],
    "text": "Depressed mood"
  },
  "subject": { "reference": "urn:uuid:<Patient UUID>" },
  "encounter": { "reference": "urn:uuid:<Encounter UUID>" },
  "effectiveDateTime": "2026-04-22T14:30:00+08:00",
  "valueString": "reports persistent low mood",
  "derivedFrom": [
    { "reference": "urn:uuid:<QuestionnaireResponse UUID>" }
  ],
  "method": { "text": "AI companion conversation extraction" }
}
```
> **重點**：這份 Observation 現在真正的進步是 `valueString` 已可讀、`derivedFrom` 已補上、`extension` 已延續審閱授權治理；下一步再補 evidence note，質感會再往上跳一截。

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

#### 建議優化
1. 將 `status` 從 `completed` 改為 `preliminary`，這樣才符合 AI 草稿待確認的定位。
2. 刪除 `請幫我看看我現在的狀態` 這類操作句，不讓它進入 `finding`。
3. 讓每筆 `finding` 對應不同 `basis`，不要前兩筆都共用幾乎一樣的長串文字。
4. `description` 保留現在的可讀性，但語氣可再收斂成更保守的觀察句。
5. 維持 `protocol` 與 `supportingInfo` 這條來源鏈，這是現在很加分的地方，不應該在優化時弄丟。

#### 前後對比摘要
| 面向 | 早期版本 | 現在版本 |
|------|----------|----------|
| 資源完整度 | 可能只有宣告或偏薄草稿 | 已有 description、finding、supportingInfo、note |
| 來源鏈 | 不夠強 | 已接上 QuestionnaireResponse 與 Observation |
| 可讀性 | 偏技術或偏鬆散 | 已有完整情境摘要句 |
| finding 品質 | 容易只是句子堆疊 | 已較像臨床印象，但仍混入操作句與重複 basis |
| 資源定位 | 比較像骨架 | 比較像可展示的印象草稿 |
| 下一步重點 | 先把資源做出來 | 清掉不該進來的句子、降風險、提高精準度 |

#### 建議完整版範例
```json
{
  "resourceType": "ClinicalImpression",
  "status": "preliminary",
  "code": { "text": "AI Companion risk and context impression" },
  "subject": { "reference": "urn:uuid:<Patient UUID>" },
  "encounter": { "reference": "urn:uuid:<Encounter UUID>" },
  "effectiveDateTime": "2026-04-22T14:30:00+08:00",
  "date": "2026-04-22T14:30:00+08:00",
  "assessor": { "display": "AI Companion MVP" },
  "description": "使用者面臨學業壓力與社交焦慮，近期出現持續低落與不安感，已影響日常生活功能，建議進一步確認與支持。",
  "protocol": ["QuestionnaireResponse/<QuestionnaireResponse ID>"],
  "finding": [
    {
      "itemCodeableConcept": { "text": "對話內容顯示持續性的焦慮與不安感，在課堂表現與評價情境中出現明顯壓力反應。" },
      "basis": "焦慮與不安感持續出現、學業表現與評價壓力造成負擔"
    },
    {
      "itemCodeableConcept": { "text": "HAM-D dimension: Depressed mood" },
      "basis": "持續低落、空虛或失去意義感；近期，出現持續低落或失去意義感的描述"
    },
    {
      "itemCodeableConcept": { "text": "在課堂表現與評價情境中出現明顯壓力反應。" },
      "basis": "學業表現與評價壓力造成負擔"
    }
  ],
  "note": [
    { "text": "No immediate risk signals identified in this session." }
  ],
  "supportingInfo": [
    { "reference": "urn:uuid:<QuestionnaireResponse UUID>" },
    { "reference": "urn:uuid:<Observation depressed_mood UUID>" }
  ]
}
```
> **重點**：這份 ClinicalImpression 現在真正的進步，是它已經有了 description、finding、supportingInfo、protocol 與 note 的完整骨架；下一步不是重做，而是把 `status`、`finding`、`basis` 這幾個最容易出錯的點修乾淨。

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

#### 建議優化
1. `Chief Concerns` 強制去重，只留最高優先、最不重複的 3 到 4 點。
2. `Symptom Observations` 清掉操作句，只保留症狀與情境觀察。
3. `Clinical Alerts` 改成更保守的說法，避免沒有足夠證據時就寫成高風險警示。
4. `Patient Review Packet` 保留，但可與前面 section 做內容去重，避免同一句在不同區塊反覆出現。
5. `FHIR Delivery Draft Sections` 若保留，建議在展示版降權或移到附錄，不要讓它搶走臨床摘要本體的注意力。

#### 前後對比摘要
| 面向 | 早期版本 | 現在版本 |
|------|----------|----------|
| 文件完整度 | 比較像 summary 拼裝 | 已有正式多 section 文件結構 |
| section 設計 | 偏少或偏鬆散 | 已有 clinician、chief concerns、patient review、blockers 等分工 |
| 治理資訊 | 較少 | 已有 review / authorization extension 與 confidentiality |
| 來源關聯 | 較弱 | 已透過 `relatesTo`、`entry` 接上 QuestionnaireResponse / Observation |
| 閱讀品質 | 還像草稿拼貼 | 比較像正式文件，但仍有重複與口氣過滿問題 |
| 下一步重點 | 先把文件做出來 | 去重、降風險、調整展示層次 |

#### 建議完整版範例
```json
{
  "resourceType": "Composition",
  "status": "preliminary",
  "type": { "text": "AI Companion pre-visit summary" },
  "subject": { "reference": "urn:uuid:<Patient UUID>" },
  "encounter": { "reference": "urn:uuid:<Encounter UUID>" },
  "date": "2026-04-22T14:30:00+08:00",
  "title": "AI Companion Pre-Visit Summary",
  "confidentiality": "R",
  "author": [{ "display": "AI Companion MVP" }],
  "section": [
    {
      "title": "Chief Concerns",
      "code": { "text": "chief-concerns" },
      "text": {
        "status": "generated",
        "div": "<div xmlns='http://www.w3.org/1999/xhtml'><ul><li>持續低落、空虛或失去意義感</li><li>焦慮與不安感持續出現</li><li>學業表現與評價壓力造成負擔</li></ul></div>"
      }
    },
    {
      "title": "Symptom Observations",
      "code": { "text": "symptom-observations" },
      "text": {
        "status": "generated",
        "div": "<div xmlns='http://www.w3.org/1999/xhtml'><ul><li>對話內容顯示持續性的焦慮與不安感。</li><li>在課堂表現與評價情境中出現明顯壓力反應。</li></ul></div>"
      },
      "entry": [
        { "reference": "urn:uuid:<Observation depressed_mood UUID>" },
        { "reference": "urn:uuid:<Observation anxiety UUID>" }
      ]
    },
    {
      "title": "Follow-up Needs",
      "code": { "text": "followup-needs" },
      "text": {
        "status": "generated",
        "div": "<div xmlns='http://www.w3.org/1999/xhtml'><ul><li>釐清低落頻率、持續時間，以及是否影響工作、課業或日常活動。</li></ul></div>"
      }
    }
  ]
}
```
> **重點**：這份 Composition 現在真正的進步，是它已經長成一份有 section 設計、病人審閱段落、blockers 與 delivery mapping 的正式文件；下一步不是重做文件，而是把重複內容、操作句與過滿警示收掉，讓它更像決賽可以直接投影的摘要。

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

#### 建議優化
1. 保留兩份 attachment 的方向不變，因為這已經是很好的設計。
2. 繼續清理 `readable` attachment 的內容，讓它更像真正的 clinician-facing summary，而不是從內部 payload 擷取後的半整理版本。
3. 展示時應預先準備 readable attachment 的解碼內容，讓評審直接看摘要，而不是看 Base64。
4. 若之後要再往上補，可考慮在 `DocumentReference` 本體也加上與其他資源一致的 review / authorization extension。
5. `internal trace payload` 保留完整沒問題，但展示版要清楚說它是 trace，不是給臨床直接閱讀的正文。

#### 前後對比摘要
| 面向 | 早期版本 | 現在版本 |
|------|----------|----------|
| 附件設計 | 比較像單一匯出附件 | 已分成 readable 與 internal trace 兩層 |
| 文件角色 | 偏技術輸出 | 開始有 clinician-facing 文件定位 |
| 治理概念 | 較弱 | 已明確標示 internal trace payload |
| 展示說服力 | 只能說「有附檔」 | 可以說「有分層交付與可追溯設計」 |
| 內容品質 | 容易一包到底 | readable 已抽出，但仍需去重與清洗 |
| 下一步重點 | 先把附件做出來 | 提升 readable 品質與展示可讀性 |

#### 建議完整版範例
```json
{
  "resourceType": "DocumentReference",
  "status": "current",
  "docStatus": "preliminary",
  "type": { "text": "AI Companion clinician summary document" },
  "subject": { "reference": "urn:uuid:<Patient UUID>" },
  "date": "2026-04-22T14:30:00+08:00",
  "author": [{ "display": "AI Companion MVP" }],
  "description": "Clinician-facing AI Companion pre-visit summary draft",
  "context": {
    "encounter": [{ "reference": "urn:uuid:<Encounter UUID>" }]
  },
  "content": [
    {
      "attachment": {
        "contentType": "application/json",
        "title": "AI Companion clinician summary draft (readable)",
        "data": "<base64 of clinician-facing readable JSON>"
      }
    },
    {
      "attachment": {
        "contentType": "application/json",
        "title": "AI Companion full internal trace payload",
        "data": "<base64 of full internal trace payload>"
      }
    }
  ],
  "context": {
    "encounter": [{ "reference": "urn:uuid:<Encounter UUID>" }]
  }
}
```

**clinician summary draft（閱讀版）內容應長這樣：**
```json
{
  "chief_concerns": [
    "持續性情緒低落（過去兩至三週）",
    "睡眠中斷，入睡後易醒",
    "工作與注意力功能下降"
  ],
  "symptom_observations": [
    "情緒低落：患者報告近期對事物持續缺乏興趣。",
    "睡眠障礙：睡著後容易中途清醒。",
    "功能影響：工作效率下降，注意力不集中。"
  ],
  "safety_flags": [
    "疑似被動消失想法（尚待確認，無立即計畫）"
  ],
  "followup_needs": [
    "追蹤身體焦慮維度",
    "確認被動消失念頭頻率與強度"
  ],
  "hamd_signals": ["depressed_mood", "work_interest", "insomnia"]
}
```
> **重點**：這份 DocumentReference 現在真正的進步，是它已經把「閱讀版」和「追蹤版」分開了；下一步不是回頭重做，而是把 readable payload 再洗乾淨一點，並且在展示時把解碼後內容直接秀給評審看。

---

### 8. Provenance 層
#### 目前問題
1. `location.display` 現在是 `urn:uuid:...`，對人類閱讀幫助很低。
2. 雖然 target 有連上，但目前還偏向技術追蹤，而不是展示用治理證據。

#### 為什麼要修
1. Provenance 是你答辯時很有分數的資源，但現在看起來還不夠「治理感」。

#### 建議優化
1. 增加更清楚的 `reason` 與 `agent` 表述。
2. 若可行，補進：
   產生來源
   病人審閱完成
   允許分享狀態
3. 讓 Provenance 在文件中有一段白話解釋，評審才會看懂你不是亂加這個資源。

#### 建議完整版範例
```json
{
  "resourceType": "Provenance",
  "recorded": "2026-04-22T14:30:00+08:00",
  "target": [
    { "reference": "urn:uuid:<QuestionnaireResponse UUID>" },
    { "reference": "urn:uuid:<ClinicalImpression UUID>" },
    { "reference": "urn:uuid:<Composition UUID>" },
    { "reference": "urn:uuid:<DocumentReference UUID>" }
  ],
  "agent": [
    {
      "type": { "text": "author" },
      "who": { "display": "AI Companion MVP (Automated Draft Generator)" }
    },
    {
      "type": { "text": "patient-reviewer" },
      "who": { "reference": "urn:uuid:<Patient UUID>" }
    }
  ],
  "entity": [
    {
      "role": "source",
      "what": { "display": "AI companion conversation session (2026-04-22)" }
    },
    {
      "role": "derivation",
      "what": { "display": "patient_share_consent: ready_for_consent" }
    }
  ],
  "reason": [
    { "text": "AI Companion pre-visit summary auto-generation for clinician handoff" }
  ],
  "location": {
    "display": "AI Companion Platform – Session 2026-04-22-001"
  },
  "patient": { "reference": "urn:uuid:<Patient UUID>" }
}
```

**白話說明（可加進展示文件）：**
> 這份 Provenance 記錄了「是誰、在什麼時候、基於什麼對話、產生了這份 FHIR 交付」。它確保這份草稿的來源可追溯，且已經過病人層級的審閱授權（`ready_for_consent`），不是直接送出未授權資料。

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
