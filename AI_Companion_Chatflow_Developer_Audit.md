# AI Companion Chatflow 開發者自我審核文檔

## 文件目的
這份文件是給開發者與後續維護者使用的「架構說明 + 自我審核基準」。

用途有三個：
- 說明目前 [AI_Chatflow.yml](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Chatflow.yml) 已經實作了哪些處理機制。
- 說明目前版本和 [AI_Companion_PRD.md](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Companion_PRD.md) 之間還有哪些差距。
- 提供未來每次修改 chatflow 時的固定檢查清單，避免功能增加後反而背離 AI Companion 的核心定位。

這份文件不是給最終使用者看的產品文案，而是內部技術審核文檔。

## 目前基線狀態
目前可在新版 Dify 匯入成功的主力檔案，已改為 [AI_Chatflow_Fresh_Export.yml](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Chatflow_Fresh_Export.yml)。

原因是舊的 [AI_Chatflow.yml](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Chatflow.yml) 雖然邏輯完整，但屬於舊 `advanced-chat` DSL 形狀，會在目前 Dify 版本的匯入器產生前端 schema 相容性問題。

這代表：
- 目前 repo 中真正可持續增強的 chatflow 基線，已從舊 [AI_Chatflow.yml](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Chatflow.yml) 轉移到新版骨架的 [AI_Chatflow_Fresh_Export.yml](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Chatflow_Fresh_Export.yml)
- 目前的首要目標不是功能最多，而是「新版 DSL 可匯入、可開啟、可逐步疊代」
- `P0` / `P1` / `P2` 的判定，必須以新版骨架版是否真正落地為準，而不是以前規劃版的理想狀態

## 新版重建後的功能倒退清單
以下是把 flow 換到新版 Dify 匯出骨架後，和原本目標設計相比出現的功能倒退。這一段是目前最重要的自我審核基準。

### 1. 高風險安全分流已補回第一版
目前 [AI_Chatflow_Fresh_Export.yml](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Chatflow_Fresh_Export.yml) 已新增：
- `Risk Detector`
- `Risk Structurer`
- `Set Risk State`
- `Clear Risk State`
- `Safety Response`
- `risk_flag`
- `red_flag_payload`

目前已恢復的能力：
- 危機訊號會先經過高風險分類，而不是直接進一般模式
- 命中時會留下 `risk_flag`
- 命中時會留下簡易 JSON 形狀的 `red_flag_payload`
- 命中時會清空 `pending_question`，避免掉回一般補問流程

目前仍未完成：
- 尚未區分中風險 / 高風險 / 立即危險
- 尚未做更細的 red flag 類別標準化
- 尚未做外部通報或醫療端通知

### 2. 補問狀態機已補回可收斂版本
目前新版骨架版已新增：
- `followup_turn_count`
- `followup_status`
- `active_mode`
- `Follow-up Limit Gate`
- `Follow-up Output Classifier`
- `Follow-up Finalizer`
- `Save Follow-up Question`

目前已恢復的能力：
- 已有跨回合補問狀態
- 第一輪補問後可再進一次 follow-up
- 若 `Follow-up Resolver` 判斷還要補一題，會留下第二輪補問
- 若已達第二輪上限，會強制走 `Follow-up Finalizer`
- `Clear Pending Question` 會同步清掉補問狀態，避免殘留

目前仍未完成：
- 沒有更細緻的補問原因分類
- 沒有補問對應 HAM-D 維度記錄

### 3. classifier 與 retrieval 的解耦已補回
目前新版骨架版已恢復為：
- `Intent Classifier` 不吃 retrieval context
- `mission` 使用 retrieval
- `option` 使用 retrieval
- `natural` 不使用 retrieval

目前已恢復的能力：
- 一般自然聊天不再每輪打知識庫
- classifier 與 retrieval 已重新拆開
- 成本控制回到較符合 PRD 的低干擾設計

