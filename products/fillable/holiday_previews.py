"""Renders a preview board per holiday collection from the real fill-in PDFs (sample text filled).
Usage: python3 holiday_previews.py  -> previews/<slug>-suite.png"""
import subprocess, tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).parent
FONT = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
BOARDS = {
    "Evergreen & Candlelight": ("evergreen", "#e6dccb", ["01 Table Sign", "02 Memory Cards -", "02b Memory", "03 Ornament Cards"]),
    "Longest Night": ("longest-night", "#d9dae6", ["01 Table Sign -", "01b Table", "02 Program", "03 Candle"]),
    "Harvest Table": ("harvest-table", "#e3d6bf", ["01 Empty", "02 Thankful", "03 Place"]),
}


def render(pdf, page, dpi):
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(["pdftoppm", "-r", str(dpi), "-f", str(page), "-l", str(page), "-png", str(pdf), f"{d}/p"], check=True)
        return Image.open(next(Path(d).glob("p*.png"))).convert("RGB")


def shadowed(board, im, x, y):
    sh = Image.new("RGBA", (im.width + 60, im.height + 60), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([30, 38, 30 + im.width, 38 + im.height], fill=(0, 0, 0, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(14))
    board.paste(sh, (x - 30, y - 30), sh); board.paste(im, (x, y))


for name, (slug, bg, keys) in BOARDS.items():
    files = sorted((HERE / "out" / name).glob("*.pdf"))
    pick = [next(f for f in files if f.name.startswith(k)) for k in keys]
    ims = []
    for f in pick:
        if "Program" in f.name:
            ims += [render(f, 1, 110)]
        elif "Place" in f.name or "Ornament" in f.name:
            ims += [render(f, 2, 110)]
        else:
            ims += [render(f, 1, 110)]
    H = 900
    ims = [im.resize((int(im.width * (H if i == 0 else 640) / im.height), H if i == 0 else 640)) for i, im in enumerate(ims)]
    Wd = 80 + sum(im.width + 50 for im in ims) + 30
    board = Image.new("RGB", (Wd, H + 260), bg)
    x = 80
    for i, im in enumerate(ims):
        shadowed(board, im, x, 70 if i == 0 else 70 + (H - 640) // 2); x += im.width + 50
    d = ImageDraw.Draw(board)
    d.text((80, H + 120), name, font=ImageFont.truetype(FONT, 64), fill="#2b2a27")
    d.text((82, H + 200), " · ".join(f.name.split(" - ")[0][3:] for f in pick), font=ImageFont.truetype(FONT, 30), fill="#55524c")
    out = HERE / "previews" / f"{slug}-suite.png"; out.parent.mkdir(exist_ok=True)
    board.save(out); print("saved", out, board.size)
