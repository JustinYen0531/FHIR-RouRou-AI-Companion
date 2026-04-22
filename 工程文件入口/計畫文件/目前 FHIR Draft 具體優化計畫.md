# 目前 FHIR Draft 具體優化計畫

更新日期：`2026-04-22`

## 一句話結論
目前這份 FHIR draft 已經達到「可以成功送到 HAPI 測試伺服器」的程度，但仍未達到「內容可信、臨床可讀、適合決賽展示」的水準。  
最大問題不是技術送出，而是：**摘要內容污染、重複句過多、風險判斷口徑過重、資源內容仍偏 demo 感。**

---

## 目前狀態判讀

### 已經做對的部分
1. `Patient / Encounter / QuestionnaireResponse / Observation / ClinicalImpression / Composition / DocumentReference / Provenance` 已完整建立。
2. 各資源 reference 關係成立，表示 bundle 骨架正確。
3. 有授權狀態、review extension、Provenance，代表流程上已有最小治理概念。
4. 已可成功送到 `https://hapi.fhir.org/baseR4`，代表交換鏈不是假的。

### 目前最明顯的缺口
1. `ClinicalImpression.description` 與 `Composition` 內文仍有過度推論風險。
2. `QuestionnaireResponse.item` 混入太多原始碎句、重複句、操作句。
3. `Observation` 可送出，但內容太薄，醫師看不出重點。
4. `DocumentReference` 雖然保留完整 payload，但 payload 本身仍偏髒。
5. `Patient` 與整體識別仍像 demo，正式感不足。

---

## 這份 Draft 具體可以優化哪些地方

### 1. Patient 層
#### 目前問題
1. `name = web-demo-user`，很明顯是展示型 placeholder。
2. `gender = unknown` 雖然合法，但現在看起來像系統沒有整理到資料。

#### 為什麼要修
1. 送得出去不代表看起來可信。
2. 評審若看到這種 placeholder，會直覺覺得這份交付還停在 demo。

#### 建議優化
1. 若使用者未提供真名，前端與輸出文件要明確標示「示範身分」或「匿名病人」。
2. `Patient.name` 可改為較中性的匿名顯示格式，例如 `Anonymous Patient` 或 `Demo Patient A`。
3. `gender` 若未知可保留，但 UI 與文件要解釋這是「尚未蒐集」而不是漏掉。

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
1. 預設情況下改用乾淨的匿名 patient，而不是直接輸出 `web-demo-user`。
2. 如果未來 session state 已經有明確病人資料，則優先沿用該資料。
3. 將 `Patient` 從「能送出去」提升到「看起來像一份正式匿名草稿」。

---

### 2. Encounter 層
#### 目前問題
1. `period.start` 與 `period.end` 幾乎相同，像是系統生成時間，而不是實際會談區間。
2. `status = in-progress` 和已完成交付的情境有點不一致。

#### 為什麼要修
1. 會談摘要既然已送出，`Encounter` 若永遠維持 `in-progress`，語意上會讓人困惑。
2. 決賽時若被問「這是正在進行的 encounter 還是已完成的會談整理」，你現在不容易答得漂亮。

#### 建議優化
1. 若交付對應的是已完成的一段對話整理，可考慮在送出版本改成較符合情境的狀態。
2. 若保留 `in-progress`，則在文件中說明這代表「持續中的診前整理會談」。
3. 將 session 開始與結束時間改為真實對話區間，而不是僅取輸出當下時間。

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
#### 目前問題
1. `recent_evidence` 裡混入重複句與品質不一的原話。
2. 有些內容像「請幫我看看我現在的狀態」這種控制句，不應被當成臨床 evidence。
3. 同一個意思出現多次，造成 item 過長、過亂。

#### 為什麼要修
1. `QuestionnaireResponse` 應該是結構化問答或證據整理，不是逐字稿垃圾桶。
2. 現在的內容會讓醫師或評審覺得系統沒有把訊息清洗乾淨。

#### 建議優化
1. 新增 evidence 清洗規則：
   `移除操作句、移除純求助句、移除過短句、移除重複句`
2. `recent_evidence` 每次最多保留 3 到 5 則高訊號句子。
3. 將 evidence 分成：
   `直接症狀句`
   `功能影響句`
   `壓力情境句`