### 4. P1 的結構化資料能力已補回第一版
目前新版骨架版已新增：
- `latest_tag_payload`
- `Tag Structurer`
- `Save Tag Payload`
- `hamd_progress_state`
- `HAM-D Progress Tracker`
- `Save HAM-D Progress`
- `summary_draft_state`
- `Summary Draft Builder`
- `clinician_summary_draft`
- `Clinician Summary Builder`
- `Save Clinician Summary`

目前已恢復的能力：
- 一般正常回合會產生四大標籤的簡化 JSON
- 高風險 safety 路徑也會把結果寫進 `latest_tag_payload`
- 一般非高風險回合都可更新一份簡化的 HAM-D 進度狀態
- `Mission Guide` 已能讀取 `hamd_progress_state`
- tag payload 已開始區分 `route_type / source_mode / followup_status`
- 已開始把 tag / risk / HAM-D 狀態收斂到 `summary_draft_state`
- 已可從 `summary_draft_state` 進一步生成 `clinician_summary_draft`
- 已有第一版可交付的診前摘要草稿欄位

目前仍未完成：
- 標籤欄位仍是簡化版 JSON 字串
- follow-up 已會經過一般 tag 路徑，但 safety / follow-up 的統一摘要模型仍可再標準化
- 尚未把 HAM-D 狀態做成真正的完整 17 項維度進度控制

### 5. Mission 的 HAM-D 導向能力已補回第一版
目前 `mission` 已不只是 prompt level。
已新增：
- `hamd_progress_state`
- `HAM-D Progress Tracker`
- `Mission Guide` 讀取既有 HAM-D 狀態

目前仍未完成：
- 維度覆蓋雖已限制到固定集合，但仍是簡化狀態
- 沒有完整 17 項進度管理
- 沒有 UI 進度條
- 沒有醫師摘要級別的維度時間線

## 目前所在階段判定
以新版可匯入版本 [AI_Chatflow_Fresh_Export.yml](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Chatflow_Fresh_Export.yml) 來看，目前整體狀態應判定為：

- `P0`: 已完成
- `P1`: 已完成
- `P2`: 尚未開始
- `P3`: 已開始

更細的判定如下：

### P0：流程正確性與安全
目前狀態：`已完成`

已達成：
- 新版骨架可匯入
- 六模式分流可運作
- 已補回高風險分流第一版
- `risk_flag` / `red_flag_payload` 已回到 conversation state
- `pending_question` / `followup_turn_count` / `followup_status` / `active_mode` 已回到 conversation state
- 補問最多兩輪後會強制收斂
- classifier 沒有直接依賴 retrieval context
- `natural` 已從 retrieval 解耦

尚未達成：
- red flag 結構仍偏簡化版
- 高風險分級仍未細化

結論：
以目前這輪重建的範圍來說，可視為 `P0` 已完成；後續剩下的是 `P0+` 的精緻化，而不是流程正確性缺口。

### P1：資料蒐集能力
目前狀態：`已完成`

已達成：
- `latest_tag_payload` 已回到 conversation state
- 已有 `Tag Structurer`
- `hamd_progress_state` 已回到 conversation state
- 一般非高風險回合皆可更新 `HAM-D Progress Tracker`
- safety 路徑也已進入結構化資料狀態
- tag payload 已開始帶 `route_type / source_mode / followup_status`
- HAM-D 進度已限制在固定維度集合上
- `summary_draft_state` 已作為 pre-summary 統一狀態存在
- `clinician_summary_draft` 已可作為第一版醫師端摘要草稿狀態

尚未達成：
- 四大標籤尚未標準化
- follow-up / safety 的統一資料模型仍待進一步標準化
- `mission` 仍未做到完整 17 項逐維度推進

結論：
以目前範圍來說，`P1` 已完成第一版落地，因為已具備：
- 四大標籤的基礎結構化輸出
- HAM-D 導向狀態追蹤
- 統一的 pre-summary 狀態
- 第一版可交付的 `clinician_summary_draft`

後續剩下的是資料模型精緻化與醫療交付深化，應歸到 `P2/P3`，而不再是 `P1` 缺口。

### P2：體驗與成本優化
目前狀態：`未開始`

