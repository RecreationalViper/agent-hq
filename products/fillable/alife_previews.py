"""Preview boards for A Life and the A Life Tonight Kit (filled with the sample family + sample photo).
Usage: python3 products/fillable/alife_previews.py   -> previews/a-life/*.jpg"""
import json, subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = Path(__file__).parent
OUT = HERE / "previews" / "a-life"
PHOTO = Image.open(OUT / "sample-photo.jpg").convert("RGB")
SPEC = {p["file"]: p for p in json.loads((HERE / "fields.json").read_text())["products"]}
SER = str(HERE / "fonts" / "CormorantGaramond.ttf"); SERI = str(HERE / "fonts" / "CormorantGaramond-Italic.ttf")
SANS = str(HERE / "fonts" / "Inter-SemiBold.otf"); SANSR = str(HERE / "fonts" / "Inter-Regular.otf")


def cover_crop(im, w, h):
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def render(file, page, width):
    """Page image of a built PDF at `width` px, with the sample photo in each photo frame."""
    spec = SPEC[file]
    bg = HERE / "bg" / spec["bg"]
    with tempfile.TemporaryDirectory() as td:
        from pypdf import PdfReader
        lw = float(PdfReader(bg).pages[0].mediabox.width) / 0.75
        k = width / lw
        subprocess.run(["pdftoppm", "-r", str(96 * k), "-f", str(page), "-l", str(page), "-png", "-singlefile",
                        str(HERE / "out" / file), f"{td}/p"], check=True, capture_output=True)
        im = Image.open(f"{td}/p.png").convert("RGB")
    for f in spec["fields"]:
        if f.get("type") == "photo" and f.get("page", 1) == page:
            x, y, w, h = (round(v * k) for v in (f["left"], f["top"], f["width"], f["height"]))
            im.paste(cover_crop(PHOTO, w, h), (x, y))
    return im


def shadowed(board, im, x, y):
    sh = Image.new("RGBA", (im.width + 80, im.height + 80), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((40, 48, im.width + 40, im.height + 48), fill=(40, 30, 20, 70))
    board.paste(sh.filter(ImageFilter.GaussianBlur(18)), (x - 40, y - 40), sh.filter(ImageFilter.GaussianBlur(18)))
    board.paste(im, (x, y))


def board(w, h, title, sub, items, out, note="Sample photo shown. Every word is editable in the free Adobe Acrobat Reader app."):
    b = Image.new("RGB", (w, h), "#E4DCCF")
    d = ImageDraw.Draw(b)
    d.text((70, 52), "FOREVER HELD", font=ImageFont.truetype(SANS, 20), fill="#8E2F25", spacing=0)
    d.text((66, 80), title, font=ImageFont.truetype(SERI, 76), fill="#161616")
    d.text((70, 178), sub, font=ImageFont.truetype(SANSR, 24), fill="#5F5850")
    for im, x, y in items:
        shadowed(b, im, x, y)
    d.text((70, h - 52), note, font=ImageFont.truetype(SANSR, 20), fill="#5F5850")
    b.save(OUT / out, quality=90)
    print("saved", OUT / out)


L = "A Life/"
board(1800, 1620, "A Life", "The magazine-style memorial suite: 7 matching fill-in pieces", [
    (render(L + "01 Program - A Life (fill-in).pdf", 1, 820), 70, 250),
    (render(L + "01 Program - A Life (fill-in).pdf", 2, 820), 70, 900),
    (render(L + "02 Welcome Sign - A Life (fill-in).pdf", 1, 400), 960, 250),
    (render(L + "06 Phone Announcement - A Life (fill-in).pdf", 1, 300), 1440, 250),
    (render(L + "03 Memory Card - A Life (fill-in).pdf", 1, 250), 960, 900),
    (render(L + "05 Thank-You Card - A Life (fill-in).pdf", 1, 250), 1240, 900),
    (render(L + "04 Bookmark - A Life (fill-in).pdf", 1, 100), 1530, 900),
    (render(L + "07 Guest Book Page - A Life (fill-in).pdf", 1, 230), 1240, 1250),
], "a-life-suite.jpg")

board(1800, 1180, "A Life · Program", "Folds to 5.5 x 8.5 in · cover, order of service, the story, a note of thanks", [
    (render(L + "01 Program - A Life (fill-in).pdf", 1, 800), 70, 250),
    (render(L + "01 Program - A Life (fill-in).pdf", 2, 800), 930, 250),
], "a-life-program.jpg")

T = "A Life Tonight Kit/"
board(1800, 1240, "Tonight Kit", "One program, one sign, one card. Fill in on your phone, print tonight on US Letter. $4.99", [
    (render(T + "01 One-Page Program - A Life (fill-in).pdf", 1, 720), 70, 250),
    (render(T + "02 Welcome Sign 8x10 - A Life (fill-in).pdf", 1, 640), 860, 250),
    (render(T + "03 Memory Card - A Life (fill-in).pdf", 1, 210), 1540, 250),
    (render(T + "03 Memory Card - A Life (fill-in).pdf", 2, 210), 1540, 560),
], "tonight-kit.jpg")
