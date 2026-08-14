from pathlib import Path
import html
import re
import fitz
import markdown


SOURCE = Path("Veggie Cart - Phase 2 App Requirement Document.md")
OUTPUT = Path(r"C:\Users\HP\Downloads\Veggie Cart 2.0\Veggie Cart - Phase 2 App Requirement Document.pdf")


def build_html(markdown_text: str) -> str:
    body = markdown.markdown(
        markdown_text,
        extensions=["extra", "tables", "sane_lists"],
        output_format="html5",
    )
    # Keep the title/header clean in the PDF and avoid carrying Markdown's
    # horizontal rules into the first page as oversized spacing.
    body = body.replace("<hr />", "<hr>")
    css = """
    @page { margin: 0; }
    body { font-family: sans-serif; color: #1f2937; font-size: 9.2pt; line-height: 1.35; }
    h1 { color: #166534; font-size: 25pt; margin: 0 0 4pt; }
    h2 { color: #166534; font-size: 16pt; margin: 17pt 0 6pt; border-bottom: 1px solid #bbf7d0; padding-bottom: 3pt; }
    h3 { color: #15803d; font-size: 12.5pt; margin: 12pt 0 4pt; }
    h4 { color: #166534; font-size: 10.5pt; margin: 9pt 0 3pt; }
    p { margin: 0 0 6pt; }
    ul, ol { margin: 2pt 0 7pt 16pt; padding-left: 10pt; }
    li { margin: 0 0 2pt; }
    table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 8.3pt; }
    th { background: #166534; color: white; font-weight: bold; }
    th, td { border: 0.5px solid #a7f3d0; padding: 4pt; vertical-align: top; }
    tr:nth-child(even) td { background: #f0fdf4; }
    hr { border: 0; border-top: 1px solid #d1d5db; margin: 9pt 0; }
    strong { color: #14532d; }
    a { color: #166534; }
    """
    return f"<html><head><meta charset='utf-8'><style>{css}</style></head><body>{body}</body></html>"


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    html_text = build_html(text)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    writer = fitz.DocumentWriter(str(OUTPUT))
    page_rect = fitz.Rect(0, 0, 595, 842)  # A4 points
    content_rect = fitz.Rect(45, 45, 550, 797)
    story = fitz.Story(html=html_text, em=10)
    while True:
        device = writer.begin_page(page_rect)
        more, _ = story.place(content_rect)
        story.draw(device)
        writer.end_page()
        if not more:
            break
    writer.close()
    doc = fitz.open(str(OUTPUT))
    print(f"Created: {OUTPUT}")
    print(f"Pages: {doc.page_count}")
    print(f"Bytes: {OUTPUT.stat().st_size}")
    doc.close()


if __name__ == "__main__":
    main()
