# 目前 FHIR Draft 最終版

更新日期：`2026-04-30`

本文件這次以 `1487655` 這筆最新 FHIR 交付優化 commit 為主整理，搭配此前 `2026-04-22` 到 `2026-04-29` 的 FHIR 收斂成果一起判讀。  
這一版已經不是單純補欄位，而是把 `FHIR Draft` 從「可送出、可展示」再往前推到「可調整 mapping、可轉 TW IG Core、AI 身份更標準化、臨床輸出更克制」的版本。

---

## 一句話結論

這一輪 `FHIR Draft` 最終版最大的變化，不是又多幾個 resource，而是：

**你把原本固定寫死的 AI 陪伴交付，升級成一套更像正式醫療草稿的流程：AI 角色被標準化、病人原話被進一步移出正式輸出、PHQ-9 路徑被重整、FHIR 欄位分配可以被人工調整，甚至連 TW IG Core profile 都能一鍵套用。**

---

## 這一版最重要的更新

### 1. AI 身份正式資源化

這次不再讓 AI 只用 `display` 或自由文字出現在 `author / assessor / agent`。  
系統改成正式建立一個 `Device` resource：

- `Device/ai-companion-node-engine`
- 名稱為 `AI Companion Node Engine`

接著把原本多處的：

- `QuestionnaireResponse.author`
- `ClinicalImpression.assessor`
- `Composition.author`
- `DocumentReference.author`
- `Provenance.agent`

全部改成指向這個 `Device reference`。

這個改動的意義非常大，因為它把 AI 從「一段說明文字」提升成「FHIR 內部可被引用的正式生成主體」。

代表 commit：

- `1487655` feat: FHIR 欄位調整表格、TW IG Core 轉換按鈕、FHIR 優化全套

---

### 2. PHQ-9 從 QuestionnaireResponse 移除，正式改走 Observation 路徑

這次很重要的一個重整，是把原本放在 `QuestionnaireResponse` 裡的 `PHQ-9 item + total score` 內容抽掉。

也就是說，現在系統不再把 PHQ-9 當成：

- 問卷 answer list 的主要承載方式

而是更傾向把它整理後映射進：

- `Observation`
- 後續 summary / scoring / clinical drafting 流程

這個改動的方向很清楚：

1. `QuestionnaireResponse` 回到比較像病人問答與審閱容器。
2. `PHQ-9` 量化結果改由更適合承載分數與觀察的 `Observation` 路徑去接。
3. 讓 FHIR 交付的資料層次更乾淨，不把所有量表都直接塞在 QR 裡。

代表 commit：

- `1487655`

---

### 3. ClinicalImpression 從「有摘要」再往前收斂成「更克制的專業草稿」

這次 `ClinicalImpression` 最明顯的收斂有三個：

1. `status` 維持在 `preliminary`
2. `note` 改成專業聲明，不再留逐字稿式輸出
3. 安全風險說明統一成較正式、較保守的專業敘述

原本比較像：

- 把風險句子一條一條列出
- 或把病人原話殘留在 note 裡

現在則改成：

- `AI-generated pre-visit draft. Not a diagnosis. Requires clinician review.`
- 若有風險訊號，也用較完整、較克制的臨床語氣寫成統一說明

這代表 `ClinicalImpression` 已不只是「AI 看見了什麼」，而是開始有意識地處理：

- 非診斷聲明
- 風險表述口徑
- 臨床責任邊界

代表 commits：

- `e197c47` fix(ClinicalImpression): status 改 preliminary、description 保守化
- `1487655` ClinicalImpression note 改為專業聲明，移除逐字稿

---

### 4. Composition 正式加入 AI Disclaimer section

這次 `Composition` 最關鍵的更新之一，是新增固定的 `AI Disclaimer` section，而且放在前面。

內容明確寫出：

- 這是 AI-generated pre-visit draft
- 不是 diagnosis
- 臨床使用前需要 clinician review

同時這次也把：

- `draft_summary` 截斷到 600 字

這代表系統開始從兩個面向修正 `Composition`：

1. 法律與臨床責任面：先把「這不是診斷」講清楚
2. 文件閱讀面：不要讓摘要無限制膨脹，避免變成長段 AI 草稿傾倒

這個改動其實非常有決賽價值，因為它讓評審一看就知道你有在意：

- AI 身份
- 醫師覆核
- 文件治理

代表 commits：

- `f8091ea` fix(Composition): section 收斂、安全語氣保守化
- `1487655` Composition 加 AI disclaimer section，draft_summary 截斷至 600 字

---

### 5. Provenance 語言正式改成治理語言

這次 `Provenance.agent.type` 不再只是一般性的 `author` 或模糊角色，而是直接改成：

- `AI generation engine`
- `Patient authorization`

這件事很漂亮，因為它等於把 `Provenance` 從「有 trace」進一步升級成「有治理角色命名」。

這會讓整個交付流程更容易被答辯成：

- 這份資料是誰生成的
- 這份資料和病人授權的關係是什麼
- AI 與病人的角色如何分開

代表 commits：

- `811826b` fix(Provenance): 補強 location / patient reviewer / reason
- `1487655` Provenance agent type 改為 `AI generation engine` / `Patient authorization`

---

## 這一版最像產品升級的地方：FHIR 欄位調整表格

