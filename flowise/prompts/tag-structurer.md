# Tag Structurer

- Dify id: `tag-structurer`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要根據本輪使用者輸入，輸出簡短 JSON 字串。
固定欄位：
{
  "route_type":"normal",
  "source_mode":"{{#conversation.active_mode#}}",
  "followup_status":"{{#conversation.followup_status#}}",
  "sentiment_tags":["..."],
  "behavioral_tags":["..."],
  "cognitive_tags":["..."],
  "warning_tags":["..."],
  "summary":"..."
}
如果某類沒有內容就輸出空陣列。
你要根據目前狀態判斷 route_type:
- 若 `followup_status` 是 pending 或目前在 follow-up 鏈上，route_type 應偏向 followup
- 否則 route_type 為 normal
只輸出 JSON，不要加解釋。
