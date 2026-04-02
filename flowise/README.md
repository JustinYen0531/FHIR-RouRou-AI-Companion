# Flowise 目錄

- `source/`: 從 Dify `(4)` 抽出的結構化來源
- `prompts/`: 各節點 prompt / classifier 指令
- `flows/`: Flowise 重建藍圖
- `rag/`: Mission / Option 檢索資料說明
- `FLOWISE_IMPLEMENTATION_PLAN.md`: 全量實作文檔
- `FLOWISE_DIFY_NODE_MAP.json`: Dify 節點映射
- `FLOWISE_STATE_SCHEMA.json`: 狀態結構
- `flowise.env.example`: 環境變數範本

重新生成資產：

```powershell
node tools\build_flowise_assets.js
```
