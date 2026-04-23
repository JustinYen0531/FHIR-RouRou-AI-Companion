# 目前 FHIR Draft 理想結果

更新日期：`2026-04-24`

## 這份 Draft 理想上應該長什麼樣

### 1. Patient 層
> 註：以下多數是早期版本的缺口。到 `2026-04-24` 的正式測試版為止，`Patient` 結構完整度已明顯改善，現在主要剩下的是「決賽展示時要不要改成去識別版」。

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

#### 建議優化
1. 將 `depressed_mood.answer` 從泛用句改成更具體的症狀摘要句，而不是只寫 `Observed via AI companion conversation.`。
2. 把 `recent_evidence` 從抽象標籤改成更接近病人原意、但仍經整理的高訊號句。
3. 對 `patient_confirm_*` 做去重與合併，避免低落/失去意義感被拆成太多近義確認題。
4. 明確定義 `phq9_total_score = 0` 的語意；若是未完成量表，應避免看起來像正式零分。
5. 統一 `patient_editable_*`、`questionnaire_target_*`、`authorization_prompt` 的語氣，讓整份問卷更像同一個產品產出的。

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

#### 建議優化
1. 保留 `valueString = reports persistent low mood` 這種可讀句型，但可再補上時間感或功能影響，讓內容更完整。
2. 增加 `note`，保留 1 到 2 則最有代表性的證據句，讓 observation 不只可讀，還能回看依據。
3. 維持 `derivedFrom QuestionnaireResponse` 這條來源鏈，這是現在很加分的地方。
4. 若後續增加更多 observation，建議每筆都維持「一個維度、一句摘要、一條來源」的風格，不要重新變回雜亂拼貼。

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

#### 建議優化
1. 將 `status` 從 `completed` 改為 `preliminary`，這樣才符合 AI 草稿待確認的定位。
2. 刪除 `請幫我看看我現在的狀態` 這類操作句，不讓它進入 `finding`。
3. 讓每筆 `finding` 對應不同 `basis`，不要前兩筆都共用幾乎一樣的長串文字。
4. `description` 保留現在的可讀性，但語氣可再收斂成更保守的觀察句。
5. 維持 `protocol` 與 `supportingInfo` 這條來源鏈，這是現在很加分的地方，不應該在優化時弄丟。

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

#### 建議優化
1. `Chief Concerns` 強制去重，只留最高優先、最不重複的 3 到 4 點。
2. `Symptom Observations` 清掉操作句，只保留症狀與情境觀察。
3. `Clinical Alerts` 改成更保守的說法，避免沒有足夠證據時就寫成高風險警示。
4. `Patient Review Packet` 保留，但可與前面 section 做內容去重，避免同一句在不同區塊反覆出現。
5. `FHIR Delivery Draft Sections` 若保留，建議在展示版降權或移到附錄，不要讓它搶走臨床摘要本體的注意力。

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

#### 建議優化
1. 保留兩份 attachment 的方向不變，因為這已經是很好的設計。
2. 繼續清理 `readable` attachment 的內容，讓它更像真正的 clinician-facing summary，而不是從內部 payload 擷取後的半整理版本。
3. 展示時應預先準備 readable attachment 的解碼內容，讓評審直接看摘要，而不是看 Base64。
4. 若之後要再往上補，可考慮在 `DocumentReference` 本體也加上與其他資源一致的 review / authorization extension。
5. `internal trace payload` 保留完整沒問題，但展示版要清楚說它是 trace，不是給臨床直接閱讀的正文。

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
> 註：這一層到 `2026-04-24` 的正式測試版為止，其實已經成熟很多，而且很適合當答辯亮點。它現在不是單純 technical trace，而是已經能把來源、審閱、授權和交付鏈講清楚。

#### 建議優化
1. 保留現在 `target / agent / entity / reason / location` 的結構，這已經是對的方向。
2. 將 `reason.text` 精煉成兩句內更好讀的治理說明，避免過長。
3. `entity` 的 wording 可以再統一，例如都用同一種語氣描述 `source / derivation / quotation`。
4. 決賽展示時建議搭配一段白話解釋，讓評審直接知道這份 Provenance 是在證明「這份資料從哪來、誰審過、能不能交付」。

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
    { "text": "AI Companion pre-visit summary auto-generation for clinician handoff. This record traces the origin of the FHIR bundle, confirms patient-level review has been initiated, and documents the sharing authorization status at time of export." }
  ],
  "location": {
    "display": "AI Companion Platform – Session <session key> (<YYYY-MM-DD>)"
  }
}
```

**白話說明（可加進展示文件）：**
> 這份 Provenance 記錄了「是誰、在什麼時候、基於什麼對話、產生了這份 FHIR 交付」。它也同時說明病人層級的審閱與授權狀態，讓這份草稿不是黑盒輸出，而是有來源、有審閱、有交付依據的資料。

