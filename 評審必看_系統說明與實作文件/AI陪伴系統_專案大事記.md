# AI陪伴系統專案大事記

本文件依據 `FHIR-main` 專案目前的 Git 提交紀錄整理而成，涵蓋 `2026-03-24` 至 `2026-04-06` 的主要開發軸線。內容不是逐筆 commit 轉錄，而是將同日或同階段的重點整合成可閱讀的專案大事記，方便作為競賽說明、成果報告與簡報敘事素材。

---

## 一、完整版大事記

這個專案的發展脈絡相當清楚：最早先建立 AI 陪伴系統的 workflow 基礎與提示詞架構，接著迅速把聊天流程從概念稿推進為可分流、可追蹤、可控風險的對話引擎；之後再補上前端手機化介面、FHIR 匯出與交付能力、測試文件與競賽說明，最後在短時間內高密度優化互動細節、FHIR consent 流程與醫療資料上傳品質，使系統從概念驗證逐漸轉型為可展示、可測試、可對接標準醫療格式的作品。

`2026-03-24` 是專案真正的起點。這一天完成了最早的初始化提交，也開始集中處理 `AI.yml` 與 `AI_Chatflow.yml`。從 commit 訊息可以看出，當時的工作重點在於把整體 AI workflow 骨架搭起來，並快速修正 Dify workflow provider 設定、chatflow classifier 設定、輸出值型別等相容性問題。這表示專案在初期的核心不是畫面，而是先確保 AI 流程可以被清楚定義、匯入與執行。同日後續又陸續恢復五分支 chatflow、釐清五種模式的 routing 邏輯、縮小某些特殊模式的觸發範圍，並將模型切換到 Gemini 系列，最後進一步調整到 `Gemini 2.5 Flash`。同一天還進行了 command-driven modes 的重構，代表系統已經從單純聊天邁向明確模式控制與指令導向的設計。

`2026-03-25` 雖然只有一筆提交，但其意義不小。這一天加入了 AI companion 的產品需求、系統提示、配置與相關文件，等於把前一天建立的流程基礎進一步文件化。從這個時間點開始，專案不再只是 workflow 實驗，而是開始形成產品定義、使用情境與規格依據，讓後續功能擴充有了比較穩定的參考框架。

`2026-03-28` 是第一次大型整理與修正。這一天一開始先針對 chatflow 進行多輪對話優化與 RAG 成本控制，顯示團隊已經開始思考系統在實務上是否能長時間陪伴使用者，以及如何控制推理成本。隨後大量提交集中在 AI companion chatflow routing 的細化與 audit guide 的建立，並開始補強 P0 安全路徑與 follow-up state。接著系統也嘗試加入 P1 tagging 與 HAM-D 進度追蹤，不過中間出現回退與還原基準版本的提交，例如 revert incompatible changes、restore baseline for Dify compatibility、去除 BOM、還原 blob 等，顯示當天經歷了一次「功能演進與平台相容性衝突」的調整過程。最終，團隊重新建立 fresh export 並更新 audit 文件，讓流程在可匯入、可維護的前提下回到穩定狀態。

`2026-03-29` 是專案第一次全面爆發的日子。這一天大量提交集中在 rebuilt chatflow 的擴充，先補上 risk routing、完成 P0 follow-up 與 retrieval controls，再往 P1 的 tagging、HAM-D state tracking、structured state coverage、routing-aware structured data 與 pre-summary state 推進。這代表系統已從單純回應文字，逐步成長為能辨識風險、保留結構化狀態、支援後續摘要與臨床資料整理的陪伴引擎。

也是在 `03-29`，前端正式成形。這一天新增了完整手機 App 界面原型，代表產品開始從後端流程走向實際互動介面。之後又補上 clinician summary draft flow、conversation simulation doc、routing 與 clinical data flow 文件、自然模式下的 HAM-D 訊號追蹤、manual mode override commands，說明系統設計已兼顧一般使用者的自然對話體驗與專業端的摘要需求。

