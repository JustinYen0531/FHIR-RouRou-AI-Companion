# Flowise 目錄

- `source/`: 從 Dify `(4)` 抽出的結構化來源
- `prompts/`: 各節點 prompt / classifier 指令
- `flows/`: Flowise 重建藍圖
- `rag/`: Mission / Option 檢索資料說明
- `FLOWISE_IMPLEMENTATION_PLAN.md`: 全量實作文檔
- `FLOWISE_DIFY_NODE_MAP.json`: Dify 節點映射
- `FLOWISE_STATE_SCHEMA.json`: 狀態結構
- `flowise.env.example`: 環境變數範本

## 直接匯入用檔案
- 可直接先拿去 Flowise UI 匯入的 starter：
  - [AI_Companion_Flowise_Importable_Starter.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/flowise/flows/AI_Companion_Flowise_Importable_Starter.json)
- 帶 RAG 佔位的模板：
  - [AI_Companion_Flowise_Importable_RAG_Template.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/flowise/flows/AI_Companion_Flowise_Importable_RAG_Template.json)

說明：
- `Starter` 優先用來確認 Flowise 匯入與基本聊天可用
- `RAG_Template` 需要你在 Flowise 內補 credential、embedding 與向量庫路徑

重新生成資產：

```powershell
node tools\build_flowise_assets.js
```