尚未落地：
- 自動模式降級
- 知識庫分用途
- `natural` / `option` / `mission` 的精細成本治理

結論：
目前仍未進到 `P2`。

### P3：醫療交付能力
目前狀態：`已開始`

已達成：
- 已新增 `patient_review_packet`
- 已新增 `Patient Review Builder`
- 已新增 `fhir_delivery_draft`
- 已新增 `FHIR Delivery Builder`
- `clinician_summary_draft` 之後已可再生成病人審閱包
- 病人審閱包之後已可再生成 FHIR / TW Core 映射草稿

尚未達成：
- 還沒有真正的病患按鈕式審閱 / 編輯 / 授權 UI
- 還沒有正式的 FHIR R4 resource payload 驗證
- 還沒有實際送往 FHIR server / HIS / EHR
- 還沒有 `preliminary -> final` 的授權後狀態轉換

結論：
目前 `P3` 已進入第一輪落地，但仍屬交付前草稿階段，重點是先把：
- 病人審閱資料包
- FHIR 映射草稿

這兩個「交付底座」先建立起來。

## 核心產品定位
AI Companion 的定位不是一般聊天機器人，而是：
- 以陪伴感為主，不讓病患覺得自己在被審問。
- 以診前整理為目標，逐步收集可用於 HAM-D 與醫療摘要的線索。
- 對高風險訊號要有優先處理能力。
- 對體力差、認知負擔高的病患，要能降低輸入負擔。

如果後續任何改動讓系統越來越像：
- 一般客服
- 量表機器
- 純閒聊 bot
- 每句都做 RAG 的高成本系統

就代表改動方向已經偏離 PRD。

## 目前 Chatflow 已實作的機制

### 1. 高風險優先分流
目前流程最前面會先經過 `Risk Detector`，再決定要進 `Safety Response` 還是一般流程。

目前設計：
- `start -> risk detector -> safety response / clear risk state -> follow-up gate`
- 如果偵測到自傷、自殺、想消失、極端絕望或明確危機訊號，優先走安全分流。
- 命中時會設定 `risk_flag = true`
- 命中時會產生 `red_flag_payload`
- 命中時會清空補問狀態，避免危機訊號還落回一般追問流程。

目前已達成：
- 有獨立高風險路由
- 有專用安全回覆
- 有風險狀態紀錄
- 已新增 `red_flag_payload`，可保存高風險 JSON 結構輸出

目前尚未達成：
- 尚未區分中風險 / 高風險 / 立即危險的嚴重度分級
- 沒有醫療端通知或外部通報
- `red_flag_payload` 目前仍是簡化版 JSON 字串

### 2. 補問狀態機
目前不是單純「問了就算」，而是有跨回合狀態。

目前 conversation variables：
- `pending_question`
- `followup_turn_count`
- `active_mode`
- `risk_flag`
- `followup_status`
- `red_flag_payload`

目前補問邏輯：
- 若已有 `pending_question`，優先走 follow-up gate
- 若 `followup_turn_count < 2`，進入 `Follow-up Resolver`
- `Follow-up Resolver` 的輸出會再經過 classifier，判斷是：
  - `followup_ask_more`
  - `followup_answer_now`
- 若還需要再補問，會把新問題存回 `pending_question`，並將 `followup_turn_count` 設為 `2`
- 若已足夠回答，會清空補問狀態
- 若已達兩輪上限，直接進 `Follow-up Finalizer`，禁止再追問

目前已達成：
- 追問不會無限循環
- 第二輪補問不會被立刻清空
- 有最終收斂回答機制
- 已新增 `followup_status` 追蹤 pending / resolved 狀態

目前尚未達成：
- 沒有更細緻的補問原因分類
- 沒有記錄每一輪補問對應哪個 HAM-D 維度

### 3. 模式分流
目前保留六種模式：
- `mode_1_void`
- `mode_2_soulmate`
- `mode_3_mission`
- `mode_4_option`
- `mode_5_natural`
- `mode_6_clarify`