4. 不再把「請幫我看看」「我現在不知道怎麼辦」這種控制性或泛情緒句直接塞進 item。

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
      "answer": [{ "valueString": "近兩三週持續情緒低落，對日常事物失去興趣。" }]
    },
    {
      "linkId": "insomnia",
      "text": "Insomnia",
      "answer": [{ "valueString": "睡著後容易中途清醒，難以再入睡。" }]
    },
    {
      "linkId": "work_interest",
      "text": "Work and interest decline",
      "answer": [{ "valueString": "工作效率明顯下降，難以集中注意力完成任務。" }]
    },
    {
      "linkId": "recent_evidence",
      "text": "Recent evidence (high-signal only)",
      "answer": [
        { "valueString": "近兩三週情緒持續低落，連喜歡的事也提不起勁。" },
        { "valueString": "睡著後容易醒，醒了就很難再睡著。" },
        { "valueString": "工作時常常發呆，做什麼都覺得很慢。" }
      ]
    },
    {
      "linkId": "next_recommended_dimension",
      "text": "Next recommended dimension",
      "answer": [{ "valueString": "somatic_anxiety" }]
    }
  ]
}
```
> **重點**：`recent_evidence` 每則都是完整、有訊號的症狀句；移除操作句與求助句；每則 answer 各自獨立描述不重複。

---

### 4. Observation 層
#### 目前問題
1. `valueString = supported signal` 太抽象。
2. `Observation` 現在比較像機器中繼資料，不像臨床觀察。

#### 為什麼要修
1. 結構合法不等於人類可讀。
2. 醫師若點開資源，只看到 `supported signal`，幫助很有限。

#### 建議優化
1. `valueString` 改成可讀摘要，例如：
   `reports persistent low mood`
   `reports sustained anxiety around academic evaluation`
2. `note` 中保留 1 到 2 則最有代表性的 evidence，不要整包塞滿。
3. 若能明確對應 symptom inference，可讓 `Observation` 一筆只表達一個明確概念。

#### 建議完整版範例（一筆 Observation）
```json
{
  "resourceType": "Observation",
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
  "valueString": "reports persistent low mood over the past two to three weeks",
  "note": [
    { "text": "近兩三週情緒持續低落，對日常事物失去興趣。" }
  ],
  "derivedFrom": [
    { "reference": "urn:uuid:<QuestionnaireResponse UUID>" }
  ],
  "method": { "text": "AI companion conversation extraction" }
}
```
> **重點**：`valueString` 改為一句可讀的臨床摘要；`note` 只留 1 則最有代表性的原話；每筆 Observation 只描述一個維度。

---

### 5. ClinicalImpression 層
#### 目前問題
1. `description` 現在寫到「並有自我傷害的行為表現」，這是高風險判斷。
2. 若原始證據不足，這句會變成過度推論。
3. `finding` 中混入：
   原始碎句
   重複句
   非臨床語句
4. `basis` 幾乎每筆 finding 都是一樣的長串內容，資訊密度很差。

#### 為什麼要修
1. `ClinicalImpression` 是最像臨床判讀的位置，錯一句就很傷。
2. 這個資源最容易被評審質疑「AI 是否過度診斷、過度推論」。

#### 建議優化
1. `description` 改成保守版本：
   只描述觀察到的情緒困擾、功能影響、壓力情境。
2. 高風險句要分級：
   `明確自傷行為`
   `疑似高風險線索`
   `未見足夠證據`
3. 沒有明確證據時，不要直接寫「有自我傷害行為表現」。
4. `finding` 限制為 3 到 5 筆高價值條目，不要把同義句全部列上去。
5. `basis` 應依每筆 finding 綁定對應 evidence，而不是全部共用同一串文字。

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
  "description": "Patient reports persistent low mood, sleep disruption, and declining work function over the past two to three weeks. No immediate self-harm plan confirmed. Passive ideation noted as suspected signal only.",
  "finding": [
    {
      "itemCodeableConcept": { "text": "Persistent low mood (depressed_mood)" },
      "basis": "近兩三週情緒持續低落，對日常事物失去興趣。"
    },
    {
      "itemCodeableConcept": { "text": "Sleep disruption (insomnia)" },
      "basis": "睡著後容易中途清醒，難以再入睡。"
    },
    {
      "itemCodeableConcept": { "text": "Functional decline at work" },
      "basis": "工作效率明顯下降，難以集中注意力完成任務。"
    },
    {
      "itemCodeableConcept": { "text": "Suspected passive ideation (evidence-limited)" },
      "basis": "曾表達如果消失就好了；否認立即自傷計畫。"
    }
  ],
  "note": [
    { "text": "Risk level: suspected signal only. Immediate danger not confirmed." }
  ],
  "supportingInfo": [
    { "reference": "urn:uuid:<QuestionnaireResponse UUID>" },
    { "reference": "urn:uuid:<Observation depressed_mood UUID>" },
    { "reference": "urn:uuid:<Observation insomnia UUID>" }
  ]
}
```
> **重點**：`description` 保守、只描述事實觀察；每筆 `finding.basis` 各自綁定對應 evidence；高風險 finding 加上「evidence-limited」標記，不直接斷言。