同一天後段，FHIR 主線正式展開。團隊先加入 FHIR 與 TW Core 整合指南，接著完成 `fhirBundleBuilder` MVP、demo runner、sample input、validation layer、governance resources 與 delivery API MVP。這表示專案已不滿足於「AI 回答可以顯示」，而是進一步要求陪伴結果能被轉換為標準化醫療資料，並具備基本驗證與交付能力。當天還同步完成測試清單中文化、將 Dify chatflow 接上 App UI，並調整 layout 相容性，顯示產品、流程、FHIR 與文件幾條線在同一天同步快速推進。

`2026-03-31` 的主軸是 Dify 匯入相容性穩定化。這一天加入 minimal import smoke test、full Dify-compatible export、compatible skeleton 與 skeleton edge structure 修正，並把空白模型設定補齊。這些提交雖然不像功能開發那麼顯眼，但它們非常重要，因為這些工作直接決定了 workflow 是否能穩定匯入、複製與部署。換句話說，這一天是在把原本還帶有實驗性質的對話流程，整理成更像正式交付資產的形式。

`2026-04-01` 主要處理安全偵錯與平台連線品質。這一天先加入 safety debug workflow，並固定風險路徑模型，讓高風險對話可以被單獨分析。之後又處理前端 Dify app key、chat error diagnostics，並將部分 workflow 模型改為 Groq，再重建 clean core Dify workflow，同時清除壞掉的 orphan edge 與不相容欄位。這表示系統開始重視「出了問題要怎麼查、不同平台版本怎麼相容、風險路徑如何獨立驗證」，使整體工程品質進一步提升。

`2026-04-02` 是架構調整的一天。這一天加入 Flowise migration assets、starter files 與 conversation starter，並將 AI companion flow 重建為 Node engine。這代表團隊開始降低對單一工作流平台的依賴，把更多邏輯收回程式碼端，以便後續更彈性地整合前端互動、後端服務與 FHIR 匯出流程。

`2026-04-03` 是第二波產品化衝刺。這一天先加入 Google Gemini 支援與 on-demand outputs，讓系統輸出更具彈性。之後在前端快速擴充多項功能，包括報表子頁、互動式 mood curve、自我追蹤的 PHQ-9 與 mood tags、諮商口吻、typing 時隱藏 quick replies、thinking status、極簡 home screen、實際執行模式顯示、top-right mode access 與 mode routing explainer card。這些提交顯示 UI/UX 已進入密集打磨期，而且不只是外觀，而是開始建立完整的使用節奏與心理感受。

同一天另一條非常重要的主線，是 Therapeutic Memory Layer 的完成。系統先後完成 Layer 1+2 與 Layer 3+4，表示專案已開始處理治療性記憶的分層保存與跨回合延續問題。若從產品角度來看，這是 AI 陪伴系統能否呈現「記得你、理解你、能接續你之前狀態」的關鍵能力。此外，當天也加入 patient-facing weekly report、micro intervention engine、手動測試紀錄與 auto routing 文件，使系統逐漸成為一個兼具陪伴、追蹤、回顧與輕介入能力的完整原型。

`2026-04-04` 是整個專案最密集的一天，也是目前完成度最高的一次整合。這一天的工作可以分成幾條主線。第一條是快捷操作與互動細節優化，從 shortcut composer、swipe 手感、layout、spacing、empty state、刪除修復、關閉修復、tap handling、focus behavior，到 scroll safe area 與 chat scroll safety，都屬於實際反覆操作後才會暴露的體驗問題。這代表產品已經不只是能用，而是進入實際展示前的體感打磨階段。

第二條是安全與模式路由的強化。這一天記錄第三輪 safety routing test，加入自傷語句直接導向 safety mode 的能力，並補上 safety lexicon 與 rule-vs-AI routing 文件，還有真實世界 self-harm follow-up flow 測試紀錄。這說明系統對高風險內容的處理已不只停留在規則設計，而是逐步形成規則、AI、測試與文件相互支撐的架構。

第三條是首頁、導覽與 session 體驗。當天實作 session persistence、global home navigation、interactive user guide、swipeable markdown pager、desktop controls、recent conversation switcher，以及 guide 開啟時隱藏 recent sessions 的機制。這讓產品從「每次打開都像重新開始」變成「有入口、有教學、有歷史、有切換能力」的完整互動體驗。

