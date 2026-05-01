# AI × FHIR × 臨床設計筆記
## 導師互動 × 外部資源 × 實作對照版

更新日期：`2026-04-30`

這份文件不是單純整理外部資料，也不是單純整理導師建議。  
它的目的，是把三件事情扣在一起：

1. 你和導師討論後得到的問題意識
2. 你從外部蒐集到的資源與設計原則
3. 你後來真的在專案裡做出的改變，以及相關 commit

---

## 截圖補充

### 1. 導師互動與問題收斂畫面

![導師互動與問題收斂畫面](./導師互動與實作對照_附件/01_導師互動畫面.png)

<sub>這張圖保留的是你和導師針對臨床使用情境、欄位形式與操作負擔的實際往返。把它放進這份設計筆記，是為了讓後面那些外部資源整理與實作映射，不會看起來像憑空補寫，而是有明確對話脈絡作為起點。</sub>

---

## ① 資料分類 — Observation / Condition

### 外部資源

- `FHIR 官方 / Observation resource`
明確指出 `Observation` 比較適合承載量測、評估結果、訊號，不是正式診斷本體。

- `dr7.ai / FHIR 結構化資料與 AI 推論`
強調透過結構化編碼與清楚資料邊界，才能讓 AI 推論更安全、可驗證。

- `johnsnowlabs / 非結構文字轉 FHIR resource`
說明 NLP 萃取過程中，`Condition` 與 `Observation` 應該分層處理，而不是全部塞成單一文字摘要。

### 導師互動後的整理結論

- AI 推論資料優先放在 `Observation`。
- 若是長期、多次、持續性問題，才適合整理成 `Condition` 式的彙整概念。
- AI 是 `signal`，醫師才是 `judgment`。
- 系統應定位成輔助工具，不是診斷主體。

### 對你的設計影響

- 你後來明顯把系統往「先整理訊號，再交給醫師判讀」這個方向推。
- 這也是為什麼你沒有讓 AI 直接生成強診斷語氣，而是反覆清理 symptom summary、clinical summary、evidence mapping。
- 你的 FHIR 流程實際上在做的是：先把病人語句變成可讀的 symptom observation，再把更高層的臨床理解留給 `ClinicalImpression` 或醫師端。

### 你實際做出的改變

- 導入 `AI symptom bridge`，讓症狀整理從規則拼貼改成「證據軌 + 推論軌」。
- 清掉操作句、快捷指令、模式切換語句，避免這些污染 `Observation` 候選值。
- 把 `Observation` 的 `valueString` 調整成更像臨床可讀摘要，而不是聊天原文轉抄。
- 把 `ClinicalImpression` 與 `Observation` 分開補強，沒有把所有臨床解讀都擠進同一層。

### 相關 commits

- `bd9727f` Add AI symptom bridge for FHIR draft generation
- `664274a` Refine symptom summaries and trim FHIR draft noise
- `4e7e6b9` Harden symptom bridge sanitization and dedupe polluted draft artifacts
- `1ce31c1` Filter output-control commands from symptom evidence
- `34e7c56` Retain somatic symptoms in AI symptom bridge and draft outputs
- `f581b3a` fix(Observation): valueString 改為可讀臨床摘要句，note 上限2筆並套用cleanEvidence
- `e197c47` fix(ClinicalImpression): description保守化、finding各自綁basis、note加風險標記、status改preliminary

### 這題最能代表你的設計句

`AI 先把病人的話整理成可用訊號，但不直接搶走醫師的判斷位置。`

---

## ② Encounter 使用邏輯

### 外部資源

- `itirra / Agentic AI 與 FHIR 的邊界`
指出聊天機器人不等於真正的自主醫療 agent，也不代表每次互動都必須視為正式 Encounter。

- `tateeda / 醫療 chatbot SMART on FHIR`
提醒最小必要存取與責任邊界，避免把所有聊天都誤設成正式醫療接觸。

### 導師互動後的整理結論

- AI 對話不一定都要建 `Encounter`。
- 只有當互動更接近正式醫療行為、診前整理、臨床接觸記錄時，才比較合理使用 `Encounter`。
- 一般陪伴聊天、症狀收集、情緒承接，不該過度包裝成正式醫療 encounter。

### 對你的設計影響

