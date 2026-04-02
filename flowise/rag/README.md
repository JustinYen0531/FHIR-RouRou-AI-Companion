# RAG 資料來源

## 來源
- 目前唯一來源檔案：
  - [CompanionAI_RAG資料.pdf](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/AI_Companion_RAG/CompanionAI_RAG%E8%B3%87%E6%96%99.pdf)

## 用途
- `Mission Retrieval`
- `Option Retrieval`

## Flowise 重建原則
- 同一份資料進入同一個 Document Store
- Mission / Option 用不同 retriever prompt 與 audit prompt
- RAG 結果不直接給使用者，必須先經過：
  - `Mission Retrieval Audit`
  - `Option Retrieval Audit`

## 建議持久化
- 本地 document store
- 本地向量庫
- 對外部署時再改成雲端持久化
