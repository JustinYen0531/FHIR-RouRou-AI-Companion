const fs = require('fs');
const path = require('path');

async function main() {
  const root = process.cwd();
  const inputDir = path.join(root, 'AI_Companion_RAG');
  const outputDir = path.join(root, 'app', 'rag');
  fs.mkdirSync(outputDir, { recursive: true });

  const pdfFilename = fs.readdirSync(inputDir).find((name) => name.endsWith('.pdf'));
  if (!pdfFilename) {
    throw new Error('No PDF file found in AI_Companion_RAG');
  }

  let pdfParse;
  try {
    ({ PDFParse: pdfParse } = require(path.join(root, '.tmp_pdf', 'node_modules', 'pdf-parse')));
  } catch (error) {
    throw new Error('Missing temporary pdf-parse dependency. Run `npm install pdf-parse --prefix ./.tmp_pdf` first.');
  }

  const parser = new pdfParse({
    data: fs.readFileSync(path.join(inputDir, pdfFilename))
  });
  const result = await parser.getText();
  await parser.destroy();

  const outPath = path.join(outputDir, 'CompanionAI_RAG資料.txt');
  fs.writeFileSync(outPath, result.text.trim() + '\n', 'utf8');
  console.log(`Wrote ${path.relative(root, outPath)}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
