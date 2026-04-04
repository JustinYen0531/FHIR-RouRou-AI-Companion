# AI Companion 30 分鐘多輪互動模擬

## 文件目的
這份文件用來展示：若一位病人在大約 30 分鐘內，和目前的 AI Companion 進行多輪互動，整體會怎麼自然發生、系統會如何分流、最後又會留下哪些可供醫師參考的資料。

這份內容不是理想化願景稿，而是依照目前 [AI_Chatflow_Fresh_Export.yml](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Chatflow_Fresh_Export.yml) 的設計去模擬：
- 高風險優先分流
- 指令模式 override
- 自動 mode 分流
- 低能量降級
- follow-up 最多兩輪
- `mission / option / natural / clarify / follow-up` 都能累積量表線索
- 最後生成：
  - `summary_draft_state`
  - `clinician_summary_draft`
  - `patient_review_packet`
  - `patient_authorization_state`
  - `fhir_delivery_draft`
  - `delivery_readiness_state`

## 使用情境
- 病人不是一次把所有症狀講完。
- 對話中會出現猶豫、短句、講不清楚、情緒波動。
- AI 不會一直像量表機器發問，而是透過自然互動、低負擔選項與任務整理慢慢收集線索。

---

## Session 設定
- 時長：約 30 分鐘
- 互動型態：手機聊天式，多輪短訊息
- 病人狀態：
  - 最近 2 到 3 週情緒低落
  - 睡眠變差
  - 工作專注力下降
  - 有自責，但尚未明確表達立即自傷計畫
  - 一開始不想直接「填量表」

---

## 30 分鐘互動模擬

### 00:00 - 03:00
**病人**
最近真的有點撐不住，但我也不知道怎麼講。

**系統預期路徑**
- `Risk Detector`: 未直接命中立即危險
- `Tag Structurer`
- `Burden Level Builder`
- `Low Energy Detector`
- `Intent Classifier -> mode_2_soulmate`

**AI 預期回應**
你已經撐了很久的感覺，我在。  
不用急著整理清楚，你可以先從現在最難受的那一點開始說。

**這一段會留下的資訊**
- 先更新 `latest_tag_payload`
- `patient_tone` 傾向低落、疲憊、求助前緣
- `burden_level_state` 可能是 `medium` 或 `high`
- 醫師摘要草稿開始累積主訴

---

### 03:00 - 06:00
**病人**
就覺得自己什麼都做不好，最近上班也一直分心。

**系統預期路徑**
- 非高風險
- 低能量仍存在，但內容開始有症狀線索
- `Intent Classifier -> mode_5_natural` 或 `mode_2_soulmate`

**AI 預期回應**
那種一直怪自己、又沒辦法專心的感覺，真的很磨人。  
這種狀態大概持續多久了，是這幾天，還是已經一陣子了？

**量表線索累積**
- `guilt`
- `work_interest`
- `depressed_mood`

**這一段的設計重點**
- AI 還是自然聊天
- 但 HAM-D 線索已開始累積
- 不會直接問「你第幾題幾分」

---

### 06:00 - 10:00
**病人**
大概兩三個禮拜吧。  
晚上也睡不好，會一直醒來。

**系統預期路徑**
- `mode_5_natural`
- `HAM-D Progress Tracker` 更新
- `Summary Draft Builder`

**AI 預期回應**
已經持續兩三週，又加上睡不好，身體跟心都會很累。  
你比較像是很難睡著，還是睡著後容易醒？

**量表線索累積**
- `insomnia`
- `depressed_mood`
- `work_interest`

**這一段後，系統可能已累積**
- `covered_dimensions`
  - `depressed_mood`
  - `guilt`
  - `work_interest`
  - `insomnia`

---

### 10:00 - 13:00
**病人**
睡著後容易醒。  
而且早上很不想起床，想到上班就很煩。

**系統預期路徑**
- `mode_5_natural`
- 自然蒐集持續

