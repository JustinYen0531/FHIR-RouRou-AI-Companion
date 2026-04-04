# AI Companion Developer Audit

## 文件目的
這份文件是目前 AI Companion Node 版實作的開發者審核文檔，用來取代舊的 Dify Chatflow 基線說明。

用途有三個：
- 說明目前 repo 內真正可執行、可持續維護的基線架構。
- 說明目前版本和 [AI陪伴系統_產品需求文件.md](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/docs/AI陪伴系統_產品需求文件.md) 之間還有哪些差距。
- 提供後續每次修改程式邏輯、前端互動、FHIR 交付層時的固定檢查清單。

這份文件是內部技術文檔，不是對外產品介紹。

## 目前基線狀態
目前主力基線已不是 Dify Chatflow，而是本 repo 內的 Node 程式版架構。

核心入口如下：
- [app/aiCompanionEngine.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/aiCompanionEngine.js)：對話路由、風險分流、補問狀態機、結構化摘要生成。
- [app/fhirDeliveryServer.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirDeliveryServer.js)：本地 HTTP server，提供前端頁面與 API。
- [app/index.html](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/index.html)：本機 demo UI。
- [app/app.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/app.js)：前端互動邏輯。
- [app/fhirBundleBuilder.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirBundleBuilder.js)：internal state 轉 FHIR Bundle。
- [app/fhirBundleValidator.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirBundleValidator.js)：第一版規則驗證。

目前可直接啟動：

```powershell
node app\fhirDeliveryServer.js
```

預設服務位址：

`http://localhost:8787`

這代表：
- 系統主體已從「Dify workflow 編排」切換成「程式碼控制的對話狀態機」。
- 後續審核基準應以 Node 實作、測試檔與本機 API 行為為準。
- 舊的 chatflow 相關描述若未同步更新，會誤導維護者對實際能力的判斷。

## 為什麼要從 Dify 切到程式碼基線
這次切換不是單純搬家，而是架構控制權的轉移。

切換後的主要差異：
- 對話流程、狀態變數、輸出生成都可直接在程式碼中版控與測試。
- 風險分流、補問邏輯、命令式輸出生成，不再依賴外部 flow editor。
- 前端、AI 引擎、FHIR 交付層可以在同一個 repo 內一起演進。
- 後續要補病患審閱、授權、FHIR server handoff 時，程式碼基線更容易落實 API contract。

代價也很明確：
- 原本用節點圖就能看懂的流程，現在需要靠程式碼與文檔維護可讀性。
- 若沒有足夠的測試與文件，狀態機更容易在重構時回退。

因此這份 audit 的核心任務，是補上切換後的可維護性與審核標準。

## 目前 Node 版架構概觀

### 1. 互動入口
前端 UI 由 [app/index.html](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/index.html) 與 [app/app.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/app.js) 提供，經由 [app/fhirDeliveryServer.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirDeliveryServer.js) 呼叫：
- `POST /api/chat/message`
- `POST /api/chat/output`
- `POST /api/fhir/bundle`

### 2. 對話核心
[app/aiCompanionEngine.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/aiCompanionEngine.js) 目前負責：
- 高風險訊號判斷與 safety route。
- 六模式路由與手動 override。
- 低能量 / 認知負擔偵測。
- 補問狀態保存與兩輪內收斂。
- tag / HAM-D / summary / clinician summary / patient review / FHIR draft 的狀態生成。

### 3. 結構化輸出層
目前 internal state 已可逐步累積以下欄位：
- `latest_tag_payload`
- `red_flag_payload`
- `hamd_progress_state`
- `burden_level_state`
- `summary_draft_state`
- `clinician_summary_draft`
- `patient_review_packet`
- `patient_authorization_state`
- `fhir_delivery_draft`
- `delivery_readiness_state`

### 4. 交付層
[app/fhirBundleBuilder.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirBundleBuilder.js) 與 [app/fhirDeliveryServer.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirDeliveryServer.js) 目前已提供：
- internal session export 轉 FHIR transaction Bundle。
- dry-run 驗證與阻擋。
- 可選的外部 FHIR server transaction POST。

