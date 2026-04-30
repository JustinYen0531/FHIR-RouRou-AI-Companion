# Rou Rou AI Companion 系統全景地圖（Mermaid 版）

更新日期：`2026-05-01`

這份文件的目的不是列所有函式，而是用工程視角把整套系統的「人、畫面、資料、FHIR、server」一次攤開，讓人能看懂這個專案到底怎麼運作。

## 1. 系統全景總覽

```mermaid
flowchart LR
    subgraph Actors["三方角色"]
        P["病人 Patient"]
        A["AI Companion"]
        D["醫師 Doctor"]
    end

    subgraph Frontend["Frontend Web App"]
        UI1["聊天頁 Chat"]
        UI2["PHQ-9 自評頁"]
        UI3["報表頁 Report"]
        UI4["病人基本資料 Patient Profile"]
        UI5["醫師工作台 Doctor Dashboard"]
        UI6["醫師指派 / 病歷草稿 / FHIR Preview"]
    end

    subgraph ClientLogic["前端邏輯層"]
        APP["app.js<br/>整體狀態與流程控制"]
        ENG["aiCompanionEngine.js<br/>對話策略 / 模式切換 / 安全邏輯"]
        MEM["knowYouMemory.js<br/>治療性記憶"]
        MIR["microInterventionRules.js<br/>微介入規則"]
        AUTH["authStore.js<br/>雙角色登入狀態"]
        ASSIGN["assignmentPersistence.js / sessionPersistence.js"]
    end

    subgraph BrowserData["Browser / Local State"]
        LS1["localStorage<br/>病人資料 / 醫師工作台 / 指派資料 / 報表歷史"]
        LS2["當前 session state<br/>聊天記錄 / HAM-D 線索 / PHQ-9 / report outputs"]
    end

    subgraph Server["Server / API"]
        S1["/api/chat/message<br/>聊天訊息處理"]
        S2["/api/chat/output<br/>醫師摘要 / 病人審閱稿 / FHIR Draft"]
        S3["/api/chat/session / sessions<br/>會話保存與讀取"]
        S4["/api/auth/*<br/>病人 / 醫師登入註冊"]
        S5["/api/assignments<br/>醫病指派同步"]
        S6["/api/fhir/bundle<br/>FHIR Bundle 產生入口"]
        S7["fhirDeliveryServer.js<br/>quick check / delivery / refresh"]
    end

    subgraph FHIRLayer["FHIR 轉換層"]
        F1["fhirBundleBuilder.js"]
        F2["fhirBundleValidator.js"]
        F3["FHIR Bundle"]
        F4["TW Core / TW IG Core profile"]
    end

    subgraph Resources["主要 FHIR Resources"]
        R1["Patient"]
        R2["Encounter"]
        R3["QuestionnaireResponse"]
        R4["Observation"]
        R5["ClinicalImpression"]
        R6["Composition"]
        R7["DocumentReference"]
        R8["Provenance"]
    end

    subgraph External["外部端點"]
        E1["LLM Provider<br/>OpenRouter / Gemini / Groq"]
        E2["FHIR Server<br/>HAPI FHIR / 指定端點"]
    end

    P --> UI1
    P --> UI2
    P --> UI3
    P --> UI4
    D --> UI5
    D --> UI6

    UI1 --> APP
    UI2 --> APP
    UI3 --> APP
    UI4 --> APP
    UI5 --> APP
    UI6 --> APP

    APP --> ENG
    APP --> MEM
    APP --> MIR
    APP --> AUTH
    APP --> ASSIGN
    APP <--> LS1
    APP <--> LS2

    ENG <--> E1
    APP --> S1
    APP --> S2
    APP --> S3
    APP --> S4
    APP --> S5
    APP --> S6
    APP --> S7

    S6 --> F1
    S7 --> F1
    F1 --> F2
    F1 --> F3
    F2 --> F3
    F4 --> F1

    F3 --> R1
    F3 --> R2
    F3 --> R3
    F3 --> R4
    F3 --> R5
    F3 --> R6
    F3 --> R7
    F3 --> R8

    S7 --> E2
```

## 2. 三方角色在系統上的交通

```mermaid
flowchart TD
    P["病人"] --> P1["填基本資料"]
    P --> P2["與 AI 對話"]
    P --> P3["填 PHQ-9"]
    P --> P4["審閱報表"]
    P --> P5["授權送出 FHIR"]

    A["AI Companion"] --> A1["接住情緒"]
    A --> A2["追問 HAM-D 維度"]
    A --> A3["整理病人審閱稿"]
    A --> A4["整理醫師摘要"]
    A --> A5["產出 FHIR Draft"]
    A --> A6["保留記憶 / 安全模式 / 微介入"]

    D["醫師"] --> D1["查看病人列表"]
    D --> D2["看病人自評與安全摘要"]
    D --> D3["看 AI 摘要與病歷草稿"]
    D --> D4["編修欄位 / 病歷內容"]
    D --> D5["預覽 FHIR JSON"]

    P2 --> A1
    A1 --> A2
    A2 --> A3
    A3 --> P4
    P3 --> D2
    A4 --> D3
    A5 --> D5
    P5 --> D3

    D4 --> D5
    D5 --> X["FHIR Server / 診間系統"]

    note1["核心邏輯：<br/>病人提供主觀經驗<br/>AI負責收集與整理<br/>醫師負責判讀與最終使用"]
    P -.-> note1
    A -.-> note1
    D -.-> note1
```

## 3. 病人端主流程

