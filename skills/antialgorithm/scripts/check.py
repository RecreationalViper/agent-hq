#!/usr/bin/env python3
import argparse
import copy
import os
import re
import shutil
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
SHAPES = {"rect", "circle", "ellipse", "line", "polyline", "polygon", "path", "image", "use"}
HOLDERS = {"defs", "clipPath", "mask", "pattern", "filter", "marker", "symbol"}


def tag(el):
    return el.tag.split("}")[-1]


def cairo_dir():
    if os.name != "nt":
        return None
    path = [d for d in os.environ.get("PATH", "").split(os.pathsep) if d]
    if any(os.path.isfile(os.path.join(d, "libcairo-2.dll")) for d in path):
        return None
    pf = os.environ.get("ProgramFiles", r"C:\Program Files")
    apps = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs")
    dirs = os.environ.get("CAIROCFFI_DLL_DIRECTORIES", "").split(";") + [
        r"C:\msys64\ucrt64\bin", r"C:\msys64\mingw64\bin",
        os.path.join(pf, "GTK3-Runtime Win64", "bin"), os.path.join(pf, "Inkscape", "bin"),
        os.path.join(pf, "Siril", "bin"), os.path.join(pf, "GIMP 3", "bin"),
        os.path.join(apps, "GIMP 3", "bin"), os.path.join(pf, "GIMP 2", "bin"),
        os.path.join(apps, "GIMP 2", "bin"),
    ]
    return next((d for d in dirs if d and os.path.isfile(os.path.join(d, "libcairo-2.dll"))), None)


def render(svg_path, png_path, width):
    if shutil.which("rsvg-convert"):
        subprocess.run(["rsvg-convert", "-w", str(width), svg_path, "-o", png_path], check=True, stderr=subprocess.DEVNULL)
        return
    found = cairo_dir()
    if found:
        os.environ["PATH"] = found + os.pathsep + os.environ.get("PATH", "")
    try:
        import cairosvg
    except (ImportError, OSError):
        sys.exit("needs rsvg-convert, or the cairosvg python package with a cairo library it can load")
    cairosvg.svg2png(url=svg_path, write_to=png_path, output_width=width)


def flat(png, bg):
    im = np.asarray(Image.open(png).convert("RGBA"), dtype=np.float32)
    a = im[:, :, 3:4] / 255
    return im[:, :, :3] * a + bg * (1 - a)


def size_of(root):
    vb = [float(n) for n in NUM.findall(root.get("viewBox", ""))]
    if len(vb) == 4:
        return vb
    w = float(NUM.search(root.get("width", "600")).group())
    h = float(NUM.search(root.get("height", "600")).group())
    return [0.0, 0.0, w, h]


def texts(root):
    out = []

    def walk(el, inside_holder):
        for c in el:
            t = tag(c)
            if t in HOLDERS:
                walk(c, True)
            elif t == "text" and not inside_holder:
                out.append(c)
            else:
                walk(c, inside_holder)

    walk(root, False)
    return out


def label(el):
    s = " ".join("".join(el.itertext()).split())
    return s[:40] if s else "(empty)"


def hide(el):
    st = el.get("style", "")
    el.set("style", (st + ";" if st else "") + "display:none")


def write(tree, path):
    tree.write(path, encoding="unicode")


CJK = re.compile(r"[\u3040-\u30ff\u3400-\u9fff\uff00-\uffef]")