如果說前面幾輪都在修內容品質，那 `1487655` 真正最像「產品功能升級」的地方，是：

### 新增醫師端 `FHIR 欄位調整表格`

這不是單純多一個設定頁，而是讓醫師端或展示端可以直接看到：

- 哪一筆 AI 摘要資料來自哪個來源
- 它預設會被分配到哪個 FHIR resource
- 使用者可不可以手動改分配位置

目前可調的目標包含例如：

- `Observation`
- `QuestionnaireResponse`
- `ClinicalImpression`
- `Composition`
- `DocumentReference`
- `exclude`

而且它不是只顯示，是真的能：

1. 逐筆修改欄位目標 resource
2. 儲存 override
3. 在下次 FHIR 交付時套用
4. 重設回預設值

這個功能的價值很大，因為它把系統從：

- AI 自己決定 mapping

推進成：

- AI 先給預設 mapping
- 醫療端 / 展示端可再介入調整

這完全符合你和導師之前反覆收斂出的那條線：

`AI 負責整理，人類保留最終配置權。`

代表 commit：

- `1487655` 醫師指派頁新增 FHIR 欄位調整表格，可逐筆重新分配至目標 Resource

---

## 這一版最像展示升級的地方：TW IG Core 轉換按鈕

另一個很關鍵的新功能，是新增：

### `轉換 TW IG Core` 按鈕

這顆按鈕會做的事是：

- 自動對 bundle 中各 resource 注入對應的 `meta.profile`

目前對應的類型包含：

- `Patient`
- `Encounter`
- `Observation`
- `QuestionnaireResponse`
- `Composition`
- `DocumentReference`
- `Provenance`

這個功能的價值不在於它立刻把整個系統變成正式上線等級，而在於：

1. 你可以快速展示「我們知道 TW IG Core 應該怎麼接」
2. 不必把整個系統從頭綁死在最嚴格 profile 上
3. 同時保留 PoC 靈活度與標準化展示能力

它很像一個非常聰明的決賽策略：

- 平常保持原型可跑
- 需要展示標準化時，一鍵轉成帶 profile 的版本

代表 commit：

- `1487655` 新增「轉換 TW IG Core」按鈕，自動注入 `meta.profile` 至每個 resource

---

## 這一版最像內容清理的地方：移除病人原文輸出

這次 commit 很有感的一點，是你明確把：

- FHIR 交付頁
- 報表

中的病人對話原文輸出拿掉。

這代表系統在這一版正式選擇：

- 不再用逐字稿證明自己有內容
- 改用整理後欄位、臨床摘要、mapping 結果與治理結構來證明價值

這其實是成熟化很關鍵的一步，因為逐字稿雖然真實，但會帶來：

1. 隱私風險
2. 髒訊息風險
3. 醫療語氣失控
4. 評審閱讀負擔

拿掉原文之後，整份 FHIR 交付會更像正式草稿，而不是聊天紀錄 dump。

代表 commit：

- `1487655` 移除 FHIR 交付頁與報表中所有病人對話原文輸出

---

## 這一版和前幾版相比，真正跨過了哪條線

### 前幾版比較像

1. 把 resource 一個一個修合法
2. 把內容一段一段修乾淨
3. 把 delivery gating、validator、history preview 補起來

### 這一版開始變成

1. `AI 身份` 有正式 `Device` resource
2. `PHQ-9 路徑` 被重新整理
3. `ClinicalImpression / Composition / Provenance` 的語言更像專業草稿
4. `FHIR mapping` 不再完全寫死，而可由前端介入調整
5. `TW IG Core` 展示能力被一鍵化
6. `病人原文` 正式退出交付主畫面，讓成品更乾淨

也就是說，這一版不只是「內容更好」，而是整個 FHIR 交付開始有：

- 標準化意識
- 治理意識
- 人工介入配置能力
- 展示層級可控性

---

## 這一版可以明確說已完成的收斂

1. AI 在 FHIR 裡的身份，從文字描述提升成正式 `Device` resource。
2. author / assessor / agent 等角色引用方式更一致，不再四散。
3. PHQ-9 與 QuestionnaireResponse 的責任邊界被重新整理。
4. ClinicalImpression note、Composition 首段、Provenance agent 語言都更像正式治理文件。
5. FHIR 欄位對映不再完全寫死，已能由醫師端調整。
6. TW IG Core profile 展示能力被顯性做出來。
7. 病人原話退出正式交付主畫面，整份輸出更乾淨、更能展示。

---

## 目前版本的合理定位

這份最終版仍然不是：

- 正式醫院上線版
- 完整 TW Core compliance 最終版
- 完全不需人工檢查的 clinical-grade final output

但它已經不是單純的工程 prototype。

這份最終版比較合理的定位是：

**一套可以清楚展示 AI 如何產生資料、病人如何授權、醫療端如何介入 mapping、系統如何轉向 TW IG Core 的 FHIR 交付原型。**

---

## 一句話總結

這次 `1487655` 的意義，在於它讓 `FHIR Draft` 從「已經可交付的草稿」再往前走成：

**一套有 AI 主體、有治理語言、有 mapping 配置層、有 TW IG Core 展示切換，而且更像正式醫療摘要的 FHIR 交付系統。**

