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
