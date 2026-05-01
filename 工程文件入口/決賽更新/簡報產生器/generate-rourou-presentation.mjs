import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve("C:/Users/閻星澄/Desktop/FHIR-main/FHIR-main");
const SLIDE_TEXT_PATH = path.join(ROOT, "工程文件入口", "決賽更新", "簡報文本.md");
const OUTPUT_DIR = path.join(ROOT, "tmp", "presentations", "rourou-final-presentation", "output");
const OUTPUT_PPTX = path.join(OUTPUT_DIR, "output.pptx");
const REPO_PPTX = path.join(ROOT, "工程文件入口", "決賽更新", "Rou Rou AI Companion_決賽簡報.pptx");
const ARTIFACT_TOOL_PATH = path.join(
  ROOT,
  "tmp",
  "presentations",
  "rourou-final-presentation",
  "node_modules",
  "@oai",
  "artifact-tool",
  "dist",
  "artifact_tool.mjs",
);

const {
  Presentation,
  PresentationFile,
  column,
  row,
  grid,
  layers,
  panel,
  text,
  rule,
  fill,
  hug,
  fixed,
  wrap,
  grow,
  fr,
  auto,
} = await import(pathToFileURL(ARTIFACT_TOOL_PATH).href);

const THEME = {
  bg: "#0F3D2E",
  bgSoft: "#174D39",
  panel: "#F4FBF7",
  panelSoft: "#E4F2EA",
  accent: "#65C18C",
  accent2: "#9DE0AD",
  text: "#FFFFFF",
  textDark: "#143C2E",
  textMuted: "#D7EFE1",
  textSoft: "#5A7D6D",
};

function cleanTick(textValue) {
  return textValue.replace(/^`|`$/g, "").trim();
}

function extractBlock(raw, heading) {
  const regex = new RegExp(`### ${heading}\\s+([\\s\\S]*?)(?=\\n### |\\n---|$)`, "m");
  const match = raw.match(regex);
  return match ? match[1].trim() : "";
}