def cjk_font_missing(root):
    """True when the SVG has Japanese text but fontconfig lists no Japanese font."""
    if not any(CJK.search("".join(el.itertext())) for el in root.iter() if tag(el) == "text"):
        return False
    if not shutil.which("fc-list"):
        return False
    out = subprocess.run(["fc-list", ":lang=ja", "family"], capture_output=True, text=True).stdout
    return not out.strip()


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("svg")
    ap.add_argument("--out", default=None)
    ap.add_argument("--width", type=int, default=800)
    ap.add_argument("--small", type=int, default=64)
    ap.add_argument("--min-text", type=float, default=1.2, help="smallest text height as a percent of the image side; about 0.6 for interfaces")
    args = ap.parse_args()

    name = os.path.splitext(os.path.basename(args.svg))[0]
    out = args.out or os.path.join(tempfile.gettempdir(), "antialgorithm_check", name)
    os.makedirs(out, exist_ok=True)
    tree = ET.parse(args.svg)
    root = tree.getroot()
    x0, y0, w, h = size_of(root)
    scale = args.width / w
    pad = 0.25 * max(w, h)

    full_png = os.path.join(out, "full.png")
    small_png = os.path.join(out, "small.png")
    render(args.svg, full_png, args.width)
    render(args.svg, small_png, args.small)
    full = flat(full_png, 255)
    clear = bool((np.asarray(Image.open(full_png).convert("RGBA"))[:, :, 3] < 250).any())
    full_dark = flat(full_png, 0) if clear else None

    parent = {c: p for p in root.iter() for c in p}

    def has_filter(el):
        return "filter" in el.attrib or "filter" in el.get("style", "")

    def filtered(el):
        while el is not None:
            if has_filter(el):
                return True
            el = parent.get(el)
        return False

    def ancestor_filtered(el):
        return filtered(parent.get(el))

    own_filter = [has_filter(t) for t in texts(root)]
    plain = None
    if any(own_filter):
        nf = copy.deepcopy(tree)
        for t in texts(nf.getroot()):
            t.attrib.pop("filter", None)
            st = t.get("style", "")
            if "filter" in st:
                t.set("style", re.sub(r"filter\s*:[^;]*;?", "", st))
        nf_svg = os.path.join(out, "_nofilter.svg")
        nf_png = os.path.join(out, "_nofilter.png")
        write(nf, nf_svg)
        render(nf_svg, nf_png, args.width)
        plain = flat(nf_png, 255)
        os.remove(nf_svg)
        os.remove(nf_png)

    problems = []
    if cjk_font_missing(root):
        problems.append("Japanese text found but no Japanese font is installed, so it may render as empty boxes (install Noto Sans CJK JP)")
    tmp = tempfile.mkdtemp()
    n = len(texts(root))
    for i in range(n):
        solo = copy.deepcopy(tree)
        sroot = solo.getroot()
        def strip(el):
            for c in el:
                if tag(c) in HOLDERS:
                    continue
                if tag(c) in SHAPES:
                    hide(c)
                if "filter" in c.attrib:
                    del c.attrib["filter"]
                st = c.get("style", "")
                if "filter" in st:
                    c.set("style", re.sub(r"filter\s*:[^;]*;?", "", st))
                strip(c)

        strip(sroot)
        for j, t in enumerate(texts(sroot)):
            if j != i:
                hide(t)
        sroot.set("viewBox", f"{x0 - pad} {y0 - pad} {w + 2 * pad} {h + 2 * pad}")
        sroot.set("width", str(w + 2 * pad))
        sroot.set("height", str(h + 2 * pad))
        sp = os.path.join(tmp, f"s{i}.svg")
        write(solo, sp)
        pp = os.path.join(tmp, f"s{i}.png")
        render(sp, pp, int(round((w + 2 * pad) * scale)))
        a = np.asarray(Image.open(pp).convert("RGBA"))[:, :, 3]
        ys, xs = np.nonzero(a > 40)
        name = label(texts(root)[i])
        if len(xs) == 0:
            problems.append(f"text '{name}': draws nothing")
            continue
        p = int(round(pad * scale))
        cw, ch = full.shape[1], full.shape[0]
        sides = []
        if xs.min() < p:
            sides.append("left")
        if xs.max() >= p + cw:
            sides.append("right")
        if ys.min() < p:
            sides.append("top")
        if ys.max() >= p + ch:
            sides.append("bottom")
        if sides:
            problems.append(f"text '{name}': runs off the {'/'.join(sides)} edge")
        lines = max(1, len(texts(root)[i].findall(f"{{{SVG_NS}}}tspan")))
        share = (ys.max() - ys.min() + 1) / scale / lines / max(w, h)
        if share * 100 < args.min_text and not sides:
            problems.append(f"text '{name}': very small, about {share * 100:.1f}% of the image side (want {args.min_text:g}%+)")

        rgba = np.asarray(Image.open(pp).convert("RGBA"), dtype=np.float32)
        inner = rgba[p:p + ch, p:p + cw]
        ih, iw = min(inner.shape[0], ch), min(inner.shape[1], cw)
        mask = np.zeros(full.shape[:2], bool)
        mask[:ih, :iw] = inner[:ih, :iw, 3] > 200
        if mask.sum() < 4:
            continue
        own = np.zeros_like(full)
        own[:ih, :iw] = inner[:ih, :iw, :3]
        base = plain if own_filter[i] and plain is not None else full
        cover = (np.abs(base - own).mean(axis=2)[mask] > 60).mean()
        ring = np.zeros_like(mask)
        r = max(2, int(3 * scale))
        for dy in (-r, 0, r):
            for dx in (-r, 0, r):
                ring |= np.roll(np.roll(mask, dy, 0), dx, 1)
        ring &= ~mask
        lum = lambda c: c @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
        contrast = 255
        if ring.any():
            contrast = max(abs(lum(img[mask]).mean() - lum(img[ring]).mean()) for img in (full, full_dark) if img is not None)
        if cover > 0.04 and not ancestor_filtered(texts(root)[i]):
            problems.append(f"text '{name}': {cover * 100:.0f}% covered or changed by something drawn over it")
        elif contrast < 30:
            problems.append(f"text '{name}': low contrast with what is behind it ({contrast:.0f}, want 30+)")
    shutil.rmtree(tmp, ignore_errors=True)

    print(f"render: {full_png}")
    print(f"small {args.small}px: {small_png}")
    print(f"texts checked: {n}")
    if clear:
        print("background has see-through parts; contrast was measured on white and on black, the better one counts")
    if problems:
        print("problems:")
        for pr in problems:
            print(f"  - {pr}")
        sys.exit(1)
    print("no text problems found. Now look at both renders yourself.")


if __name__ == "__main__":
    main()