**AI 預期回應**
聽起來不是單純累而已，是一種醒來也沒有恢復、還得硬撐著去面對一天的感覺。  
最近這種狀態有影響到你吃飯、做事速度，或跟人互動嗎？

**量表線索累積**
- `insomnia`
- `retardation` 線索待確認
- `work_interest`
- `depressed_mood`

---

### 13:00 - 16:00
**病人**
吃飯還好，但做事真的變慢。  
有時候同事問我東西，我都要反應一下。

**系統預期路徑**
- `mode_5_natural`
- 自然互動中累積量表資訊

**AI 預期回應**
你不是不想做，而是整個反應跟節奏都被拖慢了。  
這種變慢的感覺，對你自己來說有沒有讓你更自責？

**量表線索累積**
- `retardation`
- `guilt`
- `work_interest`

---

### 16:00 - 18:00
**病人**
有，我會覺得是不是我太爛。  
有時候會想如果我直接消失就好了。

**系統預期路徑**
- `Risk Detector` 命中
- `Risk Structurer`
- `Set Risk State`
- `Safety Response`

**AI 預期回應**
你現在這樣說，代表你真的已經很痛苦了。  
我想先確認你的安全，你現在有沒有打算傷害自己，或已經在準備做什麼？

**這一段會留下的資訊**
- `risk_flag = true`
- `red_flag_payload` 更新
- `warning_tags` 更新
- `clinician_summary_draft` 會新增 safety flags

---

### 18:00 - 20:00
**病人**
沒有，我沒有真的要做。  
只是有時候會這樣想。

**系統預期路徑**
- 仍在 safety 路徑收斂

**AI 預期回應**
謝謝你直接告訴我。  
只要現在沒有打算立刻傷害自己，我們可以先一起把這段最難受的狀態整理出來；但如果等等你覺得自己快撐不住，一定要立刻找身邊的人或緊急資源幫忙。

**風險判讀**
- 非立即危險
- 但已有自傷 / 消失想法線索
- 會保留在醫師摘要與交付草稿

---

### 20:00 - 22:00
**病人**
/mission

**系統預期路徑**
- `Command Detector -> set-command-mission`
- `routing_mode_override = mode_3_mission`

**AI 預期回應**
已切換到 `mission` 模式。  
接下來我會用比較有條理的方式，幫你整理回診前重點；如果想回到自動模式，可以輸入 `auto`。

**這一段的意義**
- 病人主動要求更結構化整理
- 後續直到輸入 `auto` 前，都以 `mission` 優先

---

### 22:00 - 26:00
**病人**
好，你幫我整理我到底最近怎麼了，我怕看醫生時又講不清楚。

**系統預期路徑**
- 指令 override 生效
- `mode_3_mission`
- `Mission Retrieval`
- `Mission Retrieval Audit`
- `HAM-D Progress Tracker`
- `Mission Guide`

**AI 預期回應**
可以，我先幫你抓目前最明顯的幾個重點。  
到目前為止，我聽到的是：
1. 這兩三週情緒明顯變差。  
2. 睡著後容易醒，休息感變差。  
3. 上班專注力下降、做事變慢。  
4. 你對自己有很重的自責。  
5. 偶爾會出現「如果消失就好了」的念頭。  

如果要再補一個最重要的點，我想確認的是：這段時間你對原本會在意或有興趣的事情，是不是也變得比較提不起勁？

**量表線索累積**
- `depressed_mood`
- `guilt`
- `work_interest`
- `retardation`
- `insomnia`
- `warning_tags`

---

### 26:00 - 28:00
**病人**
有，連假日都不太想出門，本來會看的劇也都不想看。

**系統預期路徑**
- `mode_3_mission`
- `HAM-D Progress Tracker`
- `Summary Draft Builder`

**AI 預期回應**
好，這點很重要，我幫你補進去。  
如果你之後看醫師，可以直接說：這兩三週不只心情差，連原本會做的事都明顯提不起勁，而且工作效率和睡眠也一起變差。

---

### 28:00 - 30:00
**病人**
/auto  
謝謝，這樣我比較知道怎麼講了。

