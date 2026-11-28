"""Start Here guide + preview boards for Forever in My Heart. Usage: python3 products/fillable/forever_extras.py"""
from pathlib import Path
from holiday_start_here import build

HERE = Path(__file__).parent
NAME = "Forever in My Heart"
CARD = "Page 2 prints four cards on one US Letter sheet. Type once and every copy updates. Cut on the grey marks."
KIT = dict(ink="#4B1E2B", accent="#A4485A", paper="#FBF5F0",
    lead="For Valentine's Day, or any day you miss them most: a table sign, love letters to write to them, candle cards and a post to share.",
    pieces=[("01 Table Sign 8 x 10", "Print page 2 on US Letter and trim on the grey marks, or ask a print shop for an 8 x 10 print of page 1. It fits a standard 8 x 10 frame. Change the top line to suit any day, for example \"Our anniversary\"."),
            ("02 Love Letter Cards", CARD + " Type your letter, or delete the sample words and write by hand. Family members can each write one."),
            ("03 Candle Cards", "3 x 4 in, four per sheet. " + CARD.split(". ", 1)[1] + " Set one by a candle at the table. Use 03b, the ink-saver version, if your printer is low on ink."),
            ("04 Phone Post", "Made for phones: add a photo on a computer, save, then share it by text or on social media.")])

if __name__ == "__main__":
    out = HERE / "out" / NAME / f"00 Start Here - {NAME}.pdf"
    build(NAME, KIT, out); print("built", out)
    # preview boards (reuses the A Life preview helpers, with the sample photo in the phone post)
    import json
    src = (HERE / "alife_previews.py").read_text().split('L = "A Life/"')[0]
    g = {"__file__": str(HERE / "alife_previews.py")}; exec(src, g)
    g["OUT"] = HERE / "previews" / "forever"; g["OUT"].mkdir(parents=True, exist_ok=True)
    F = NAME + "/"
    r = g["render"]
    g["board"](1800, 1240, NAME, "Valentine's remembrance: table sign, love letters, candle cards and a post to share", [
        (r(F + "01 Table Sign 8x10 - Forever in My Heart (fill-in).pdf", 1, 620), 70, 250),
        (r(F + "02 Love Letter Cards - Forever in My Heart (fill-in).pdf", 1, 400), 740, 250),
        (r(F + "03 Candle Cards - Forever in My Heart (fill-in).pdf", 1, 300), 1190, 250),
        (r(F + "03b Candle Cards Ink-Saver - Forever in My Heart (fill-in).pdf", 1, 300), 1190, 690),
        (r(F + "04 Phone Post - Forever in My Heart (fill-in).pdf", 1, 230), 1530, 250),
    ], "forever-in-my-heart.jpg", note="Sample photo shown. Every word is editable in the free Adobe Acrobat Reader app.")
