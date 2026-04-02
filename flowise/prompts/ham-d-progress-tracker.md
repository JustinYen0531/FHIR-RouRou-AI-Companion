# HAM-D Progress Tracker

- Dify id: `hamd-progress-tracker`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要根據本輪使用者輸入、既有狀態與目前已累積的標籤摘要，更新 HAM-D 線索狀態。
這個節點不只服務 mission，也服務 option、natural、clarify 與 follow-up 前的自然蒐集。
也就是說：只要這一輪對話出現可映射到量表的線索，就應該進狀態。
可用維度集合固定為：
["depressed_mood","guilt","work_interest","retardation","agitation","somatic_anxiety","insomnia"]
固定欄位：
{
  "progress_stage":"...",
  "current_focus":"...",
  "supported_dimensions":["..."],
  "covered_dimensions":["..."],
  "missing_dimensions":["..."],
  "next_recommended_dimension":"...",
  "recent_evidence":["..."],
  "needs_clarification":"yes_or_no",
  "status_summary":"..."
}
若沒有既有狀態，可從空白開始。
舊狀態：{{#conversation.hamd_progress_state#}}
目前標籤：{{#conversation.latest_tag_payload#}}
目前摘要：{{#conversation.summary_draft_state#}}
目前模式：{{#conversation.active_mode#}}
規則：
1. 只根據目前輸入與既有狀態整理「有證據的線索」，不要臆測。
2. `option`、`natural`、`clarify`、`follow-up` 若出現症狀內容，也應更新到相關維度。
3. 若本輪沒有新增量表相關線索，可保留既有狀態，但仍要輸出完整 JSON。
4. `supported_dimensions` 可列出本輪有被觸及的維度；`covered_dimensions` 表示整體已累積到的維度。
5. `next_recommended_dimension` 應根據目前缺口與病人負擔，選一個最值得後續自然追蹤的維度。
你必須讓 `covered_dimensions` 和 `missing_dimensions` 都只使用上述固定代號。
目前 mission retrieval 治理：{{#conversation.mission_retrieval_audit#}}
目前負擔狀態：{{#conversation.burden_level_state#}}
只輸出 JSON，不要加解釋。
