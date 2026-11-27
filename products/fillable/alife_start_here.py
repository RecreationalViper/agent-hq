"""Builds the Start Here guides for A Life and the A Life Tonight Kit. Usage: python3 products/fillable/alife_start_here.py"""
from pathlib import Path
from holiday_start_here import build, COMMON_START

HERE = Path(__file__).parent
CARD = "Page 2 prints four cards on one US Letter sheet. Type once and every copy updates. Cut on the grey marks."
PHOTO = "Photos: on a computer, open the file in Adobe Acrobat Reader and click the photo frame to choose a picture. Prefer no photo? The frame prints as a soft panel."
PROGRAM = "Print on US Letter, landscape, double-sided, flipping on the SHORT edge, at 100% / actual size. Fold in half to 5.5 x 8.5 in."

KITS = {
    "A Life": dict(ink="#161616", accent="#8E2F25", paper="#F7F3EC",
        lead="A memorial program made like a magazine: their photo on the cover, the service as the contents page and their story as the feature.",
        pieces=[("01 Program", PROGRAM + " The story fits about 1,200 characters. " + PHOTO),
                ("02 Welcome Sign", "Designed at 24 x 36 in for a print shop (Staples, Office Depot, FedEx Office)."),
                ("03 Memory Cards", CARD + ""),
                ("04 Bookmarks", "Four bookmarks per sheet, 2 x 7 in. Cardstock works best. Cut on the grey marks."),
                ("05 Thank-You Cards", CARD + " They fit A2 envelopes (4.375 x 5.75 in)."),
                ("06 Phone Announcement", "Made for phones: save it, then text or email it, or share a screenshot."),
                ("07 Guest Book Page", "Type the name once, then print as many pages as you need. Each page has room for 13 guests.")]),
    "A Life Tonight Kit": dict(ink="#161616", accent="#8E2F25", paper="#F7F3EC",
        lead="When the service is close and time is short: one program, one welcome sign and one memory card. Fill them in on your phone and print tonight on plain US Letter paper.",
        pieces=[("01 One-Page Program", "One sheet, one side, no folding. Print at 100% / actual size on US Letter. " + PHOTO),
                ("02 Welcome Sign 8 x 10", "Print page 2 on US Letter and trim at the grey marks, or ask a print shop for an 8 x 10 print of page 1. It fits a standard 8 x 10 frame."),
                ("03 Memory Cards", CARD)]),
}

if __name__ == "__main__":
    for name, c in KITS.items():
        out = HERE / "out" / name / f"00 Start Here - {name}.pdf"
        build(name, c, out); print("built", out)