第四條是競賽與交付文件的補齊。這一天新增詳細專案實作提交文件、補充 implementation status、加入 FHIR implementation note、HAM-D 與 draft processing flow、competition README 與 30 分鐘 demo video runbook。這表示團隊已經同步整理技術成果與敘事材料，讓產品不只做得出來，也能說得清楚、交得出去。

第五條也是最關鍵的一條，是 FHIR consent 與 delivery 流程的完整化。這一天從 manual FHIR consent submission 與 consent preview flow 開始，接著逐步補上 formal HAM-D draft pipeline、顯示 HAPI resource links、consent progress feedback、預設 HAPI FHIR target、解決 upload collisions、report consent loading progress、stage labels、post-delivery UI sync、auto-generate FHIR draft、delivery debug tracing、expose created Patient ID、normalize consent payload、show Patient identifier、smooth progress animation、minimal fallbacks、draft payload mapping 與 merge report drafts into payload。這一連串工作清楚顯示，FHIR 已不再只是後端概念功能，而是成為前後端整合、可視化、有進度、有回饋、有錯誤處理的完整交付流程。

`2026-04-05` 則進入整理與驗證期。這一天先加入 timestamped FHIR history management，代表系統已開始把 FHIR 交付結果視為可追蹤、可回顧的歷史紀錄，而非一次性輸出。接著修正 void mode prompt behavior，說明聊天模式細節仍持續微調。同日也補上第二份 mode switching 手動測試紀錄，以及 FHIR composition output review record，顯示專案在高強度實作之後，正逐步回到驗證輸出品質、確認模式切換穩定度與審查 FHIR 組成內容的階段。

`2026-04-06` 的重點則很適合作為這一輪調整的收尾與補敘事。從 Git 紀錄可以看出，這一天雖然 commit 數量不算暴衝，但方向非常明確，主要是在補齊「讓外部更容易理解 FHIR 能力」的說明材料。團隊先後加入 FHIR login 與 registration notes、mock EMR video notes，以及 FHIR intro experience notes，代表系統已不只是把資料做出來而已，而是開始補足展示情境、示範腳本與導覽式說明，讓評審、老師或第一次接觸的人能更快看懂整條體驗路徑。這些文件型提交的價值其實很高，因為它們把前幾天已經完成的 FHIR draft、交付流程與醫療端閱讀情境串成一個更完整的敘事閉環。換句話說，專案在這一天正式從「功能很多」再往前走一步，變成「功能、展示、說明三者更一致」的版本。

整體來看，這個專案在非常短的時間內走過了一條完整的產品化路徑：先建立 AI workflow 與模式路由，再解決平台相容性與風險處理，接著把臨床摘要、HAM-D、記憶層與微介入能力加入系統，再做出手機化前端與完整互動，最後把結果真正接上 FHIR bundle、validation、delivery API、HAPI FHIR upload、consent 流程、歷史管理與展示敘事材料。從 Git 紀錄可看出，團隊並非單一路線開發，而是在流程、前端、FHIR、測試、文件五條線上同步推進，並透過大量修正與回退來換取最終的穩定與可展示性。這正是本專案從概念驗證走向實作成果的重要軌跡。

---

## 二、精簡版大事記（約一千字）

`FHIR-main` 專案的開發從 `2026-03-24` 正式展開，最早的工作集中在建立 AI workflow 與 chatflow 架構。團隊先完成初始提交，接著快速修正 Dify workflow provider、分類器設定與輸出型別問題，並逐步恢復五分支聊天流程、釐清五種模式的 routing 邏輯。當天也將模型切換到 Gemini 系列，最後進一步使用 `Gemini 2.5 Flash`，並把系統改造成 command-driven modes，讓 AI 陪伴不只是自由聊天，而是具備可控制、可切換的互動模式。

`2026-03-25` 則加入了產品需求文件、系統提示與設定檔，代表專案從流程雛形進一步走向產品定義與文件化。到了 `2026-03-28`，團隊開始優化多輪對話與 RAG 成本，並針對 chatflow routing 建立 audit guide，同時補強 P0 安全路徑與 follow-up state。雖然中間曾因 Dify 相容性問題回退部分變更，但最後仍重建 fresh export 並恢復穩定版本，讓後續開發可以在可匯入、可維護的基礎上繼續前進。

