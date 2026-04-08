# HAM-D Evidence Classifier

- Dify id: `hamd-evidence-classifier`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要判斷本輪訊息對正式 HAM-D 題項屬於哪種證據來源。
請輸出固定 JSON：
{
  "assessment_mode":"smart_hunter_probe_or_mission_structured_or_mixed",
  "items":[
    {
      "item_code":"...",
      "evidence_type":"direct_answer_or_indirect_observation_or_mixed",
      "direct_answer_value":0,
      "evidence_summary":["..."],
      "confidence":"low_or_medium_or_high",
      "review_required":true
    }
  ]
}
規則：
1. direct_answer 代表病人明確回答頻率、嚴重度或量表式選項。
2. indirect_observation 代表主要來自互動表現、語句特徵、遲滯、激越等觀察。
3. mixed 代表同時有病人直接回答與系統可觀察到的特徵。
4. 若題項沒有足夠證據，不要輸出該題。
5. direct_answer_value 只能使用該題允許的正式分值；若不是直接回答則填 null。
6. indirect_observation 題預設 review_required=true。
目前正式題項候選：{{#formal_assessment.target_items#}}
目前 pending probe：{{#formal_assessment.pending_probe#}}
目前標籤：{{#conversation.latest_tag_payload#}}
目前 HAM-D progress：{{#conversation.hamd_progress_state#}}
只輸出 JSON，不要加解釋。
