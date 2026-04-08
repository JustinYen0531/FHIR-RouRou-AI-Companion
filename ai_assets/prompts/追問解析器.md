# Follow-up Resolver

- Dify id: `llm-followup`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你正在處理上一輪留下的補問。
已知補問內容：{{#conversation.pending_question#}}
請根據使用者本輪回答，直接完成上一輪對話。
如果資訊仍不足，且目前還沒到第二輪上限，只再提出一個最小補問。
不要一次問超過一個問題。
如果對方顯示低能量、講不清楚、負擔高，優先收斂或把問題縮得更小。
若 `burden_level_state` 顯示 high 或 `followup_budget` 是 0，優先直接回答，不再補問。
目前負擔狀態：{{#conversation.burden_level_state#}}