---

### 6. Composition 層
#### 目前問題
1. `Chief Concerns` 與 `Symptom Observations` 內有大量重複。
2. 混入明顯不該進摘要的句子，例如「請幫我看看我現在的狀態」。
3. `Clinical Alerts` 的句子口氣仍偏重，可能超過實際證據。
4. 整體 section 很多，但訊息濃度不夠高。

#### 為什麼要修
1. `Composition` 是最像給人看的正式摘要。
2. 如果這裡還是髒的，前面資源再完整，整體印象還是會掉下來。

#### 建議優化
1. 強制 section 去重：
   同義句只留一句
2. `Chief Concerns` 只保留最高優先的 3 到 4 點。
3. `Symptom Observations` 改寫成臨床式摘要句，不直接照抄對話。
4. `Clinical Alerts` 僅保留有明確證據支持的高風險項目。
5. `Export Blockers` 要更聚焦，避免三句都像在說同一件事。

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
        "div": "<div xmlns='http://www.w3.org/1999/xhtml'><ul><li>持續性情緒低落（過去兩至三週）</li><li>睡眠中斷，入睡後易醒</li><li>工作與注意力功能下降</li></ul></div>"
      }
    },
    {
      "title": "Symptom Observations",
      "code": { "text": "symptom-observations" },
      "text": {
        "status": "generated",
        "div": "<div xmlns='http://www.w3.org/1999/xhtml'><ul><li>情緒低落：患者報告近期對事物持續缺乏興趣。</li><li>睡眠障礙：睡著後容易中途清醒。</li><li>功能影響：工作效率下降，注意力不集中。</li></ul></div>"
      },
      "entry": [
        { "reference": "urn:uuid:<Observation depressed_mood UUID>" },
        { "reference": "urn:uuid:<Observation insomnia UUID>" },
        { "reference": "urn:uuid:<Observation work_interest UUID>" }
      ]
    },
    {
      "title": "Safety",
      "code": { "text": "safety-flags" },
      "text": {
        "status": "generated",
        "div": "<div xmlns='http://www.w3.org/1999/xhtml'><ul><li>疑似被動消失想法（尚待確認，無立即計畫）</li></ul></div>"
      }
    },
    {
      "title": "Follow-up Needs",
      "code": { "text": "followup-needs" },
      "text": {
        "status": "generated",
        "div": "<div xmlns='http://www.w3.org/1999/xhtml'><ul><li>追蹤身體焦慮維度（somatic_anxiety）</li><li>確認被動消失念頭頻率與強度</li></ul></div>"
      }
    }
  ]
}
```
> **重點**：`Chief Concerns` 只留 3 點、語言精簡；`Symptom Observations` 改寫成「患者報告...」的臨床摘要句而非原話；Safety section 的高風險描述加上「疑似」與「尚待確認」。

---

### 7. DocumentReference 層
#### 目前問題
1. 現在確實有保存完整 JSON，但裡面混入大量偏原始、偏髒、偏重複資料。
2. Base64 payload 太大，且內容品質不整齊。

#### 為什麼要修
1. `DocumentReference` 不只是「有附檔」而已，附檔品質也會影響可讀性。
2. 如果未來要拿它做決賽證據包，現在這份 payload 還不夠漂亮。

#### 建議優化
1. 保留兩份 attachment 的方向可以不變，但內容要先清洗。
2. Clinician summary draft 要改成真正的「臨床摘要版」，不是把所有中繼欄位都塞進去。
3. Full payload 可以保留，但應標示為 internal trace payload，不是對外閱讀版。

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
        "data": "<base64 of 以下 JSON>"
      }
    },
    {
      "attachment": {
        "contentType": "application/json",
        "title": "AI Companion full internal trace payload",
        "data": "<base64 of 完整內部追蹤 payload>"
      }
    }
  ]
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
> **重點**：兩份 attachment 分開；閱讀版只放精簡可讀內容，不塞中繼欄位；internal trace 標題明確標示非對外閱讀版。

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
