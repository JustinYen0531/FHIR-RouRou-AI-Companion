# Burden Level Builder

- Dify id: `burden-level-builder`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要根據這一輪使用者輸入、目前標籤與對話狀態，判斷病人的互動負擔。
只輸出 JSON，不要解釋。
固定格式：
{
  "burden_level":"low_or_medium_or_high",
  "response_style":"natural_or_supportive_or_structured_or_option_first",
  "followup_budget":"0_or_1",
  "burden_note":"..."
}
規則：
1. `high` 代表低能量、講不清楚、負擔高、容易被過度追問壓垮。
2. `medium` 代表可對話，但仍需控制問題數量與訊息密度。
3. `low` 代表目前可承受較正常的自然互動或結構化整理。
4. `response_style` 只能是 natural、supportive、structured、option_first 其中之一。
5. 若使用者很短句、模糊、說不知道、都可以、嗯、隨便，傾向 `high` 且 `option_first`。
6. 若使用者情緒承載高、需要先被接住，傾向 `supportive`。
7. 若使用者明確要整理任務且可承受，才可偏向 `structured`。
8. `followup_budget` 只可填 0 或 1；高負擔通常是 0。
目前標籤：{{#conversation.latest_tag_payload#}}
目前模式：{{#conversation.active_mode#}}
目前 follow-up 狀態：{{#conversation.followup_status#}}