- 你沒有把 Rou Rou 的所有聊天內容都硬升格成醫療 Encounter。
- 你更像是在建立一條「可轉成醫療資料」的流程，而不是把整段聊天原封不動醫療化。
- 後面你對 `Encounter` 的補強集中在 status、period、serviceType，反而不是擴張 Encounter 責任範圍。

### 你實際做出的改變

- 修正 `Encounter` 狀態與時間欄位，讓它比較像正式接觸記錄，而不是模糊容器。
- 補上 `serviceType`，讓 Encounter 更有照護情境感。
- 讓病人 profile、FHIR refresh、history preview 等流程補的是交付品質，不是把聊天全部升成 Encounter。

### 相關 commits

- `38b70e4` fix(Encounter): status 改為 finished 預設、period 分離 sessionStartedAt/sessionEndedAt、補 serviceType
- `3de87ee` feat: wire patient profile intake into FHIR draft
- `69d1e57` Add patient-only FHIR refresh flow
- `6260575` feat: add preview for fhir history entries

### 這題最能代表你的設計句

`不是因為有聊天就一定有 Encounter，而是因為這段互動被整理成可交付的照護接觸時，Encounter 才有意義。`

---

## ③ 病人參與與 QuestionnaireResponse

### 外部資源

- `FHIR 官方 / QuestionnaireResponse`
清楚區分 `author`、`subject`、`source`，支援病人填寫、確認與臨床端後續使用。

- `AHRQ / PRO FHIR IG`
推動病人自述結果跨系統交換，強調病人回傳資料本身就是重要臨床輸入。

- `MARVIN Chatbots 共同設計研究`
指出病人參與、可理解性、接受度與安全性，是 AI 問卷設計的重要條件。

### 導師互動後的整理結論

- 病人可以修改 AI 草稿。
- 病人審閱不是可有可無，而是降低誤判風險的重要步驟。
- 最佳流程不是「AI 說了算」，而是 `AI draft -> 病人確認 -> 醫師使用`。

### 對你的設計影響

- 你開始把病人從「被 AI 整理的對象」往「共同確認資料的人」推。
- PHQ-9、patient profile、patient-only refresh、self-report summary，其實都在補這條病人參與鏈。
- `QuestionnaireResponse` 也不再只是形式存在，而是承接病人輸入、描述與後續輸出的中介層。

### 你實際做出的改變

- 導入 PHQ-9 雙軌流程，讓病人可以逐題填答與補充自由敘述。
- 把病人 profile intake 接進 FHIR draft。
- 讓 `QuestionnaireResponse` 的 recent evidence 經過清洗，不再把操作句誤當病人內容。
- 醫師端開始能看到病人自評摘要，代表病人的自述資料真的被送上臨床閱讀鏈。

### 相關 commits

- `c24ebb4` Add PHQ-9 dual-track assessment flow
- `1839ef6` Improve PHQ-9 prompt sync and button layout
- `a97ca5d` Restore PHQ-9 prompt gating and fix button state
- `925cd04` Integrate PHQ-9 into structured drafts
- `3de87ee` feat: wire patient profile intake into FHIR draft
- `28d2f35` fix(QR): recent_evidence 套用清洗規則，移除操作句/求助句/過短句/重複句，上限5筆
- `11c5549` Align QuestionnaireResponse notes with actual test payload
- `01ccc40` Show patient self-report summary to doctors

### 這題最能代表你的設計句

`病人不是資料來源而已，也是資料確認者。`

---

## ④ 醫師使用習慣與責任分工

### 外部資源

- `Johns Hopkins Carey / AI 出錯誰負責`
法律責任仍回到採用 AI 結果的人，而不是 AI 本身。

- `NIH PMC / 醫師採用 AI 建議的責任感知`
顯示 AI 只是建議來源，真正採納與判讀責任仍在醫療專業者。

- `NIH PMC / AI 放射科責任歸屬`
若醫師不同意 AI 結果，應能說明理由，反映「AI 可輔助，但不能取代責任主體」。

### 導師互動後的整理結論

- 醫師偏好結構化資料，而不是一大坨自由文字。
- 醫師可接受「點選確認 + 少量補充」，不接受高操作負擔。
- 責任關鍵不是診間或非診間，而是「誰在判讀」。

### 對你的設計影響

- 你開始把醫師端做成工作台，而不是讓醫師直接進病人聊天頁。
- 你讓系統預設先整理好內容，再讓醫師確認、微調、補充。
- 這也是為什麼你後來補了 doctor workspace、order form、self-report summary、HAMD 追蹤，而不是把醫師端做成另一個大型聊天介面。

