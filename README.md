# FHIR

## Bundle MVP

第一版交付層 MVP 已新增在 [app/fhirBundleBuilder.js](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/fhirBundleBuilder.js)。

測試可直接執行：

```powershell
node app\fhirBundleBuilder.test.js
```

如果要直接用 sample input 產生 Bundle：

```powershell
node app\buildBundleDemo.js
```

輸入範例在 [sampleSessionExport.json](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/sampleSessionExport.json)，輸出會寫到：

`app\sampleBundleOutput.json`

目前輸出也會包含：
- `validation_report`
- `validation_errors`
- `blocking_reasons`

## Delivery API MVP

如果要啟動本地交付層 API：

```powershell
node app\fhirDeliveryServer.js
```

預設會開在：

`http://localhost:8787`

健康檢查：

```powershell
Invoke-WebRequest http://localhost:8787/health
```

本地 dry run 交付：

```powershell
Get-Content app\sampleSessionExport.json -Raw | Invoke-RestMethod `
  -Uri http://localhost:8787/api/fhir/bundle `
  -Method Post `
  -ContentType "application/json"
```

如果要真的送 transaction Bundle 到外部 FHIR server，可先設定：

```powershell
$env:FHIR_SERVER_URL="https://your-fhir-server.example/fhir"
node app\fhirDeliveryServer.js
```

交付層測試：

```powershell
node app\fhirDeliveryServer.test.js
```

## Dify Chatflow 前端整合

現在 [app/index.html](C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main/app/index.html) 可以透過本地 server 串接 Dify Chatflow。

建議先用環境變數設定聊天流 API key：

```powershell
$env:DIFY_APP_API_KEY="app-xxxxxxxxxxxxxxxx"
node app\fhirDeliveryServer.js
```

如果 Dify 不是用預設雲端 API，也可以一起設定 base URL：

```powershell
$env:DIFY_API_BASE_URL="https://api.dify.ai/v1"
$env:DIFY_APP_API_KEY="app-xxxxxxxxxxxxxxxx"
node app\fhirDeliveryServer.js
```

啟動後可直接打開：

`http://localhost:8787/`

聊天介面會呼叫：

- `POST /api/chat/message`
- `POST /api/fhir/bundle`

如果你不想把 key 放在環境變數，也可以在 Settings 頁面內填入：

- Dify Base URL
- Dify API Key
- User ID

這個設定會存在瀏覽器 localStorage，適合本機 demo；若要正式部署，仍建議把 API key 放在 server 端。