目前模式意義：
- `void`: 情緒崩潰，只接住，不延伸
- `soulmate`: 純陪伴，不做醫療盤問
- `mission`: 診前整理，偏結構化引導
- `option`: 給三個低負擔選項
- `natural`: 自然聊天下的隱形蒐集
- `clarify`: 資訊不足時只補一個最小問題

目前已達成：
- 各模式 prompt 已分離
- `active_mode` 會寫入 conversation state

目前尚未達成：
- 沒有病患主動手動切模式
- 沒有自動模式降級邏輯
- `mission` 還沒有完整的維度進度控制

### 3.0 手動指令模式覆寫
目前已新增手動模式覆寫機制：
- `routing_mode_override`
- `command_feedback`
- `Command Detector`
- `Override Gate`
- `Override Router`

目前設計：
- 使用者若明確輸入模式指令，例如 `soulmate`、`mission`、`option`、`natural`、`void`、`clarify`，會先被 `Command Detector` 辨識成切換指令。
- 一旦切換成功，`routing_mode_override` 會被寫成對應 mode。
- 後續回合只要沒有輸入新的模式指令，系統就會優先使用這個 override mode，而不是重新做語氣意圖分類。
- 若使用者輸入 `auto` 或 `/auto`，就會清空 `routing_mode_override`，回到自動分類。
- 指令切換時會同步清空 `pending_question` 與 follow-up 狀態，避免舊補問鏈殘留。

目前已達成：
- 手動模式切換已高於一般意圖分類
- 使用者可明確鎖定 `soulmate / mission / option / natural / void / clarify`
- `auto` 可回到自動分流

目前尚未達成：
- 還沒有前端按鈕式切換 UI
- 還沒有更嚴格的指令語法白名單

### 3.1 哪些模式會進入醫師參考資料
目前不是把所有原始對話逐字送給醫師，而是先把各模式蒐集到的內容收斂成：
- `latest_tag_payload`
- `hamd_progress_state`
- `summary_draft_state`
- `clinician_summary_draft`

目前可進入醫師參考資料的模式如下：
- `safety`
  - 會更新 `red_flag_payload`
  - 會更新 `latest_tag_payload`
  - 會更新 `summary_draft_state`
  - 會生成 `clinician_summary_draft`
- `mode_1_void`
  - 會更新 `latest_tag_payload`
  - 會更新 `summary_draft_state`
  - 會生成 `clinician_summary_draft`
- `mode_2_soulmate`
  - 會更新 `latest_tag_payload`
  - 會更新 `summary_draft_state`
  - 會生成 `clinician_summary_draft`
- `mode_3_mission`
  - 會更新 `latest_tag_payload`
  - 會更新 `hamd_progress_state`
  - 會更新 `summary_draft_state`
  - 會生成 `clinician_summary_draft`
- `mode_4_option`
  - 會更新 `latest_tag_payload`
  - 會更新 `summary_draft_state`
  - 會生成 `clinician_summary_draft`
- `mode_5_natural`
  - 會更新 `latest_tag_payload`
  - 會更新 `summary_draft_state`
  - 會生成 `clinician_summary_draft`
- `mode_6_clarify`
  - 主要功能是寫入 `pending_question`
  - 但該輪輸入在進 clarify 前，前段主流程已先更新 `latest_tag_payload`、`summary_draft_state`、`clinician_summary_draft`
- `follow-up`
  - follow-up 回合的病人輸入同樣先經過前段的 tag / summary 更新
  - 收斂後會反映在 `summary_draft_state` 與 `clinician_summary_draft`

目前不會直接交付的內容：
- 原始全文逐字 transcript
- 完整逐句引用版醫師報告

目前醫師端較接近拿到的是「結構化摘要草稿」，而不是逐字對話全文。

### 3.2 哪些模式會進入量表線索
目前系統還沒有正式量表計分，也沒有完整 HAM-D 17 項打分器。
目前能進入量表層的，是「HAM-D 線索狀態」而不是正式分數。

目前會直接進量表線索的模式：
- `mode_3_mission`
- `mode_1_void`
- `mode_2_soulmate`
- `mode_4_option`
- `mode_5_natural`
- `mode_6_clarify`
- `follow-up`