`2026-03-29` 是專案第一次大幅成長的關鍵日。這一天先把 rebuilt chatflow 擴充為具備 risk routing、P0 follow-up、retrieval controls、P1 tagging、HAM-D state tracking 與 pre-summary state 的陪伴引擎，使系統開始具備風險辨識、狀態保存與臨床摘要前置能力。同一天，前端也首次成形，完成了手機 App 的 SPA 原型，並補上 clinician summary draft flow、conversation simulation、manual mode override 與相關流程文件，讓系統同時兼顧使用者對話體驗與專業端摘要需求。

也是在 `03-29`，FHIR 主線正式展開。團隊新增 FHIR 與 TW Core 整合指南，完成 `fhirBundleBuilder`、sample input、validation layer、governance resources 與 delivery API MVP，說明專案已不只是做出聊天機器人，而是開始把陪伴結果轉換成可驗證、可交付的標準醫療資料。同時，Dify chatflow 也被整合進前端 UI，讓 App 與流程真正接起來。

到了 `2026-03-31`，工作重心轉向 Dify 匯入穩定化，包括加入 minimal smoke test、full compatible export、skeleton 複本與 edge structure 修正，並補齊缺漏模型設定。`2026-04-01` 則進一步強化安全路徑偵錯與平台連線品質，新增 safety debug workflow、改善 chat error diagnostics、清除不相容欄位，讓系統更適合實際測試與展示。`2026-04-02` 開始導入 Flowise migration 資產，並將 AI companion flow 重建為 Node engine，代表團隊逐步把核心邏輯收回程式碼端，提升後續整合與維護彈性。

`2026-04-03` 是第二波產品化衝刺。這一天加入 Google Gemini 支援與 on-demand outputs，並在前端快速擴充多項功能，包括報表子頁、互動 mood curve、PHQ-9、自我追蹤標籤、thinking status、極簡首頁與模式切換介面等。更重要的是，系統完成了 Therapeutic Memory Layer 1 到 4，表示 AI 已開始具備跨回合保留治療性記憶的能力。此外，當天還加入 patient-facing weekly report、micro intervention engine 與手動測試紀錄，讓產品逐漸從單一聊天頁面擴展為完整陪伴原型。

`2026-04-04` 是目前最密集的一天，也是專案成熟度大幅提高的一天。前端方面，大量調整 shortcut composer、swipe 體感、scroll 安全區、focus 行為與各種互動細節，顯示產品已進入實際展示前的細修階段。安全方面，系統新增自傷語句導向 safety mode 的能力，並補上 safety lexicon、rule-vs-AI routing 文件與真實測試紀錄。首頁與導覽方面，加入 session persistence、global home navigation、interactive guide、recent conversation switcher 等功能，使整體體驗更完整。

同一天最關鍵的成果，則是 FHIR consent 與 delivery 流程的整合完成。團隊先後補上 consent preview、formal HAM-D draft pipeline、HAPI resource links、consent progress feedback、upload collision 修正、auto-generate FHIR draft、Patient ID 顯示、payload normalize、fallback 機制與 draft merge 邏輯，讓 AI 對話結果能被整理、預覽、確認、轉換並上傳到 HAPI FHIR 伺服器，真正形成一條從陪伴對話走向標準醫療資料交付的完整流程。

最後到 `2026-04-05` 與 `2026-04-06`，系統開始進入驗證、整理與展示敘事補強階段。除了加入 timestamped FHIR history management、修正 void mode prompt、補上模式切換與 FHIR composition output 的人工檢查紀錄外，也進一步新增 FHIR login / registration notes、mock EMR video notes 與 FHIR intro experience notes。這代表專案不只在打磨輸出品質，也開始強化外部理解路徑，讓評審或初次接觸者能更快掌握系統如何從對話走到 FHIR 醫療資料展示。整體而言，`FHIR-main` 在短短十多天內，從 AI workflow 雛形快速成長為結合陪伴對話、風險分流、治療記憶、前端互動、FHIR 標準化輸出、測試紀錄與競賽敘事文件的完整作品，展現出高度密集而有方向的開發節奏。
