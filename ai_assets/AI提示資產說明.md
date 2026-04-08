# AI 提示資產目錄

- `source/`: 從 Dify `(4)` 抽出的結構化來源
- `prompts/`: 各節點 prompt / classifier 指令
- `flows/`: chatflow 重建藍圖
- `rag/`: Mission / Option 檢索資料說明
- `AI提示資產實作計畫.md`: 全量實作文檔
- `DIFY_NODE_MAP.json`: Dify 節點映射
- `AI_STATE_SCHEMA.json`: 狀態結構
- `chatflow.env.example`: 環境變數範本

## 直接匯入用檔案
- 最推薦，拿來直接測通聊天：
  - [AI_Companion_Chatflow_Conversation_Starter.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/ai_assets/flows/AI_Companion_Chatflow_Conversation_Starter.json)
- 可直接先拿去 chatflow UI 匯入的 starter：
  - [AI_Companion_Chatflow_Starter.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/ai_assets/flows/AI_Companion_Chatflow_Starter.json)
- 帶 RAG 佔位的模板：
  - [AI_Companion_Chatflow_RAG_Template.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/ai_assets/flows/AI_Companion_Chatflow_RAG_Template.json)

說明：
- `Conversation_Starter` 不需要 Tools，最適合先確認 chatflow 能正常聊天
- `Starter` 優先用來確認 chatflow 匯入與基本聊天可用
- `RAG_Template` 需要你在對應平台內補 credential、embedding 與向量庫路徑

重新生成資產：

```powershell
node tools\build_ai_assets.js
node tools\build_chatflow_conversation_starter.js
```


