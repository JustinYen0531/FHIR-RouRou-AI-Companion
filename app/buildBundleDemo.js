const fs = require('fs');
const path = require('path');
const { buildSessionExportBundle } = require('./fhirBundleBuilder');

const inputPath = path.join(__dirname, 'sampleSessionExport.json');
const outputPath = path.join(__dirname, 'sampleBundleOutput.json');

function main() {
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const result = buildSessionExportBundle(input);

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

  if (result.bundle_json) {
    console.log('Bundle build succeeded.');
    console.log('Output written to:', outputPath);
    console.log(JSON.stringify(result.resource_index, null, 2));
    return;
  }

  console.log('Bundle build blocked.');
  console.log('Output written to:', outputPath);
  console.log('Blocking reasons:', JSON.stringify(result.blocking_reasons, null, 2));
  console.log('Validation errors:', JSON.stringify(result.validation_errors, null, 2));
  process.exitCode = 1;
}

main();