function extractBullets(block) {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function parseSlides(markdown) {
  const sections = markdown.split(/\n## 第 \d+ 頁：/).slice(1);
  const headings = [...markdown.matchAll(/\n## 第 (\d+) 頁：([^\n]+)/g)];
  return sections.map((body, index) => {
    const page = Number(headings[index][1]);
    const name = headings[index][2].trim();
    const title = cleanTick(extractBlock(body, "標題"));
    const subtitle = cleanTick(extractBlock(body, "副標"));
    const slideText = extractBullets(extractBlock(body, "投影片文字"));
    const apiText = extractBullets(extractBlock(body, "API 補充文字"));
    const suggestions = extractBullets(extractBlock(body, "建議放的截圖"));
    const keyline = cleanTick(extractBlock(body, "小結"));
    const formatBlock = extractBlock(body, "格式示意");
    return {
      page,
      name,
      title,
      subtitle,
      slideText,
      apiText,
      suggestions,
      keyline,
      formatBlock,
    };
  });
}

function bulletRows(items, dark = false) {
  return items.map((item, index) =>
    row(
      { name: `bullet-row-${index}`, width: fill, height: hug, gap: 14, alignY: "start" },
      [
        text("•", {
          name: `bullet-dot-${index}`,
          width: fixed(24),
          height: hug,
          style: { fontSize: 28, color: dark ? THEME.accent : THEME.accent2, bold: true },
        }),
        text(item, {
          name: `bullet-text-${index}`,
          width: fill,
          height: hug,
          style: { fontSize: 24, color: dark ? THEME.textDark : THEME.textMuted, breakLine: true },
        }),
      ],
    ),
  );
}

function placeholderPanel(label, body = "", tone = "light") {
  const dark = tone === "dark";
  return panel(
    {
      name: `placeholder-${label}`,
      width: fill,
      height: fill,
      padding: 24,
      borderRadius: "rounded-xl",
      fill: dark ? THEME.bgSoft : THEME.panelSoft,
      stroke: dark ? THEME.accent2 : THEME.accent,
      strokeWidth: 2,
    },
    column(
      { width: fill, height: fill, gap: 12, alignY: "center", justify: "center" },
      [
        text(label, {
          width: fill,
          height: hug,
          style: {
            fontSize: 28,
            bold: true,
            align: "center",
            color: dark ? THEME.text : THEME.textDark,
          },
        }),
        body
          ? text(body, {
              width: fill,
              height: hug,
              style: {
                fontSize: 18,
                align: "center",
                color: dark ? THEME.textMuted : THEME.textSoft,
                breakLine: true,
              },
            })
          : text("", { width: fill, height: hug, style: { fontSize: 1, color: dark ? THEME.text : THEME.textDark } }),
      ],
    ),
  );
}

function slideScaffold({ slide, title, pageLabel, dark = true, subtitle = "" }, body) {
  slide.compose(
    column(
      {
        name: "root",
        width: fill,
        height: fill,
        padding: { x: 80, y: 60 },
        gap: 28,
      },
      [
        row(
          { name: "top-row", width: fill, height: hug, gap: 24, alignY: "center" },
          [
            column(
              { width: grow(1), height: hug, gap: 14 },
              [
                text(title, {
                  name: "slide-title",
                  width: fill,
                  height: hug,
                  style: { fontSize: 50, bold: true, color: dark ? THEME.text : THEME.textDark, breakLine: true },
                }),
                subtitle
                  ? text(subtitle, {
                      name: "slide-subtitle",
                      width: wrap(1200),
                      height: hug,
                      style: { fontSize: 22, color: dark ? THEME.textMuted : THEME.textSoft, breakLine: true },
                    })
                  : rule({
                      name: "title-rule",
                      width: fixed(180),
                      stroke: dark ? THEME.accent2 : THEME.accent,
                      weight: 4,
                    }),
              ],
            ),
            panel(
              {
                name: "page-chip",
                width: fixed(150),
                height: hug,
                padding: { x: 18, y: 10 },
                borderRadius: "rounded-full",
                fill: dark ? "#1E5D46" : THEME.panelSoft,
              },
              text(pageLabel, {
                width: fill,
                height: hug,
                style: { fontSize: 18, bold: true, align: "center", color: dark ? THEME.text : THEME.textDark },
              }),
            ),
          ],
        ),
        body,
      ],
    ),
    {
      frame: { left: 0, top: 0, width: 1920, height: 1080 },
      baseUnit: 8,
      background: dark ? THEME.bg : "#FCFFFD",
    },
  );
}

function makeTitleSlide(slide, data) {
  slideScaffold(
    { slide, title: data.title, pageLabel: `第 ${data.page} 頁`, subtitle: data.subtitle, dark: true },
    row(
      { width: fill, height: grow(1), gap: 40 },
      [
        column(
          { width: grow(1.2), height: fill, gap: 24, justify: "center" },
          [
            panel(
              {
                width: fill,
                height: hug,
                padding: 28,
                borderRadius: "rounded-2xl",
                fill: "#19523D",
              },
              text("FHIR x AI x Mental Health", {
                width: fill,
                height: hug,
                style: { fontSize: 26, bold: true, color: THEME.accent2, align: "center" },
              }),
            ),
            text("決賽簡報", {
              width: fill,
              height: hug,
              style: { fontSize: 84, bold: true, color: THEME.text, breakLine: true },
            }),
            text("Rou Rou AI Companion", {
              width: fill,
              height: hug,
              style: { fontSize: 34, color: THEME.textMuted },
            }),
          ],
        ),
        column(
          { width: grow(0.8), height: fill, justify: "center" },
          [
            placeholderPanel("產品視覺主圖區", "這裡建議放聊天首頁、報表或品牌主視覺", "dark"),
          ],
        ),
      ],
    ),
  );
}

function makeBulletSlide(slide, data, options = {}) {
  const dark = options.dark ?? true;
  const rightLabel = options.rightLabel ?? "";
  const extraBullets = options.extraBullets ?? [];
  const bullets = [...data.slideText, ...extraBullets];
  slideScaffold(
    { slide, title: data.title, pageLabel: `第 ${data.page} 頁`, dark },
    row(
      { width: fill, height: grow(1), gap: 36 },
      [
        panel(
          {
            width: grow(1.15),
            height: fill,
            padding: 30,
            borderRadius: "rounded-2xl",
            fill: dark ? "#174A37" : THEME.panel,
          },
          column({ width: fill, height: fill, gap: 18 }, bulletRows(bullets, !dark ? true : false)),
        ),
        column(
          { width: grow(0.85), height: fill, gap: 20 },
          [
            placeholderPanel(
              rightLabel || "代表畫面 / 圖像區",
              options.placeholderBody || "可放示意圖、品牌畫面、系統截圖或流程圖。",
              dark ? "dark" : "light",
            ),
            data.keyline
              ? panel(
                  {
                    width: fill,
                    height: hug,
                    padding: 22,
                    borderRadius: "rounded-xl",
                    fill: dark ? "#123C2E" : THEME.panelSoft,
                    stroke: dark ? THEME.accent : THEME.accent2,
                    strokeWidth: 2,
                  },
                  text(data.keyline, {
                    width: fill,
                    height: hug,
                    style: { fontSize: 20, bold: true, color: dark ? THEME.accent2 : THEME.textDark, breakLine: true },
                  }),
                )
              : text("", { width: fill, height: hug, style: { fontSize: 1, color: dark ? THEME.text : THEME.textDark } }),
          ],
        ),
      ],
    ),
  );
}

function makeDiagramSlide(slide, data, label, body) {
  slideScaffold(
    { slide, title: data.title, pageLabel: `第 ${data.page} 頁`, dark: true },
    column(
      { width: fill, height: grow(1), gap: 24 },
      [
        placeholderPanel(label, body, "dark"),
      ],
    ),
  );
}

function makeSplitFormatSlide(slide, data) {
  slideScaffold(
    { slide, title: data.title, pageLabel: `第 ${data.page} 頁`, dark: false },
    row(
      { width: fill, height: grow(1), gap: 28 },
      [
        panel(
          {
            width: grow(0.9),
            height: fill,
            padding: 28,
            borderRadius: "rounded-2xl",
            fill: THEME.panel,
          },
          column({ width: fill, height: fill, gap: 18 }, bulletRows(data.slideText, true)),
        ),
        panel(
          {
            width: grow(1.1),
            height: fill,
            padding: 28,
            borderRadius: "rounded-2xl",
            fill: "#F7FCF9",
            stroke: THEME.accent2,
            strokeWidth: 2,
          },
          column(
            { width: fill, height: fill, gap: 16 },
            [
              text("格式示意", {
                width: fill,
                height: hug,
                style: { fontSize: 28, bold: true, color: THEME.textDark },
              }),
              text(data.formatBlock || "此頁可放 FHIR JSON / 結構示意。", {
                width: fill,
                height: fill,
                style: {
                  fontSize: 22,
                  color: THEME.textSoft,
                  fontFace: "Courier New",
                  breakLine: true,
                },
              }),
            ],
          ),
        ),
      ],
    ),
  );
}

function makeDemoSlide(slide, data) {
  const screenshots = data.suggestions.length ? data.suggestions : ["主要畫面截圖"];
  slideScaffold(
    { slide, title: data.title, pageLabel: `第 ${data.page} 頁`, dark: false },
    row(
      { width: fill, height: grow(1), gap: 24 },
      [
        column(
          { width: grow(1.2), height: fill, gap: 18 },
          screenshots.slice(0, 2).map((item, index) =>
            placeholderPanel(`截圖 ${index + 1}`, item, "light"),
          ),
        ),
        column(
          { width: grow(0.8), height: fill, gap: 18 },
          [
            panel(
              {
                width: fill,
                height: fill,
                padding: 26,
                borderRadius: "rounded-2xl",
                fill: THEME.panel,
              },
              column({ width: fill, height: fill, gap: 18 }, bulletRows(data.slideText, true)),
            ),
          ],
        ),
      ],
    ),
  );
}

function makeLearningSlide(slide, data) {
  slideScaffold(
    { slide, title: data.title, pageLabel: `第 ${data.page} 頁`, dark: false },
    row(
      { width: fill, height: grow(1), gap: 28 },
      [
        panel(
          {
            width: grow(1.05),
            height: fill,
            padding: 28,
            borderRadius: "rounded-2xl",
            fill: THEME.panel,
          },
          column({ width: fill, height: fill, gap: 18 }, bulletRows(data.slideText, true)),
        ),
        column(
          { width: grow(0.95), height: fill, gap: 18 },
          [
            placeholderPanel("精華截錄", "建議截取 AI協作使用模式分析 或 學習心得文件中的一句核心反思。", "light"),
            panel(
              {
                width: fill,
                height: hug,
                padding: 22,
                borderRadius: "rounded-xl",
                fill: "#EEF8F1",
              },
              text("以人為本、Human-in-the-loop、對最終成果負責", {
                width: fill,
                height: hug,
                style: { fontSize: 22, bold: true, color: THEME.textDark, breakLine: true },
              }),
            ),
          ],
        ),
      ],
    ),
  );
}

function makeClosingSlide(slide, data) {
  slideScaffold(
    { slide, title: data.title, pageLabel: `第 ${data.page} 頁`, dark: true },
    column(
      { width: fill, height: grow(1), gap: 26, justify: "center" },
      [
        panel(
          {
            width: wrap(1280),
            height: hug,
            padding: 36,
            borderRadius: "rounded-2xl",
            fill: "#184C38",
          },
          column({ width: fill, height: hug, gap: 18 }, [
            ...bulletRows(data.slideText, false),
          ]),
        ),
        text("謝謝聆聽", {
          width: fill,
          height: hug,
          style: { fontSize: 64, bold: true, color: THEME.text, align: "center" },
        }),
      ],
    ),
  );
}

function renderSlide(slide, data) {
  if (data.page === 1) return makeTitleSlide(slide, data);
  if ([2, 3, 4, 9, 10, 11, 12].includes(data.page)) {
    return makeBulletSlide(slide, data, {
      placeholderBody:
        data.page === 12
          ? "此頁建議放聊天流 trace、HAM-D 累積痕跡與 PHQ-9 完成畫面。"
          : "此頁建議放與內容最相關的產品畫面、研究圖或概念示意。",
      rightLabel:
        data.page === 12 ? "雙軌量表示意區" : "輔助視覺區",
    });
  }
  if (data.page === 5) {
    return makeDiagramSlide(slide, data, "三方角色 Mermaid 圖", "病人、AI、醫師的交通圖建議整張置中放大。");
  }
  if (data.page === 6) {
    return makeDiagramSlide(slide, data, "病人端主流程圖", "建議放病人端主流程 Mermaid，右下角可加一句『對話到交付』。");
  }
  if (data.page === 7) {
    return makeDiagramSlide(slide, data, "醫師端流程圖", "建議放醫師端工作台流程圖，強調『看整理後重點』。");
  }
  if (data.page === 8) {
    return slideScaffold(
      { slide, title: data.title, pageLabel: `第 ${data.page} 頁`, dark: false },
      column(
        { width: fill, height: grow(1), gap: 20 },
        [
          row(
            { width: fill, height: grow(1), gap: 20 },
            [
              placeholderPanel("FHIR 交付 Mermaid 圖", "建議放 Bundle 建構與 validator 管線。", "light"),
              placeholderPanel("API 補充 Mermaid 圖", "建議放 /api/chat/output 與 /api/fhir/bundle 的責任分工。", "light"),
            ],
          ),
          panel(
            {
              width: fill,
              height: hug,
              padding: 24,
              borderRadius: "rounded-2xl",
              fill: THEME.panel,
            },
            column(
              { width: fill, height: hug, gap: 14 },
              [
                ...bulletRows(data.slideText, true),
                rule({ width: fill, stroke: THEME.accent2, weight: 2 }),
                ...bulletRows(data.apiText, true),
              ],
            ),
          ),
        ],
      ),
    );
  }
  if ([13, 14].includes(data.page)) return makeSplitFormatSlide(slide, data);
  if ([15, 16, 17, 18, 19, 20].includes(data.page)) return makeDemoSlide(slide, data);
  if (data.page === 21) return makeLearningSlide(slide, data);
  if (data.page === 22) return makeClosingSlide(slide, data);
  return makeBulletSlide(slide, data);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const markdown = await fs.readFile(SLIDE_TEXT_PATH, "utf8");
  const slides = parseSlides(markdown);

  const presentation = Presentation.create({
    slideSize: { width: 1920, height: 1080 },
  });

  for (const slideData of slides) {
    const slide = presentation.slides.add();
    renderSlide(slide, slideData);
  }

  const pptxBlob = await PresentationFile.exportPptx(presentation);
  await pptxBlob.save(OUTPUT_PPTX);
  await fs.copyFile(OUTPUT_PPTX, REPO_PPTX);
  console.log(`PPTX written to ${OUTPUT_PPTX}`);
  console.log(`Repo copy written to ${REPO_PPTX}`);
}

await main();