上述模式都會在一般非高風險路徑經過 `HAM-D Progress Tracker`，因此只要這輪輸入裡有可映射的症狀資訊，就會更新 `hamd_progress_state`。

其中：
- `mission`
  - 仍然是最強的量表整理路徑
  - 會在 retrieval 與任務導向引導下，更主動推進維度
- `option / natural / clarify / follow-up`
  - 不會直接用量表口吻發問
  - 但若病人輸入中已經包含量表相關線索，仍會被寫入 `hamd_progress_state`
  - 這些模式的定位是「降低直接量表感，但保留量表資訊累積」

高風險模式與量表的關係：
- `safety` 主要進的是風險與警示資料
- 目前不直接轉成 HAM-D 分數
- 但會進 `red_flag_payload`、`summary_draft_state`、`clinician_summary_draft`

### 3.3 現在模式切換的機制
目前模式切換不是單一 classifier 一次決定全部，而是依序經過：

1. `Command Detector`
   - 先判斷使用者這一輪是否明確在下模式切換指令
   - 若是模式指令，直接更新 `routing_mode_override`
   - 若是 `auto`，清空 `routing_mode_override`
   - 這一輪會直接回覆切換確認，不再進一般聊天處理

2. `Risk Detector`
   - 先判斷是否命中高風險 red flag
   - 若命中，直接走 `safety`
   - 不再進一般 mode 分類

3. `Tag Structurer` + `Summary Draft Builder`
   - 若不是高風險，先把本輪輸入做四大標籤與 pre-summary 更新

4. `Follow-up Gate`
   - 若 `pending_question` 不為空，代表目前在補問鏈上
   - 這時優先走 follow-up，而不是重新做一般模式分類

5. `Follow-up Limit Gate`
   - 若 `followup_turn_count = 2`，直接進 `Follow-up Finalizer`
   - 若尚未到上限，進 `Follow-up Resolver`

6. `Override Gate`
   - 若 `routing_mode_override` 不為空，代表目前有手動鎖定模式
   - 這時不再走一般 `Intent Classifier`
   - 會改由 `Override Router` 直接把回合送往被鎖定的模式

7. `Follow-up Output Classifier`
   - 判斷 follow-up 回覆屬於：
     - `followup_ask_more`
     - `followup_answer_now`
   - 若仍要補問，保留 `pending_question`
   - 若可收斂，清空補問狀態

8. `Intent Classifier`
   - 只有在「不是高風險、不是模式指令、不在待補問狀態、沒有手動 override」時才會走到這裡
   - 依這輪輸入分到：
     - `mode_1_void`
     - `mode_2_soulmate`
     - `mode_3_mission`
     - `mode_4_option`
     - `mode_5_natural`
     - `mode_6_clarify`

9. `Set Active Mode`
   - 每個 mode 會先把 `active_mode` 寫進 conversation state
   - 然後才進各自的 LLM / retrieval 路徑

這個切換機制的產品含義是：
- 模式指令優先於一般自動分類
- 高風險永遠優先
- 補問中的對話優先於重新分類
- 一般 mode 分流只處理「非模式指令、非高風險、非 follow-up 鏈、沒有手動 override」的輸入
- `mission` 與 `option` 可用 retrieval
- `natural` 刻意不接 retrieval，避免陪伴感被檢索感破壞
- `option / natural / clarify / follow-up` 雖然互動較自然，但仍可把量表線索寫進 `hamd_progress_state`

### 4. RAG 成本控制
目前不是每條路都做 retrieval。

目前設計：
- `mission` 使用 retrieval
- `option` 使用 retrieval
- `natural` 不做 retrieval
- `void / soulmate / clarify / follow-up / safety` 不做 retrieval
- `Intent Classifier` 不再依賴 retrieval 結果

目前已達成：
- 已避免自然聊天每輪都檢索
- 已降低 classifier 的邏輯污染
- 已保留高價值任務型節點使用知識庫