## 目前已落地的核心能力

### 1. 高風險安全分流
目前已落地：
- 以程式碼規則先做 high-risk pattern 偵測。
- 高風險輸入優先走 safety route，不落入一般聊天。
- 命中時會寫入 `risk_flag = true`。
- 命中時會寫入 `red_flag_payload` 與 `latest_tag_payload`。

目前仍未完成：
- 尚未明確區分低 / 中 / 高 / 立即危險多級風險。
- 尚未接外部通報、臨床通知或 escalation workflow。
- 仍主要依賴 pattern 與 LLM 結構化輸出，沒有更完整的風險規則治理。

### 2. 六模式路由與手動切換
目前程式碼中可見模式：
- `mode_1_void`
- `mode_2_soulmate`
- `mode_3_mission`
- `mode_4_option`
- `mode_5_natural`
- `mode_6_clarify`
- `followup`
- `safety`

目前已落地：
- 支援 auto routing。
- 支援手動 override 到指定模式。
- 高風險與 follow-up 是獨立 route，不只是 prompt 語氣差異。

目前仍未完成：
- UI 仍不是完整的模式切換面板產品形態。
- 不同模式的互動視覺差異仍偏 demo 等級。
- `Void Box`、`Soul Mate`、`Mission Guide`、`Option Selector` 的前端體驗尚未完整產品化。

### 3. 補問狀態機
目前已落地：
- `pending_question`
- `followup_turn_count`
- `followup_status`
- 兩輪內收斂的 follow-up 流程

目前行為：
- 若輸入資訊不足，可轉進 `mode_6_clarify`。
- 若 follow-up 還需要再問，最多再問一次。
- 若已達上限或負擔高，會改走 `followupFinalizer` 收斂回答。

目前仍未完成：
- 補問原因未做更細的 schema 分類。
- 補問與 HAM-D 維度缺口之間還沒有嚴格映射規則。
- 補問品質仍高度依賴 prompt。

### 4. 負擔感知與回應風格調整
目前已落地：
- 低能量 / 認知負擔檢測。
- `burden_level_state`
- 根據負擔調整 `response_style` 與 `followup_budget`。
- 高負擔或短句時傾向降級到 `option` / `soulmate`。

目前仍未完成：
- 尚未結合實際打字速度、停頓、深夜活躍等行為遙測。
- 還沒有把負擔狀態做成可視化或長期趨勢。

### 5. 四大標籤與 HAM-D 狀態
目前已落地：
- `latest_tag_payload` 已有 `sentiment_tags`、`behavioral_tags`、`cognitive_tags`、`warning_tags`。
- `hamd_progress_state` 已可保存已覆蓋維度、缺口維度、下一個建議維度。
- `summary_draft_state` 已把 tag / risk / HAM-D 狀態收斂為統一摘要草稿。

目前仍未完成：
- 四大標籤仍是第一版 JSON contract，尚未完全標準化。
- HAM-D 還不是完整 17 項進度治理。
- 某些 PRD 提到的行為指標目前還沒有真實資料來源，只能依使用者文字推估。

### 6. 醫師摘要、病患審閱、FHIR Draft
目前已落地：
- 可按需生成 `clinician_summary_draft`。
- 可按需生成 `patient_review_packet`。
- 可按需生成 `patient_authorization_state`。
- 可按需生成 `fhir_delivery_draft`。
- 可按需生成 `delivery_readiness_state`。

目前仍未完成：
- 病患尚無真正可編輯、可逐段刪改、可授權提交的正式 UI。
- 授權狀態目前是結構化草稿，不是法律或流程上可成立的真實同意證據。
- `FHIR Draft` 還不是醫院實務可直接上線的 production contract。

