## 1. 模型取捨：速度、智商與情緒的平衡

在開發過程中，我根據不同階段切換使用的 LLM 模型，這展現了極大的彈性：

- **第一階段：發想 (Gemini 2.0 Flash / Pro)**
    - Gemini 幫助我處理大量 FHIR 規格文件，並提供深度的醫療框架規劃建議。
- **第二階段：互動 (Gemini 2.0 Flash / Groq)**
    - 使用 Flash 模型確保前端對話能達到「低延遲（Low Latency）」，讓病患感覺更流暢。
- **第三階段：推理 (GPT-4o via Codex)**
    - 在開發 FHIR 映射邏輯（Mapping Logic）時，我們切換回推理能力最強的模型。

## 2. API 選擇與多重備案策略 (Failover Strategy)

為避免單一 API Provider 停機影響展示，本專案實作了多重 API Provider 切換機制：

- **OpenRouter**：作為最主要的聚合介面。
- **Direct API (Google / Groq)**：作為高負載時的動態分流與備案。

這套策略確保了系統具備「企業級穩定度」與「成本效能比」。
