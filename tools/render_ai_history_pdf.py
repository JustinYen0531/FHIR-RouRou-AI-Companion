from __future__ import annotations

import html
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Image,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)


FONT_PATH = r"C:\Windows\Fonts\msjh.ttc"
FONT_NAME = "MicrosoftJhengHei"


def register_font() -> None:
    if FONT_NAME in pdfmetrics.getRegisteredFontNames():
        return
    pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_PATH, subfontIndex=0))


def make_styles():
    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "BodyCJK",
        parent=styles["BodyText"],
        fontName=FONT_NAME,
        fontSize=11,
        leading=18,
        textColor=colors.HexColor("#222222"),
        spaceAfter=8,
    )
    title = ParagraphStyle(
        "TitleCJK",
        parent=styles["Title"],
        fontName=FONT_NAME,
        fontSize=20,
        leading=26,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#111111"),
        spaceAfter=16,
    )
    h1 = ParagraphStyle(
        "H1CJK",
        parent=styles["Heading1"],
        fontName=FONT_NAME,
        fontSize=16,
        leading=22,
        textColor=colors.HexColor("#111111"),
        spaceBefore=12,
        spaceAfter=8,
    )
    h2 = ParagraphStyle(
        "H2CJK",
        parent=styles["Heading2"],
        fontName=FONT_NAME,
        fontSize=13,
        leading=19,
        textColor=colors.HexColor("#222222"),
        spaceBefore=10,
        spaceAfter=6,
    )
    small = ParagraphStyle(
        "SmallCJK",
        parent=body,
        fontName=FONT_NAME,
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#555555"),
        leftIndent=8,
        rightIndent=8,
    )
    list_style = ParagraphStyle(
        "ListCJK",
        parent=body,
        leftIndent=0,
        firstLineIndent=0,
        spaceAfter=2,
    )
    return {
        "body": body,
        "title": title,
        "h1": h1,
        "h2": h2,
        "small": small,
        "list": list_style,
    }


def inline_markup(text: str) -> str:
    text = html.escape(text.strip())
    text = re.sub(r"`([^`]+)`", r"<font backColor='#F2F4F8'>\1</font>", text)
    return text


def add_image(story: list, image_path: Path, max_width: float, max_height: float) -> None:
    if not image_path.exists():
        return
    img = Image(str(image_path))
    width, height = img.imageWidth, img.imageHeight
    if not width or not height:
        return
    ratio = min(max_width / width, max_height / height, 1.0)
    img.drawWidth = width * ratio
    img.drawHeight = height * ratio
    story.append(Spacer(1, 4))
    story.append(img)
    story.append(Spacer(1, 8))


def flush_paragraph(paragraph_lines: list[str], story: list, styles) -> None:
    if not paragraph_lines:
        return
    text = " ".join(line.strip() for line in paragraph_lines)
    story.append(Paragraph(inline_markup(text), styles["body"]))
    paragraph_lines.clear()


def flush_bullets(bullets: list[str], story: list, styles) -> None:
    if not bullets:
        return
    items = [
        ListItem(Paragraph(inline_markup(item), styles["list"]))
        for item in bullets
    ]
    story.append(
        ListFlowable(
            items,
            bulletType="bullet",
            bulletFontName=FONT_NAME,
            bulletFontSize=10,
            leftIndent=16,
        )
    )
    story.append(Spacer(1, 4))
    bullets.clear()


def render_markdown(md_path: Path, pdf_path: Path) -> None:
    register_font()
    styles = make_styles()
    lines = md_path.read_text(encoding="utf-8").splitlines()
    story = []
    paragraph_lines: list[str] = []
    bullets: list[str] = []

    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.6 * cm,
        bottomMargin=1.6 * cm,
        title=md_path.stem,
    )
    max_width = A4[0] - doc.leftMargin - doc.rightMargin
    max_height = A4[1] * 0.52

    for raw_line in lines:
        line = raw_line.rstrip()
        stripped = line.strip()

        image_match = re.match(r"!\[[^\]]*\]\((.+?)\)", stripped)
        if image_match:
            flush_paragraph(paragraph_lines, story, styles)
            flush_bullets(bullets, story, styles)
            image_ref = image_match.group(1)
            image_path = (md_path.parent / image_ref).resolve()
            add_image(story, image_path, max_width, max_height)
            continue

        if stripped.startswith("<sub>") and stripped.endswith("</sub>"):
            flush_paragraph(paragraph_lines, story, styles)
            flush_bullets(bullets, story, styles)
            caption = re.sub(r"</?sub>", "", stripped)
            story.append(Paragraph(inline_markup(caption), styles["small"]))
            continue

        if stripped == "---":
            flush_paragraph(paragraph_lines, story, styles)
            flush_bullets(bullets, story, styles)
            story.append(Spacer(1, 4))
            story.append(HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#BBBBBB")))
            story.append(Spacer(1, 8))
            continue

        if not stripped:
            flush_paragraph(paragraph_lines, story, styles)
            flush_bullets(bullets, story, styles)
            continue

        if stripped.startswith("# "):
            flush_paragraph(paragraph_lines, story, styles)
            flush_bullets(bullets, story, styles)
            story.append(Paragraph(inline_markup(stripped[2:]), styles["title"]))
            continue

        if stripped.startswith("## "):
            flush_paragraph(paragraph_lines, story, styles)
            flush_bullets(bullets, story, styles)
            story.append(Paragraph(inline_markup(stripped[3:]), styles["h1"]))
            continue

        if stripped.startswith("### "):
            flush_paragraph(paragraph_lines, story, styles)
            flush_bullets(bullets, story, styles)
            story.append(Paragraph(inline_markup(stripped[4:]), styles["h2"]))
            continue

        if re.match(r"[-*] ", stripped):
            flush_paragraph(paragraph_lines, story, styles)
            bullets.append(stripped[2:].strip())
            continue

        if re.match(r"\d+\.\s", stripped):
            flush_paragraph(paragraph_lines, story, styles)
            flush_bullets(bullets, story, styles)
            story.append(Paragraph(inline_markup(stripped), styles["body"]))
            continue

        paragraph_lines.append(stripped)

    flush_paragraph(paragraph_lines, story, styles)
    flush_bullets(bullets, story, styles)
    doc.build(story)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: render_ai_history_pdf.py <input.md> <output.pdf>")
        return 1
    md_path = Path(sys.argv[1]).resolve()
    pdf_path = Path(sys.argv[2]).resolve()
    render_markdown(md_path, pdf_path)
    print(f"rendered: {pdf_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