### 7. FHIR 交付層
目前已落地：
- 可把 session export 轉成 transaction Bundle。
- 第一版 Bundle 已包含 `Patient`、`Encounter`、`QuestionnaireResponse`、`Observation`、`Composition`、`DocumentReference`、`Provenance`。
- 具備 `validation_report`、`validation_errors`、`blocking_reasons`。
- `POST /api/fhir/bundle` 可做本地 dry-run。
- 設定 `FHIR_SERVER_URL` 時可送外部 transaction。

目前仍未完成：
- 尚未接真正的 TW Core validator / IG package 驗證器。
- 尚未有 production-ready retry、credential、audit log、adapter layer。
- 尚未有可成立的 `Consent` resource 與正式授權證據鏈。

## 與 PRD 的對齊程度

### 已對齊或部分對齊
- 已有陪伴型聊天入口與自然聊天模式。
- 已有高風險警示分流。
- 已有五大模式主軸與實際程式路由。
- 已有四大標籤第一版結構化輸出。
- 已有 HAM-D 導向的狀態追蹤。
- 已能產生醫師摘要草稿、病患審閱稿、FHIR draft。
- 已有本地交付層 API 與 FHIR Bundle builder。

### 仍與 PRD 有差距
- PRD 強調的「日常推播」與長期非同步關懷，尚未形成完整機制。
- PRD 描述的行為分析包含打字延遲、語句長度、凌晨活躍等，目前尚未真正落地。
- PRD 期待完整 HAM-D 觀察框架，現況仍是簡化版維度管理。
- PRD 期待視覺化趨勢圖與醫師報告格式，現況仍以 JSON draft 與文字草稿為主。
- PRD 期待病患在 App 中審閱、刪除敏感資訊、補註與授權，現況仍停在草稿與狀態層。
- PRD 提到 OAuth / 正式隱私授權與 HIS/EHR 整合，現況尚未完成。

## 目前階段判定
以目前 Node 程式版基線來看，整體狀態建議判定為：

- `P0`: 已完成第一版
- `P1`: 已完成第一版
- `P2`: 已完成第一版
- `P3`: 已開始且已有可運行 MVP

### P0：流程正確性與安全
目前狀態：`已完成第一版`

已達成：
- 高風險優先分流。
- 一般聊天與 safety route 分離。
- 補問最多兩輪後收斂。
- 可透過測試驗證核心路由。

尚未達成：
- 風險分級與 escalation 還不夠細。
- 安全規則與審計證據仍可再加強。

### P1：資料蒐集能力
目前狀態：`已完成第一版`

已達成：
- 四大標籤第一版。
- HAM-D 第一版進度狀態。
- 統一摘要草稿狀態。
- 醫師摘要草稿可生成。

尚未達成：
- 四大標籤 schema 尚未穩定。
- HAM-D 尚未完整 17 項化。

### P2：體驗與成本優化
目前狀態：`已完成第一版`

已達成：
- 低能量檢測。
- 自動降級。
- 選項式互動與微介入卡片規則已開始落地。
- 自然聊天不必每輪都走重型輸出生成。

尚未達成：
- 前端模式體驗仍偏 demo。
- 成本監控與 retrieval 觀測指標仍不夠完整。

### P3：醫療交付能力
目前狀態：`已開始且已有可運行 MVP`

已達成：
- 醫師摘要、病患審閱、FHIR draft 可按需生成。
- internal state 可轉 FHIR Bundle。
- 已有 delivery API 與外部 FHIR transaction 能力。

尚未達成：
- 缺正式病患授權 UI 與證據鏈。
- 缺 production-ready 醫院整合能力。

## 從舊版 Dify 文檔切換時必須注意的觀念修正
- 目前審核對象不再是 YAML 節點圖，而是 `engine + server + frontend + bundle builder` 的整體系統。
- 原本文檔中所有「node」「chatflow」「新版 DSL」的表述，都應優先改寫成程式模組、函式責任、API contract、state contract。
- 舊文檔裡把某些能力寫成「已補回到 chatflow」，現在應改為「已在 Node engine 中落地」。
- 若 PRD 與實作不一致，應以「目前程式真實行為」為基準記錄，再列出缺口，不應繼續沿用已不存在的 flow 假設。