```mermaid
flowchart TD
    S["病人開啟系統"] --> A{"是否已完成基本資料"}
    A -- 否 --> B["開啟 Patient Profile"]
    B --> C["保存 name / birthDate / gender / phone 等資料"]
    C --> D["解鎖聊天 / 報表 / FHIR 功能"]
    A -- 是 --> E["進入聊天頁"]
    D --> E

    E --> F["輸入自然語言困擾"]
    F --> G["AI 回應 + 模式切換 + 安全判斷"]
    G --> H["累積治療性記憶 / HAMD 線索 / 對話狀態"]
    H --> I{"是否前往 PHQ-9"}
    I -- 是 --> J["完成 9 題滑桿自評"]
    J --> K["保存分數與摘要"]
    I -- 否 --> L["繼續聊天"]
    L --> M["病人前往 Report 頁"]
    K --> M

    M --> N["生成 病人分析 / 醫師摘要 / FHIR Draft"]
    N --> O["查看 HAM-D mapping / 症狀摘要 / FHIR 示意"]
    O --> P{"是否授權送出"}
    P -- 暫存 --> Q["保存報表與草稿歷史"]
    P -- 同意 --> R["開啟 consent preview"]
    R --> S2["runDeliveryQuickCheck"]
    S2 --> T{"可送出?"}
    T -- 否 --> U["顯示 blocking reasons / validation issues"]
    T -- 是 --> V["authorizeAndSendReport"]
    V --> W["送往 FHIR bundle API / FHIR server"]
```

## 4. 醫師端主流程

```mermaid
flowchart TD
    D0["醫師登入"] --> D1["進入 Doctor Dashboard"]
    D1 --> D2["查看病人列表 / 待送病歷 / 待填醫囑"]
    D2 --> D3["點選病人"]
    D3 --> D4["查看病人自評摘要"]
    D3 --> D5["查看 AI summary / 風險等級 / 最近紀錄"]
    D3 --> D6["查看 medical record draft"]
    D6 --> D7["編修 patient / composition / provenance 等欄位"]
    D7 --> D8["開啟 FHIR Preview"]
    D8 --> D9["檢查 Bundle JSON"]
    D9 --> D10["同步 assignments / 照護關係"]

    D11["病人已授權的資料"] --> D4
    D11 --> D5
    D11 --> D6
```

## 5. 後端與 API 分工

```mermaid
flowchart LR
    FE["Frontend app.js"] --> M1["/api/chat/message"]
    FE --> M2["/api/chat/output"]
    FE --> M3["/api/chat/session"]
    FE --> M4["/api/auth/*"]
    FE --> M5["/api/assignments"]
    FE --> M6["/api/fhir/bundle"]
    FE --> M7["/api/fhir/check / resource-refresh"]

    M1 --> C1["聊天處理<br/>對話輸入 -> AI 回覆"]
    M2 --> C2["報表處理<br/>醫師摘要 / 病人審閱稿 / FHIR draft"]
    M3 --> C3["session 保存 / 讀取"]
    M4 --> C4["登入註冊 / 角色辨識"]
    M5 --> C5["醫病指派同步"]
    M6 --> C6["bundle builder"]
    M7 --> C7["quick check / delivery / refresh"]
```

## 6. FHIR 交付管線

```mermaid
flowchart TD
    I0["聊天記錄 + 病人資料 + PHQ-9 + HAM-D 線索 + clinician summary"] --> I1["buildSessionExportBundle()"]
    I1 --> I2["Patient"]
    I1 --> I3["Encounter"]
    I1 --> I4["QuestionnaireResponse"]
    I1 --> I5["Observation x N"]
    I1 --> I6["ClinicalImpression"]
    I1 --> I7["Composition"]
    I1 --> I8["DocumentReference"]
    I1 --> I9["Provenance"]

    I2 --> B["Bundle"]
    I3 --> B
    I4 --> B
    I5 --> B
    I6 --> B
    I7 --> B
    I8 --> B
    I9 --> B

    B --> V["fhirBundleValidator.js"]
    V --> W{"valid ?"}
    W -- 否 --> X["阻擋送出<br/>回傳 validation errors"]
    W -- 是 --> Y["quick check summary"]
    Y --> Z["POST transaction 到 HAPI / 指定 FHIR server"]
```

## 7. FHIR Resource 之間怎麼串

```mermaid
flowchart LR
    P["Patient"] --> E["Encounter"]
    P --> QR["QuestionnaireResponse"]
    P --> O["Observation"]
    P --> CI["ClinicalImpression"]
    P --> C["Composition"]
    P --> DR["DocumentReference"]
    P --> PR["Provenance"]

    E --> QR
    E --> O
    E --> CI
    E --> C
    E --> DR
    E --> PR

    QR --> O
    O --> CI
    O --> C
    QR --> C
    CI --> DR
    C --> DR
    CI --> PR
    C --> PR
    DR --> PR
```

## 8. 這套系統真正的核心不是聊天，而是「分工」

1. 病人不是直接寫病歷，而是先用自然語言與量表把主觀感受交出來。
2. AI 不是直接做診斷，而是做整理、追問、映射、摘要與 FHIR 草稿生成。
3. 醫師不是看整段原始聊天，而是看被整理過、較可判讀的資訊。
4. FHIR 不是裝飾，而是把這段互動變成可驗證、可交換、可交付的結構化資料。
5. Server 的角色不是只存資料，而是擋錯、驗證、quick check、再決定能不能送。

## 9. 一句話版本

```text
病人提供經驗 -> AI 把經驗整理成可評估訊號 -> 醫師接收可用摘要 -> 系統把這段交接封裝成 FHIR Bundle 並送往 server。
```
