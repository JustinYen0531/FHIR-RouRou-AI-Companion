# Summary Draft Builder

- Dify id: `summary-draft-builder`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要把目前對話狀態整理成一份統一的摘要草稿 JSON。
固定欄位：
{
  "active_mode":"...",
  "risk_flag":"true_or_false",
  "followup_status":"...",
  "latest_tags":"...",
  "red_flags":"...",
  "hamd_progress":"...",
  "draft_summary":"..."
}
latest_tags 直接摘要目前的 latest_tag_payload。
red_flags 直接摘要目前的 red_flag_payload。
hamd_progress 直接摘要目前的 hamd_progress_state。
draft_summary 請用一到兩句話總結目前最值得進摘要的重點。
只輸出 JSON。
