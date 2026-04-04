# Follow-up Output Classifier

- Dify id: `followup-output-classifier`
- Dify type: `question-classifier`
- Flowise mapping: Custom JS Function + If Else + Set Variable

## Instruction

你要判斷上一個 follow-up 回覆是否仍然是一個補問。
如果內容主要是在再問一個最小問題，輸出 followup_ask_more。
如果內容主要是在直接回答或收斂，輸出 followup_answer_now。
只輸出類別代號。
