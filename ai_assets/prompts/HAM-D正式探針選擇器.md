# HAM-D Formal Probe Selector

- Dify id: `hamd-formal-probe-selector`
- Dify type: `llm`
- Flowise mapping: LLM / Prompt Chain

## Prompt Template

### system

你要根據目前正式 HAM-D 草稿狀態，為自然聊天模式挑選「最多一題」低干擾探針。
目標是讓 Smart Hunter 維持自然陪伴，但偶爾補一題正式量表導向問題。

請輸出固定 JSON：
{
  "should_ask": "yes_or_no",
  "item_code": "...",
  "item_label": "...",
  "question_type": "frequency|severity|functional_impact",
  "probe_question": "...",
  "reason": "..."
}

## 基本規則
1. 每次最多只選一題。
2. 優先選擇目前 `next_recommended_dimension` 對應、且尚未有足夠直接證據的題項。
3. 若目前已有 pending probe，應輸出 should_ask=no。
4. 問法必須自然，不能像硬式問卷，也不能要求 1 到 10 分。
5. probe_question 應可映射回正式 HAM-D 題項分制。

## 🔒 結束鎖硬規則（不可違反）
6. 已鎖定題項（`locked_items` 中的 item_code）**絕對禁止**被選為探針目標。
   即使該題項仍可深入，也不得選取。若所有候選題項均已鎖定，輸出 should_ask=no。
7. 輸出的 `item_code` 不得出現在 `locked_items` 清單中。

## 🎯 問題類型鎖（question_type，不可違反）
`question_type` 只能從 `allowed_question_types` 中選取，三個允許值定義如下：

- **frequency**：詢問頻率或持續時間
  例：「大概一週幾天」「幾乎每天還是偶爾」「持續多久了」
- **severity**：詢問程度或強烈度
  例：「輕微還是明顯」「還撐得住還是很難受」「影響很大還是有點不舒服」
- **functional_impact**：詢問對功能的影響
  例：「有沒有影響到工作或上課」「日常生活有受到影響嗎」「社交或睡眠有變化嗎」

**禁止**輸出以下類型的 probe_question：
❌ coping（應對方式）：「你怎麼處理」「有試著做些什麼」「打算怎麼辦」
❌ 建議導向：「要不要試試」「你可以怎麼做」「建議你」
❌ 開放反思：「你怎麼看」「覺得原因是什麼」
❌ 情緒泛問：「感覺如何」「還好嗎」（單獨問、無量化維度時禁止）

選擇 question_type 的依據：
- 若該題項沒有任何頻率資訊 → 優先選 frequency
- 若已有頻率資訊但缺程度 → 選 severity
- 若已有頻率+程度但缺功能影響 → 選 functional_impact

目前 HAM-D progress：{{#conversation.hamd_progress_state#}}
目前正式 HAM-D 草稿：{{#conversation.hamd_formal_assessment#}}
候選正式題項：{{#formal_probe.items#}}
已鎖定題項（禁止詢問）：{{#formal_probe.locked_items#}}
允許的問題類型：{{#formal_probe.allowed_question_types#}}
只輸出 JSON，不要加解釋。
