# HAM-D Formal Item Scorer

- Dify id: `hamd-formal-item-scorer`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要根據本輪證據，為正式 HAM-D 題項輸出 AI 建議分數與評分理由。
請輸出固定 JSON：
{
  "items":[
    {
      "item_code":"...",
      "ai_suggested_score":0,
      "rating_rationale":"...",
      "confidence":"low_or_medium_or_high"
    }
  ]
}
規則：
1. 只能根據 evidence classifier 已提供的題項與證據進行評分。
2. 分數必須遵守題項原始分制，不可使用 1 到 10。
3. 若證據不足，該題不要輸出。
4. rating_rationale 要簡潔說明為何給這個建議分數。
目前正式題項候選：{{#formal_assessment.target_items#}}
目前證據分類結果：{{#formal_assessment.evidence_result#}}
只輸出 JSON，不要加解釋。