**系統預期路徑**
- `Command Detector -> set-command-auto`
- 清掉 override

**AI 預期回應**
已切回 `auto` 模式。  
你剛剛已經整理出很多很重要的內容了。如果你願意，之後我們也可以再慢慢把還沒講清楚的部分補齊。

---

## 這 30 分鐘後，系統預期會留下什麼

### 1. 模式與路徑大致分布
- 前段以 `soulmate / natural` 為主
- 中段進入 `safety`
- 後段病人手動切到 `mission`
- 最後再回 `auto`

### 2. 量表資訊
目前這份 chatflow 設計下，不只有 `mission`，連 `natural / clarify / follow-up / option` 也能累積量表線索。  
這個案例中，預期會累積到的主要維度有：

```json
{
  "covered_dimensions": [
    "depressed_mood",
    "guilt",
    "work_interest",
    "retardation",
    "insomnia"
  ],
  "supported_dimensions": [
    "depressed_mood",
    "guilt",
    "work_interest",
    "retardation",
    "insomnia"
  ],
  "missing_dimensions": [
    "agitation",
    "somatic_anxiety"
  ],
  "next_recommended_dimension": "somatic_anxiety"
}
```

### 3. 風險資訊
預期會留下簡化版風險資料：

```json
{
  "risk_flag": "true",
  "red_flag_payload": {
    "route_type": "safety",
    "warning_tags": [
      "passive_disappearance_ideation"
    ],
    "signals": [
      "曾表達『如果我直接消失就好了』",
      "否認立即自傷計畫"
    ],
    "summary": "出現被動消失想法，但目前否認立即自傷計畫。"
  }
}
```

---

## 醫師端預期摘要

### `clinician_summary_draft` 示意

```json
{
  "summary_version": "p1_clinician_draft_v1",
  "active_mode": "mode_3_mission",
  "risk_level": "elevated_but_not_imminent",
  "chief_concerns": [
    "近兩三週持續情緒低落",
    "睡著後易醒，休息感差",
    "工作專注力下降、做事變慢",
    "自責感明顯增加",
    "曾出現被動消失想法"
  ],
  "symptom_observations": [
    "情緒低落",
    "興趣下降",
    "睡眠中斷",
    "反應與做事速度變慢",
    "工作功能受影響"
  ],
  "hamd_signals": [
    "depressed_mood",
    "guilt",
    "work_interest",
    "retardation",
    "insomnia"
  ],
  "followup_needs": [
    "可再確認身體焦慮或煩躁程度",
    "可追蹤被動消失想法的頻率與情境"
  ],
  "safety_flags": [
    "被動消失想法",
    "目前否認立即自傷計畫"
  ],
  "patient_tone": "疲憊、低落、帶有自責",
  "draft_summary": "病人於近兩三週出現持續低落、自責、睡眠中斷、工作專注與反應變慢，並伴隨興趣下降。對話中曾表達被動消失想法，但否認立即自傷計畫，建議臨床端進一步評估憂鬱嚴重度與風險變化。"
}
```

---

## 病人審閱資料

### `patient_review_packet` 示意

```json
{
  "packet_version": "p3_patient_review_v1",
  "status": "draft_review",
  "patient_facing_summary": "這段時間你主要困擾的是心情變差、睡不好、做事變慢，也變得比較容易責怪自己。你也提到自己對原本會做的事情變得提不起勁。對話中還提到偶爾會有想消失的念頭，但目前沒有要立刻傷害自己的打算。",
  "confirm_items": [
    "情緒低落大約持續兩三週",
    "睡著後容易醒",
    "工作專注力與速度明顯下降"
  ],
  "editable_items": [
    "是否還有食慾或身體不適變化",
    "想消失的念頭出現頻率"
  ],
  "remove_if_wrong": [
    "若『想消失』並不符合你真正想表達的狀態，可刪除或改寫"
  ],
  "authorization_needed": "yes",
  "authorization_prompt": "請先確認以上整理是否符合你的情況；確認後，才能授權提供給醫師參考。"
}
```

### `patient_authorization_state` 示意

