"""Builds '00 Start Here - <collection>.pdf' for the holiday collections. Usage: python3 holiday_start_here.py"""
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit

HERE = Path(__file__).parent
pdfmetrics.registerFont(TTFont("Cala", str(HERE / "fonts" / "Caladea-Regular.ttf")))
pdfmetrics.registerFont(TTFont("Cala-I", str(HERE / "fonts" / "Caladea-Italic.ttf")))
W, H = letter
M = 64

COMMON_START = [
    "Download the files, then open each one in the free Adobe Acrobat Reader app (iPhone, Android or computer). Most PDF apps work, but Adobe keeps the lettering exactly right.",
    "Tap any wording and type over it. The sample names and words show you what goes where. Leave a line empty if you don't need it.",
    "Save, then print the saved copy at 100% / actual size on US Letter paper. A matte cardstock (65-110 lb) looks and feels lovely.",
]
CARD_TIP = "Each card file has two pages: one card to check your wording, and a print sheet with four cards. Type once and every copy updates. Cut along the small grey marks at the edges."
SIGN_TIP = "The sign is 8 x 10 in. Print page 2 on US Letter and trim at the grey marks, or ask a print shop for an 8 x 10 print of page 1. It fits a standard 8 x 10 frame."

COLLECTIONS = {
    "Evergreen & Candlelight": dict(ink="#22382e", accent="#b48a45", paper="#f7f1e4",
        lead="A gentle way to keep them close this Christmas: a candle sign for the table, cards for sharing memories, and keepsake ornaments for the tree.",
        pieces=[("01 Table Sign", SIGN_TIP + " Set it beside a real or battery candle."),
                ("02 Memory Cards", CARD_TIP + " Put one at each place setting and invite everyone to write a favorite holiday memory. Read them aloud, or keep them in a box to open each year."),
                ("02b Memory Cards (ink-saver)", "The same cards on a light background, for home printers that run low on ink."),
                ("03 Ornament Cards", "Four ornaments per sheet. Cut along the dotted arch, punch the small circle and tie with ribbon. Cardstock works best.")]),
    "Longest Night": dict(ink="#2a2d40", accent="#3c4570", paper="#f6f5f9",
        lead="For Blue Christmas and Longest Night services, Hanukkah evenings and the winter solstice. A quiet set for anyone carrying an empty place into the season.",
        pieces=[("01 Table Sign", SIGN_TIP),
                ("01b Table Sign (ink-saver)", "The same sign with a light background, for home printers."),
                ("02 Program", "Prints on US Letter, landscape, double-sided: flip on the SHORT edge. Fold in half to 5.5 x 8.5 in. Add the names your community is remembering on the back, the order of service and candle words inside. Print one test copy first."),
                ("03 Candle-Lighting Cards", CARD_TIP + " Hand them out as people arrive, so each person can write a name before the candles are lit.")]),
    "Harvest Table": dict(ink="#4b3527", accent="#b45f3c", paper="#efe5d3",
        lead="For the first Thanksgiving with an empty chair: a sign that says we saved a seat for you, cards for sharing what you're thankful for, and matching place cards.",
        pieces=[("01 Empty-Chair Sign", SIGN_TIP + " Set it on the empty chair or at their place at the table."),
                ("02 Thankful Cards", CARD_TIP + " Invite each guest to finish the sentence about the person you're missing."),
                ("03 Place Cards", "Four per sheet. Cut on the grey marks, fold along the dotted line so the name stands up. Use the top line for \"In loving memory\" on their seat, or clear it and type each guest's name.")]),
}


def build(name, c, out):
    cv = canvas.Canvas(str(out), pagesize=letter)
    cv.setTitle(f"Start Here - {name}"); cv.setAuthor("Forever Held")
    cv.setFillColor(HexColor(c["paper"])); cv.rect(0, 0, W, H, stroke=0, fill=1)
    cv.setStrokeColor(HexColor(c["accent"])); cv.setLineWidth(1); cv.rect(28, 28, W - 56, H - 56)
    y = H - 96
    cv.setFillColor(HexColor(c["accent"])); cv.setFont("Helvetica", 9)
    cv.drawCentredString(W / 2, y, "  ".join("FOREVER HELD"))
    y -= 40; cv.setFillColor(HexColor(c["ink"])); cv.setFont("Cala", 30); cv.drawCentredString(W / 2, y, name)
    y -= 24; cv.setFont("Cala-I", 13)
    for ln in simpleSplit(c["lead"], "Cala-I", 13, W - 2 * M - 40):
        cv.drawCentredString(W / 2, y, ln); y -= 18
    y -= 14

    def section(title, paras):
        nonlocal y
        cv.setFillColor(HexColor(c["accent"])); cv.setFont("Helvetica-Bold", 9.5); cv.drawString(M, y, title.upper()); y -= 16
        cv.setFillColor(HexColor(c["ink"])); cv.setFont("Cala", 11.5)
        for p in paras:
            for ln in simpleSplit(p, "Cala", 11.5, W - 2 * M):
                cv.drawString(M, y, ln); y -= 15
            y -= 5
        y -= 8

    section("Before you start", COMMON_START)
    for title, tip in c["pieces"]:
        section(title, [tip])
    section("Need help?", ["Write to us any time at foreverheld.shop@gmail.com. We're glad to help with wording, printing or anything else."])
    cv.save()


if __name__ == "__main__":
    for name, c in COLLECTIONS.items():
        out = HERE / "out" / name / f"00 Start Here - {name}.pdf"
        build(name, c, out); print("built", out)
