"""Free lead magnet: Funeral & Celebration of Life Planning Checklist (US Letter, fill-in checkboxes + notes).
Usage: python3 products/freebie/build_checklist.py  -> products/freebie/out/Forever Held - Planning Checklist (free).pdf
"""
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, white

HERE = Path(__file__).parent
ART = HERE.parent / "fillable" / "art"
FONTS = HERE.parent / "fillable" / "fonts"
pdfmetrics.registerFont(TTFont("Cinzel", str(FONTS / "Cinzel.ttf")))
pdfmetrics.registerFont(TTFont("Corm", str(FONTS / "CormorantGaramond.ttf")))
pdfmetrics.registerFont(TTFont("CormI", str(FONTS / "CormorantGaramond-Italic.ttf")))

W, H = letter
INK, SAGE, SOFT, LINE, PAPER = HexColor("#4a4540"), HexColor("#5f6e56"), HexColor("#8a9a7b"), HexColor("#d9d3c7"), HexColor("#fbf9f4")
M = 64  # side margin

PAGES = [
    ("The First Few Days", "Take these one at a time. Nothing here has to happen all at once.", [
        "Call close family and friends (ask one person to help spread the word)",
        "Contact a funeral home or cremation provider",
        "Look for written wishes, a will, or a pre-arranged plan",
        "Choose one helper to coordinate calls, meals and visitors",
        "Arrange care for children, pets and the home",
        "Let their employer know, if they were working",
        "Ask the funeral home about copies of the death certificate",
        "Keep the home, car and valuables secure",
        "Start a list of who sent food, flowers or help (for thank-you notes later)",
    ]),
    ("Planning the Service", "A gathering that feels like them matters more than getting everything perfect.", [
        "Choose the kind of gathering: funeral, memorial, celebration of life, graveside",
        "Set the date, time and place",
        "Ask someone to officiate or lead the service",
        "Invite speakers and readers; choose verses, poems or readings",
        "Choose music for arrival, the service and leaving",
        "Gather photos for a display table or slideshow",
        "Write the obituary or announcement",
        "Make the program (order of service)",
        "Make a welcome sign and share-a-memory cards for guests",
        "Plan the reception: place, food, guest book",
        "Decide on flowers, or an 'in lieu of flowers' charity",
        "Choose pallbearers, if needed",
    ]),
    ("After the Service", "Grief keeps its own time. Come back to this page whenever you're ready.", [
        "Send thank-you notes to those who helped",
        "Keep important papers together in one folder",
        "Notify banks, insurers and government offices (the funeral home can advise)",
        "Cancel or transfer subscriptions, phone and utilities",
        "Share photos and memories collected at the service with family",
        "Be gentle with yourself, and let people help",
    ]),
]
CONTACTS = ["Funeral home", "Officiant", "Venue", "Florist", "Print shop"]


def frame(c, n, title, sub):
    c.setFillColor(PAPER); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.drawImage(str(ART / "spray.png"), W / 2 - 110, H - 118, width=220, height=106, mask="auto")
    c.setFillColor(SAGE); c.setFont("Cinzel", 22); c.drawCentredString(W / 2, H - 150, title.upper())
    c.setFillColor(INK); c.setFont("CormI", 14); c.drawCentredString(W / 2, H - 172, sub)
    c.drawImage(str(ART / "divider.png"), W / 2 - 70, H - 198, width=140, height=19, mask="auto")
    c.setFillColor(SOFT); c.setFont("Corm", 9.5)
    c.drawString(M, 30, "Funeral & Celebration of Life Planning Checklist")
    c.drawRightString(W - M, 30, f"Forever Held  ·  page {n} of 3")


def checklist(c, page, items, top):
    y = top
    for i, text in enumerate(items):
        c.acroForm.checkbox(name=f"p{page}_{i + 1}", x=M, y=y - 3, size=13, borderColor=SOFT, fillColor=white,
                            buttonStyle="check", borderWidth=0.8, forceBorder=True, tooltip=text)
        c.setFillColor(INK); c.setFont("Corm", 13.5); c.drawString(M + 24, y, text)
        c.setStrokeColor(LINE); c.setLineWidth(0.5); c.line(M + 24, y - 9, W - M, y - 9)
        y -= 36
    return y


def build():
    out = HERE / "out"; out.mkdir(exist_ok=True)
    path = out / "Forever Held - Planning Checklist (free).pdf"
    c = canvas.Canvas(str(path), pagesize=letter)
    c.setTitle("Funeral & Celebration of Life Planning Checklist"); c.setAuthor("Forever Held")
    c.setSubject("A free fill-in checklist for families planning a funeral, memorial or celebration of life")
    for n, (title, sub, items) in enumerate(PAGES, 1):
        frame(c, n, title, sub)
        y = checklist(c, n, items, H - 236)
        if n == 3:
            y -= 10
            c.setFillColor(SAGE); c.setFont("Cinzel", 12); c.drawString(M, y, "KEY CONTACTS")
            y -= 22
            for i, who in enumerate(CONTACTS):
                c.setFillColor(INK); c.setFont("CormI", 12.5); c.drawString(M, y + 4, who)
                c.acroForm.textfield(name=f"contact_{i + 1}", tooltip=f"{who}: name and phone", x=M + 92, y=y - 2, width=W - 2 * M - 92, height=18,
                                     fontName="Times-Roman", fontSize=11, borderWidth=0, fillColor=PAPER, textColor=INK, forceBorder=False)
                c.setStrokeColor(LINE); c.line(M + 92, y - 3, W - M, y - 3)
                y -= 26
            y -= 6
            c.setFillColor(SAGE); c.setFont("Cinzel", 12); c.drawString(M, y, "NOTES")
            c.acroForm.textfield(name="notes", tooltip="Notes", x=M, y=118, width=W - 2 * M, height=y - 126, fontName="Times-Roman", fontSize=11,
                                 borderWidth=0.6, borderColor=LINE, fillColor=PAPER, textColor=INK, fieldFlags="multiline")
            c.setFillColor(SOFT); c.setFont("CormI", 12)
            c.drawCentredString(W / 2, 88, "When you're ready to make the program, welcome sign and memory cards, our fill-in")
            c.drawCentredString(W / 2, 72, "Soft Botanical kit is at payhip.com/ForeverHeld. You type, save and print. No design skills needed.")
            c.linkURL("https://payhip.com/ForeverHeld", (M, 66, W - M, 100), relative=0)
        c.showPage()
    c.save()
    return path


if __name__ == "__main__":
    print(build())