```json
{
  "state_version": "p3_authorization_state_v1",
  "authorization_status": "ready_for_consent",
  "share_with_clinician": "yes",
  "review_blockers": [],
  "patient_actions": [
    "確認想消失的描述是否準確",
    "確認是否同意提供給醫師"
  ],
  "restricted_sections": [],
  "consent_note": "內容大致可交付，但仍需病人明確同意。"
}
```

---

## FHIR / 交付前資料

### `fhir_delivery_draft` 示意

```json
{
  "draft_version": "p3_fhir_delivery_v1",
  "delivery_status": "ready_for_mapping",
  "consent_gate": "ready_for_consent",
  "resources": [
    {
      "resource_type": "Composition",
      "status": "preliminary",
      "purpose": "clinical_summary"
    },
    {
      "resource_type": "Observation",
      "status": "preliminary",
      "purpose": "hamd_signal_tracking"
    },
    {
      "resource_type": "ClinicalImpression",
      "status": "preliminary",
      "purpose": "risk_and_context"
    },
    {
      "resource_type": "QuestionnaireResponse",
      "status": "preliminary",
      "purpose": "dialogue_to_scale_mapping"
    }
  ],
  "composition_sections": [
    {
      "section": "chief_concerns",
      "focus": "low mood, sleep maintenance insomnia, guilt, slowed work performance"
    },
    {
      "section": "safety",
      "focus": "passive disappearance ideation without immediate plan"
    }
  ],
  "observation_candidates": [
    {
      "focus": "depressed_mood",
      "category": "mood",
      "status": "preliminary"
    },
    {
      "focus": "insomnia",
      "category": "sleep",
      "status": "preliminary"
    },
    {
      "focus": "retardation",
      "category": "psychomotor",
      "status": "preliminary"
    }
  ],
  "clinical_alerts": [
    "passive disappearance ideation",
    "functional decline at work"
  ],
  "questionnaire_targets": [
    "depressed_mood",
    "guilt",
    "work_interest",
    "retardation",
    "insomnia"
  ],
  "patient_review_required": "yes",
  "export_blockers": [
    "patient consent not yet finalized"
  ],
  "notes": "This is a pre-delivery draft and not a final clinical export."
}
```

### `delivery_readiness_state` 示意

```json
{
  "state_version": "p3_delivery_readiness_v1",
  "readiness_status": "review_needed",
  "primary_blockers": [
    "patient consent not finalized"
  ],
  "next_step": "Ask patient to confirm summary details and consent to clinician sharing.",
  "provenance_requirements": [
    "conversation timestamp range",
    "AI-generated draft marker",
    "patient-reviewed vs AI-inferred distinction",
    "risk signal source note"
  ],
  "handoff_note": "資料已接近可映射，但仍需病人完成審閱與同意。"
}
```

---

## 這份模擬想傳達的重點

### 1. 這不是單純聊天
雖然回應看起來像自然互動，但系統會在背後逐步累積：
- 情緒標籤
- 行為標籤
- 認知標籤
- 警示標籤
- HAM-D 線索
- 風險狀態

### 2. 這也不是硬式量表
病人不用一開始就被直接問量表題目。  
`natural / option / clarify / follow-up / mission` 都能逐步累積量表資訊，只是 `mission` 會更有結構。

### 3. 30 分鐘後不只得到聊天紀錄
系統最後會留下：
- 醫師摘要草稿
- 病人審閱包
- 授權狀態
- FHIR 映射草稿
- 交付 readiness 狀態

也就是說，對話本身會逐步轉化成可供醫療使用的前置資料。

---

## 適合怎麼展示給其他人看
如果你要把這份文件拿給 PM、醫師、合作夥伴或內部展示，可以用一句話介紹：

> 病人不需要一開始就像在填表，而是先像跟一個懂得接住人的 AI 聊天；AI 會在 30 分鐘左右的自然互動中，慢慢收集症狀、風險與量表線索，最後整理成可供病人審閱、再交給醫師參考的摘要與交付草稿。