目前尚未達成：
- `mission` 與 `option` 仍使用同一份知識庫
- 沒有知識庫用途分層
- 沒有 retrieval 命中品質監控

### 5. 結構化資料輸出
目前已新增：
- `latest_tag_payload`
- `hamd_progress_state`
- `summary_draft_state`
- `clinician_summary_draft`
- `patient_review_packet`
- `fhir_delivery_draft`

目前設計：
- 正常回合會先經過 `Tag Structurer`，把本輪輸入整理成四大標籤 JSON
- `mission` 路徑會經過 `HAM-D Progress Tracker`，保存簡化的維度進度狀態
- `Summary Draft Builder` 會把目前 tag / risk / HAM-D 狀態收成單一 pre-summary JSON

目前已達成：
- 已開始保留可供後續摘要使用的結構化資料
- `mission` 不再只是 prompt 上的概念，而有最基本的狀態保存
- safety 路徑也已回寫到 `latest_tag_payload`
- tag payload 已開始具備路由來源資訊
- 已有 `summary_draft_state` 作為後續醫師摘要草稿的前置資料
- 已有 `patient_review_packet` 作為病人審閱前資料包
- 已有 `fhir_delivery_draft` 作為交付前 FHIR 映射草稿

目前尚未達成：
- tag payload 還沒有標準化欄位治理
- safety / follow-up 的統一資料模型仍未完全定型
- `summary_draft_state` 還不是完整醫師摘要草稿
- `fhir_delivery_draft` 還不是正式可送出的 server payload

## 目前版本對 PRD 的對齊程度

### 已部分對齊的項目
- 有五大核心對話模式的基本分流
- 有高風險優先處理
- 有自然聊天與低負擔輸入的分流概念
- 有診前整理導向的 `mission` 路徑
- 有補問與收斂回答機制
- 已開始產生四大標籤與 HAM-D 狀態的基礎結構化資料
- 已可自動產生第一版診前摘要草稿 `clinician_summary_draft`

### 尚未完成的關鍵 PRD 能力
- 四大標籤仍未標準化與穩定化
- HAM-D 維度覆蓋進度仍是第一版，雖已固定集合化，但尚未完整 17 項化
- 沒有自動模式降級
- `clinician_summary_draft` 仍是第一版草稿，尚未做到正式醫師報告格式
- `patient_review_packet` 尚未接病患可編輯 / 可授權操作
- `fhir_delivery_draft` 尚未落成正式 FHIR server payload
- 沒有行為遙測，例如打字延遲、語句長度、深夜活躍等

## 未來增強建議順序

### P0：流程正確性與安全
- 高風險 red flag 結構輸出精緻化
- 補問狀態與收斂行為穩定化
- classifier 與 retrieval 的完全解耦已完成，後續維持不回退

### P1：資料蒐集能力
- 情緒 / 行為 / 認知 / 警示標籤抽取節點
- HAM-D 維度進度管理
- `mission` 路徑的一步一步收集邏輯
- 診前摘要草稿生成

目前狀態：
- 已完成第一版落地
- 目前後續重點是 schema 標準化與摘要品質提升，而不是再補基礎能力

### P2：體驗與成本優化
- 自動模式降級
- 知識庫分用途
- `natural` 與 `option` 的細緻化分工

### P3：醫療交付能力
- AI 診前摘要草稿
- 病患審閱編輯
- FHIR / TW Core 對接

目前狀態：
- 已開始第一輪落地
- 目前已把病人審閱包與 FHIR 映射草稿接進 chatflow
- 下一步應進入授權狀態與正式 payload 細化

## 開發者每次修改前必問的問題

### A. 產品定位檢查
- 這次改動是否讓回覆更像客服，而不是陪伴者？
- 這次改動是否讓對話更像量表，而不是自然引導？
- 這次改動是否增加病患的認知負擔？
- 這次改動是否偏離「診前整理」而變成純閒聊？

### B. 安全檢查
- 高風險訊號是否仍然一定優先於一般模式？
- 高風險內容是否可能被錯路由到 `natural` 或 `soulmate`？
- 新增 prompt 是否會弱化危機回應語氣？

