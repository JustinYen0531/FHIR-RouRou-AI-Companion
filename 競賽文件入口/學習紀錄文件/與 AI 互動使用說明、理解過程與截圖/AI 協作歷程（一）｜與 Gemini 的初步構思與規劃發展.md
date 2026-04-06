## 1. 核心定位：憂鬱症診前陪伴與 HAM-D 框架

專案起源於對「憂鬱症就醫痛點」的觀察。許多病患對自己情緒的起伏描述非常空泛，進到診間後容易緊張或因時間壓力遺漏關鍵資訊。

在 **Gemini (Google)** 的協助下，我們確立了以 **HAM-D（漢密爾頓憂鬱量表）** 作為核心臨床框架的策略：由 AI 扮演觀察者，將日常對話映射至量表維度。

## 2. 三大核心支柱 (The Three Pillars)

Gemini 協助我定義了系統的核心支柱：

- **Pillar 1：日常情緒線索蒐集 (Daily Sentiment Hunting)**
- **Pillar 2：診前摘要自動編排 (Pre-visit Summary Orchestration)**
- **Pillar 3：FHIR 結構化格式交付 (Standardized FHIR Delivery)**

這確保了專案在發想階段就具備強大的臨床價值與資料交換的可能性。

## 3. 初始架構的腦力激盪 (Architecture Brainstorming)

我們決定捨棄「強迫式量表問答」，轉向「陪伴式引導」：

- **情境式追問**：不問「你睡得好嗎？」，而是說「最近半夜醒來時，你的心情通常是什麼樣的？」。
- **自動標籤化**：系統在背景將對話片段標籤化（Sentiment、Behavior、Cognitive、Red Flag）。

這份初步規劃文件成為後續所有開發階段的北極星。