### 你實際做出的改變

- 建立雙角色登入系統與醫師專屬工作台。
- 將醫師端切成病人列表、病人詳情、病歷送入、醫囑輸入等明確責任區。
- 顯示病人自評與安全摘要給醫師看，讓醫師接收到的是整理後資訊。
- 設計結構化 doctor order form，而不是只留一塊空白文字框。

### 相關 commits

- `cd9a4fa` feat: add v1 dual-role authentication system
- `dbed020` feat: add doctor patient workspace prototype
- `a7f3ac2` feat: add FHIR-mapped medical record input on doctor workspace
- `92de393` Design structured doctor order form
- `8052ce1` Restructure doctor nav: 病人 tab shows usage only, 指派 tab handles 病歷/醫囑 input
- `01ccc40` Show patient self-report summary to doctors
- `d86d1e2` feat: 醫師端「病人自評與安全摘要」加入 HAMD 量表追蹤

### 這題最能代表你的設計句

`AI 幫醫師省整理的力，不幫醫師背判讀的責。`

---

## ⑤ 非診間互動與不能被忽略的重要訊息

### 外部資源與導師提醒

- 非診間資料回傳若沒有處理機制，就會出現「病人以為有送到、系統其實沒被看見」的風險。
- 核心不是資料能不能回傳，而是重要訊息不能無聲地被忽略。

### 導師互動後的整理結論

- 病人非診間回傳資料會產生責任與通知問題。
- 系統必須有某種提醒、待處理、不可默默消失的設計。

### 對你的設計影響

- 你後來做的不是複雜 notification center，而是先把「有狀態、可追蹤、會留下痕跡」的骨架做出來。
- 醫師端的 assignment、病歷送入狀態、order status、patient summary、FHIR history preview，其實都在往「不能被忽略」靠。

### 你實際做出的改變

- 建立 patient assignment delivery 與 backend persistence。
- 讓 doctor assignment tab 可以穩定刷新與保存。
- 將病人 reports、PHQ9 state、FHIR history 保留下來，避免重要內容因刷新或登入切換消失。

### 相關 commits

- `6a8f0f7` Persist doctor assignments on backend
- `cb71f3d` Stabilize patient assignment delivery
- `d8d0a40` Refresh doctor assignment tab reliably
- `2f0f19b` Persist patient reports and PHQ9 state
- `6260575` feat: add preview for fhir history entries
- `3bed992` fix(report): persist report outputs across page refresh

### 這題最能代表你的設計句

`系統不能只會收資料，還要保證重要資料不會靜悄悄地失蹤。`

---

## ⑥ 判讀責任與 AI 醫療法律

### 外部資源

- `Johns Hopkins Carey`
現行法律仍以合理醫師標準看待責任，不把 AI 當獨立責任主體。

- `NIH PMC / 陪審員責任研究`
採納 AI 建議是否合理，最後仍會回到人類專業判斷與可否說明。

- `NIH PMC / 放射科 AI 責任評論`
AI 可做輔助，但臨床判讀者必須能對結果負責，且不同意時要能解釋。

### 導師互動後的整理結論

- 關鍵不是「資料在哪裡產生」，而是「誰最後在用它判讀」。
- 系統若想降低法律風險，就必須把 AI 的位置設計成整理者、提醒者、輔助者。

### 對你的設計影響

- 你沒有把系統做成自動診斷器。
- 你把很多內容停在 `draft`、`summary`、`trace`、`suggested_score`、`preliminary` 這些帶有保留性的語氣。
- 你還特別做了 `Clinical Debug Trace`，這其實也有責任邊界的味道：讓人知道 AI 怎麼走到這一步，而不是黑盒判讀。

### 你實際做出的改變

- `ClinicalImpression` 採保守描述與 `preliminary` 狀態。
- 建立 Clinical Debug Trace、decision source 可視化、LLM vs rule path。
- 讓後處理器與系統規則可解釋，降低「AI 為什麼這樣問」的不透明性。

### 相關 commits