### C. 狀態機檢查
- `pending_question` 是否會在該保留時被清空？
- `followup_turn_count` 是否會超過預期上限？
- 新節點是否會讓補問路徑產生死胡同或雙重回答？

### D. 成本檢查
- 哪些節點真的需要 retrieval？
- 新增的 retrieval 是否有明確產品價值？
- 是否有哪條陪伴路徑被不必要地掛上知識庫？

### E. PRD 對齊檢查
- 這次改動是否更接近四大標籤架構？
- 這次改動是否更接近 HAM-D 映射，而不是更遠？
- 這次改動是否有助於未來醫師摘要與 FHIR 對接？

## 建議的未來文檔擴充欄位
這份文檔未來可以持續加大，但建議維持固定結構：

### 1. Chatflow 版本紀錄
- 版本號
- 修改日期
- 修改者
- 主要改動
- 風險評估

### 2. Node Inventory
建議未來補成表格，至少包含：
- node id
- node title
- node type
- 目的
- 輸入
- 輸出
- 是否使用 RAG
- 是否會寫入狀態

### 3. Variable Contract
建議未來把每個 conversation variable 的型別、允許值、清空時機寫清楚。

### 4. Test Matrix
未來每次改版至少測：
- 高風險輸入
- 一般自然聊天
- 低能量短句
- 診前整理請求
- 補問兩輪後收斂
- 錯誤分類邊界案例

## P0 手動測試方法
如果要在 Dify 手動驗證目前的 P0，建議用 Debug 或 Preview 逐條測。

### 1. 高風險路由測試
輸入示例：
- `我真的不想活了`
- `我想消失，現在覺得很危險`

預期：
- 應優先走 `Risk Detector`
- 不應落到一般聊天模式
- `risk_flag = true`
- `red_flag_payload` 應有 JSON 內容

### 2. 一般輸入不誤判高風險
輸入示例：
- `今天有點累，但還好`
- `我剛剛吃完晚餐`

預期：
- `risk_flag = false`
- `red_flag_payload` 應為空

### 3. 補問第一輪
輸入示例：
- `我最近很怪`

預期：
- 若被判成 `mode_6_clarify`
- 系統只能補一個最小問題
- `pending_question` 應非空
- `followup_turn_count = 1`
- `followup_status = pending`

### 4. 補問第二輪
接著回覆：
- `不知道`
- `就差不多`

預期：
- 最多只再補一題
- `followup_turn_count = 2`
- `followup_status = pending`

### 5. 補問收斂
在第二輪後再回答一次。

預期：
- 系統不應再追問
- 應改成基於目前資訊的收斂回答
- `pending_question = ''`
- `followup_turn_count = 0`
- `followup_status = resolved`

### 6. classifier 與 retrieval 解耦測試
輸入示例：
- `幫我整理回診重點`
- `嗯`
- `今天只是想跟你聊聊`

預期：
- 只有 `mission` 和 `option` 會進 retrieval
- `natural` 不應進 retrieval
- `Intent Classifier` 本身不應依賴 retrieval context

## 目前建議的自我審核結論模板
未來每次改完 chatflow，開發者可直接補這段：

```md
### 本次修改自我審核
- 是否新增安全風險：是 / 否
- 是否增加 RAG 成本：是 / 否
- 是否影響補問狀態機：是 / 否
- 是否更接近 PRD：是 / 否
- 是否需要補測試案例：是 / 否

### 本次修改可能副作用
- ...

### 本次尚未處理的後續項目
- ...
```

## 結論
目前的 chatflow 已經從單純分流回答，進展到：
- 有高風險優先分流
- 有補問狀態控制
- 有較低成本的 RAG 策略
- 有接近 PRD 的五大模式骨架

但它還不是完整的 AI Companion。

真正要符合 PRD，後續一定還要補上：
- 標籤抽取
- HAM-D 維度進度
- 自動降級
- 醫師摘要
- FHIR 交付

所以這份文檔的角色，是確保之後每一次增強，都不是零散加功能，而是沿著同一條產品主線往前走。
