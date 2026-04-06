## 1. 架構探索：從 No-code 到 Pro-code

最初嘗試使用 Dify 與 Flowise 建立工作流，雖能快速產出對話，但在處理「模式切換」與「精確 JSON 輸出」時遭遇挑戰：

- **模式穩定度 (Routing Consistency)**：Dify 工作流在處理 Void Box 與 Mission Guide 交錯時，容易喪失上下文。
- **FHIR 映射需求**：對於具體的 FHIR 映射（Mapping），我們需要更底層的 Node.js 執行器。

## 2. 轉向自建核心：以 Codex 為引擎

為了確保資料輸出的精準度，我轉向自建 Node.js 服務模組（包含 `app.js` 與 `services/*.js`）。

- **Codex (OpenAI)**：在建構後端邏輯與修復 Bug 上展現強大的推理能力。
- **Antigravity**：負責完善前端對話互動邏輯（Interaction Management）。

這兩者交錯開發，實現了「前端敏捷互動」與「後端結構化輸出」的完美結合。

## 3. 系統實作里程碑 (Implementation Milestones)

- **自動化標籤提取**：實作了能在對話中動態偵測症狀標籤的解析引擎。
- **FHIR Bundle 出口**：運用 `fhirBundleBuilder.js` 將 AI 分析成果轉化為符合 FHIR 格式的 Bundle，並在 GitHub 上順利部署與驗證。