- `e197c47` fix(ClinicalImpression): description保守化、finding各自綁basis、note加風險標記、status改preliminary
- `497f94c` feat: 統一臨床後處理器 clinicalPostProcessor
- `2632198` feat: 加入 Clinical Debug Trace 可視化系統
- `29ec1cc` feat: 加 AI 決策紀錄面板
- `1a4402a` feat: clinical trace shows LLM source vs system rule + flowchart decision path
- `db71d92` feat: 可視化所有決策來源（LLM / 規則 / 混合）

### 這題最能代表你的設計句

`AI 可以參與形成內容，但不能在責任上假裝自己是最後判讀者。`

---

## ⑦ FHIR PoC 實作策略

### 外部資源

- `SPIE 2025 / FHIR-based AI pipeline`
指出 FHIR pipeline 相較 ad-hoc JSON 在資料完整性上有優勢，即使延遲稍高也有交換價值。

- `dashtechinc / AI × FHIR 互通性架構`
強調 NLP 轉 FHIR resource、事件驅動與互通性架構的重要性。

- `FHIR-Former / NIH PMC 2025`
說明 FHIR 標準化資料可以作為更可擴展的 AI / 預測模型框架基礎。

### 導師互動後的整理結論

- 比賽 / PoC 不必一開始就做到完整 TW Core 合規。
- 評審更在意資料流合理、resource 使用正確、系統角色清楚。
- `PoC = 展示概念`，不是一次把 production compliance 全背上身。

### 對你的設計影響

- 你實作上非常明顯地採取了 PoC 優先策略。
- 一方面你持續補 validator、一致性、資源契約；另一方面你沒有把時間全部耗在正式治理與完整法規合規。
- 你做的是「足夠正確、足夠清楚、足夠能展示」的 FHIR pipeline。

### 你實際做出的改變

- 建立並持續修正 FHIR draft、bundle builder、validator、sample output 的一致性。
- 新增 quick check 與 resource-by-resource hardening。
- 將 draft / UI / builder 對齊，避免理想型宣告和實際輸出脫節。

### 相關 commits

- `92276d0` Align FHIR draft and bundle delivery resources
- `1905704` fix: normalize auth/readiness states for FHIR delivery gating
- `6f54f2c` feat: add one-click FHIR delivery quick check
- `8c79630` fix: align fhir bundle statuses with validator
- `baf56f1` fix: harden fhir submission delivery
- `e7a092f` Fix HAPI ClinicalImpression delivery status

### 這題最能代表你的設計句

`這個階段先證明資料流是合理的，再去追正式醫療交換的完整合規。`

---

## ⑧ 系統設計總結

### 你和導師收斂出的推薦資料流

```text
AI 對話
  ↓
QuestionnaireResponse（原始 / 確認）
  ↓
Observation（結構化症狀）
  ↓
Condition（長期問題，必要時彙整）
  ↓
醫師判讀
```

### 系統角色分工

| 角色 | 負責 |
|---|---|
| AI | 收集、整理、提示、補結構 |
| 病人 | 回答、補充、確認 |
| 醫師 | 判斷、採納、修正、負責 |

### 這條設計線如何映到你實際的系統

- AI 對話端：`aiCompanionEngine`、Smart Hunter、自動分流、clinicalPostProcessor
- 病人確認端：PHQ-9、patient profile intake、patient-only refresh、自評摘要
- 結構化資料端：FHIR draft、Observation / QuestionnaireResponse / ClinicalImpression / Composition
- 醫師使用端：dual-role auth、doctor workspace、assignment、醫囑 / 病歷輸入
- 可解釋與可追溯端：Clinical Debug Trace、decision source、FHIR history preview

### 最能對應這個總結的 commits

- `bd9727f` Add AI symptom bridge for FHIR draft generation
- `3de87ee` feat: wire patient profile intake into FHIR draft
- `c24ebb4` Add PHQ-9 dual-track assessment flow
- `cd9a4fa` feat: add v1 dual-role authentication system
- `dbed020` feat: add doctor patient workspace prototype
- `497f94c` feat: 統一臨床後處理器 clinicalPostProcessor
- `2632198` feat: 加入 Clinical Debug Trace 可視化系統
- `c46c118` feat: Hybrid HAM-D 評分機制 — slider UI + 加權評分 + probe_meta
- `079312d` feat: LLM semantic dimension classification guides target item instead of keyword count

### 最後一句總結

`你的決賽期實作，不只是把 AI 接上 FHIR，而是把 AI、病人、醫師三者在資料與責任上的位置慢慢分清楚。`