## 建議的後續補強順序

### 1. 穩定 state contract
- 把 `latest_tag_payload`、`hamd_progress_state`、`summary_draft_state`、`patient_review_packet`、`fhir_delivery_draft` 的欄位契約固定下來。
- 把允許值、缺省值、版本號、相容性策略寫清楚。

### 2. 補齊病患審閱與授權 UI
- 先讓病患可以看、改、刪、標記不分享。
- 再把授權行為轉成可追蹤的 evidence model。

### 3. 強化 HAM-D 與行為觀察
- 補完整 17 項治理。
- 規劃哪些指標是真正可量測，哪些只能文字推估。

### 4. 強化醫療交付品質
- 引入更正式的 validator。
- 補 retry、audit log、credential 管理。
- 預留 HIS / EHR adapter。

## 開發者每次修改前必問的問題

### A. 產品定位檢查
- 這次改動是否讓系統更像客服，而不是陪伴型 AI？
- 這次改動是否讓對話更像量表盤問，而不是自然引導？
- 這次改動是否增加病患負擔？
- 這次改動是否仍服務於診前整理與醫療交付主線？

### B. 安全檢查
- 高風險輸入是否仍然優先進 safety？
- 新的 prompt 或規則是否會讓危機訊號被一般聊天吞掉？
- `risk_flag`、`red_flag_payload`、相關 metadata 是否仍可被正確保存？

### C. 狀態機檢查
- `pending_question` 是否會在錯的時機被清掉？
- `followup_turn_count` 是否可能失控？
- `routing_mode_override`、`active_mode`、`followup_status` 是否彼此一致？

### D. 資料契約檢查
- 這次改動是否破壞既有 session export 結構？
- `clinician_summary_draft`、`patient_review_packet`、`fhir_delivery_draft` 是否仍可被下游安全使用？
- Bundle builder 是否仍能處理新的欄位形狀？

### E. PRD 對齊檢查
- 這次改動是否更接近四大標籤架構？
- 這次改動是否更接近 HAM-D 導向觀察，而不是更遠？
- 這次改動是否有助於病患審閱、授權與 FHIR handoff？

## 建議維護的測試矩陣
目前至少應固定測：
- 高風險輸入是否進 safety。
- 一般自然聊天是否產出 tag 與 burden state。
- 命令式輸出是否能生成 clinician summary。
- follow-up 是否在兩輪內收斂。
- FHIR Bundle dry-run 是否可成功生成。
- 前端 micro intervention 是否在高風險場景被抑制。

對應現有測試檔：
- [app/aiCompanionEngine.test.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/aiCompanionEngine.test.js)
- [app/fhirDeliveryServer.test.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirDeliveryServer.test.js)
- [app/fhirBundleBuilder.test.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirBundleBuilder.test.js)
- [app/microInterventionRules.test.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/microInterventionRules.test.js)

## 本文檔建議後續固定附帶的版本資訊
- 文檔版本
- 最後更新日期
- 對應程式基線
- 本次新增能力
- 本次移除能力
- 已知風險

## 結論
AI Companion 現在的真實狀態，已不是「一個待補強的 Dify chatflow」，而是「一個已具備 Node 對話引擎、前端 demo、FHIR 交付 MVP 的程式系統」。

它已經比舊版文檔描述的狀態更前進，尤其是在：
- 對話狀態機程式化。
- 醫師摘要 / 病患審閱 / FHIR draft 按需生成。
- FHIR Bundle builder 與 delivery API 落地。

但它仍未完全符合 PRD，缺口主要集中在：
- 完整 HAM-D 與行為觀察。
- 正式病患審閱 / 授權流程。
- production-ready 的醫療整合能力。

後續這份文件的角色，不再是記錄 Dify 節點有沒有補回來，而是持續約束 Node 版 AI Companion 沿著同一條產品主線前進，不要在重構、擴充與前端美化過程中偏離產品核心。

