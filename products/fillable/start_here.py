"""Builds '00 Start Here.pdf' for the Soft Botanical fill-in kit. Usage: python3 start_here.py <out.pdf>"""
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit

SERIF, SERIF_I = "Times-Roman", "Times-Italic"
for path, name in (("/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf", "Lora"),
                   ("/usr/share/fonts/truetype/google-fonts/Lora-Italic-Variable.ttf", "Lora-Italic")):
    try:
        pdfmetrics.registerFont(TTFont(name, path))
        SERIF, SERIF_I = ("Lora", SERIF_I) if name == "Lora" else (SERIF, "Lora-Italic")
    except Exception:
        pass

PAPER, MOSS, SAGE, INK, SOFT = HexColor("#f7f3ec"), HexColor("#3d4a36"), HexColor("#6d7f5f"), HexColor("#3f3b37"), HexColor("#7a746c")
W, H = letter
M = 60

SECTIONS = [
    ("Before you start", [
        "Your kit has three fill-in files: the folded program, the welcome sign and the share-a-memory card.",
        "Download them, then open each one in the free Adobe Acrobat Reader app (iPhone, Android or computer). Most PDF apps work, but Adobe keeps the lettering exactly right.",
    ]),
    ("Type your words", [
        "Tap any wording on the design and type over it: the name, dates, order of service, life story and thank-you note are all editable. The sample text is there to show you what goes where.",
        "Leave a line empty if you don't need it, for example an order-of-service item.",
        "Adding a photo: on a computer, open the program or sign in Adobe Acrobat Reader and click the photo frame to choose a photo. If you'd rather not add one, the frame prints empty as a soft decorative shape.",
        "Save when you're done, then print the saved copy or send it to a print shop.",
    ]),
    ("Print the program", [
        "Paper: US Letter (8.5 x 11 in), landscape. A matte cardstock or 80-100 lb paper looks lovely.",
        "Print double-sided, flipping on the SHORT edge, at 100% / actual size. Fold in half to 5.5 x 8.5 in.",
        "Print one test copy first to check the folding and spelling.",
    ]),
    ("Print the welcome sign", [
        "Designed at 24 x 36 in. It also prints sharply at 16 x 24 or 12 x 18 in (same shape).",
        "Send your saved file to a print shop such as Staples, Office Depot, FedEx Office or Walgreens and ask for a poster or foam board at one of those sizes.",
    ]),
    ("Print the memory cards", [
        "Page 1 is a single 4.25 x 5.5 in card. Page 2 places four cards on one US Letter sheet: type the name once and it fills all four.",
        "Print page 2 on cardstock at 100%, then cut along the small grey marks.",
    ]),
    ("Good to know", [
        "For personal use for your own family's service. Please don't resell or share the files.",
        "Designed by me with the help of AI tools; previews show the real files you receive.",
        "Questions or something not working? Message us through the Forever Held store on Payhip and we'll help.",
    ]),
]


ADDON_SECTIONS = [
    ("Print the bookmarks", [
        "Each bookmark is 2 x 7 in. Page 2 places four on one US Letter sheet: type once and all four fill in.",
        "Print page 2 on cardstock at 100%, then cut along the small grey marks. Add a ribbon or tassel through a hole punch if you like.",
    ]),
    ("Print the thank-you cards", [
        "Each card is 4.25 x 5.5 in, and page 2 prints four on one US Letter sheet. Cut along the grey marks.",
        "They fit A2 envelopes (4.375 x 5.75 in), sold at most craft and office stores.",
    ]),
    ("Share the phone announcement", [
        "This one is made for phones, not paper. Type the name, service details and note, add a photo on a computer if you like, then save.",
        "Send the saved PDF by text or email, or take a screenshot of it and share the picture in messages or on social media.",
    ]),
    ("Print the guest book pages", [
        "Type the name once, then print as many pages as you need on US Letter paper. Each page has room for 12 guests.",
        "Three-hole punch the pages for a binder, or lay them on the welcome table with a pen.",
    ]),
]


def build(out, complete=False, style="Soft Botanical"):
    sections = list(SECTIONS)
    if complete:
        sections[0] = ("Before you start", [
            "Your Complete Suite has seven fill-in files: the folded program, welcome sign, share-a-memory card, bookmark, thank-you card, phone announcement and guest book page.",
            SECTIONS[0][1][1],
        ])
        sections = sections[:-1] + ADDON_SECTIONS + sections[-1:]
    c = canvas.Canvas(out, pagesize=letter)
    c.setTitle(f"Start Here - {style} Memorial Kit"); c.setAuthor("Forever Held")

    def new_page():
        c.setFillColor(PAPER); c.rect(0, 0, W, H, fill=1, stroke=0)
        c.setStrokeColor(HexColor("#d9ddd0")); c.setLineWidth(0.8); c.rect(18, 18, W - 36, H - 36, fill=0, stroke=1)

    new_page()
    y = H - 78
    c.setFillColor(SAGE); c.setFont("Helvetica", 9); c.drawCentredString(W / 2, y, "F O R E V E R   H E L D")
    y -= 40
    c.setFillColor(MOSS); c.setFont(SERIF_I, 30); c.drawCentredString(W / 2, y, "Thank you, and start here")
    y -= 24
    c.setFillColor(SOFT); c.setFont(SERIF_I, 12)
    c.drawCentredString(W / 2, y, f"{style} Complete Suite: seven matching memorial pieces" if complete else f"{style} memorial kit: program, welcome sign and share-a-memory card")
    y -= 22
    c.setStrokeColor(SAGE); c.setLineWidth(0.7); c.line(W / 2 - 30, y, W / 2 + 30, y)
    y -= 30
    for title, paras in sections:
        need = 26 + sum(len(simpleSplit(p, SERIF, 11, W - 2 * M - 16)) * 16 + 6 for p in paras)
        if y - need < 50:
            c.showPage(); new_page(); y = H - 70
        c.setFillColor(MOSS); c.setFont(SERIF, 15); c.drawString(M, y, title); y -= 20
        for p in paras:
            lines = simpleSplit(p, SERIF, 11, W - 2 * M - 16)
            c.setFillColor(SAGE); c.circle(M + 4, y + 3.5, 1.8, fill=1, stroke=0)
            c.setFillColor(INK); c.setFont(SERIF, 11)
            for ln in lines:
                c.drawString(M + 16, y, ln); y -= 16
            y -= 6
        y -= 10
    c.save()


if __name__ == "__main__":
    style = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--style=")), "Soft Botanical")
    build(sys.argv[1], complete="--complete" in sys.argv, style=style)
