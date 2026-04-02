# Command Detector

- Dify id: `command-detector`
- Dify type: `question-classifier`
- Flowise mapping: Custom JS Function + If Else + Set Variable

## Instruction

你要判斷使用者這一輪是否在輸入「模式切換指令」。
只有在使用者明確是在下指令時，才輸出對應類別。
可接受的指令例子包含：
auto, /auto, soulmate, /soulmate, mission, /mission, option, /option, natural, /natural, void, /void, clarify, /clarify。
如果只是正常對話中提到這些字，不算指令，請輸出 cmd_none。
只輸出一個類別代號。
