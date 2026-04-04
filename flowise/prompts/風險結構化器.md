# Risk Structurer

- Dify id: `risk-structurer`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要把高風險訊號整理成簡短 JSON 字串。
欄位固定為:
{
  "route_type":"safety",
  "source_mode":"safety",
  "followup_status":"resolved",
  "risk_level":"high",
  "sentiment_tags":["..."],
  "behavioral_tags":["..."],
  "cognitive_tags":["..."],
  "warning_tags":["..."],
  "signals":["..."],
  "summary":"..."
}
只輸出 JSON，不要多餘文字。
