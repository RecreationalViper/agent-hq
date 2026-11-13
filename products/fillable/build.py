"""Builds the Forever Held fill-in PDFs.

Each product = a clean Canva background (sample text removed, exported as vector PDF to bg/)
plus typed form fields placed where the sample text was. Buyers type in the free Adobe Acrobat
Reader app (or most PDF apps), then print. Field positions come from the Canva layout in px
(Canva px * 0.75 = PDF points).

Usage: python3 products/fillable/build.py [out_dir]
"""
import copy, json, sys
from pathlib import Path
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import (ArrayObject, BooleanObject, DecodedStreamObject, DictionaryObject,
                           FloatObject, NameObject, NumberObject, TextStringObject)
from reportlab.pdfbase.pdfmetrics import stringWidth

HERE = Path(__file__).parent
PX = 0.75
FONTS = {"R": ("TiRo", "Times-Roman"), "I": ("TiIt", "Times-Italic"), "S": ("Helv", "Helvetica")}


def rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def font_dict(base):
    return DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"),
                             NameObject("/BaseFont"): NameObject("/" + base), NameObject("/Encoding"): NameObject("/WinAnsiEncoding")})


def pdf_str(s):
    b = s.encode("cp1252", "replace")
    return "(" + b.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)").decode("latin-1") + ")"


def wrap(text, base, size, width):
    lines = []
    for para in text.split("\n"):
        words, cur = para.split(" "), ""
        for w in words:
            t = (cur + " " + w).strip() if cur else w
            if stringWidth(t, base, size) <= width or not cur:
                cur = t
            else:
                lines.append(cur); cur = w
        lines.append(cur)
    return lines


class Builder:
    def __init__(self):
        self.w = PdfWriter()
        self.fields = {}  # name -> parent dict (indirect)
        self.font_refs = {k: self.w._add_object(font_dict(b)) for k, b in FONTS.values()}

    def add_bg_page(self, bg_page, size=None, placements=None):
        """Adds a page. placements: list of (scale, x, y) to tile the background (default: as-is)."""
        if size is None:
            size = (float(bg_page.mediabox.width), float(bg_page.mediabox.height))
        page = self.w.add_blank_page(width=size[0], height=size[1])
        for s, x, y in placements or [(1, 0, 0)]:
            page.merge_transformed_page(bg_page, Transformation().scale(s).translate(x, y))
        return page

    def appearance(self, f, w, h):
        key, base = FONTS[f["font"]]
        size = f["size"] * PX * f.get("scale", 1)
        r, g, b = rgb(f["color"])
        pad = 2
        text = f.get("value", "")
        lines = wrap(text, base, size, w - 2 * pad) if f.get("multiline") else [text]
        lead = size * f.get("lead", 1.25)
        ops = [f"/Tx BMC q BT /{key} {size:.2f} Tf {r:.3f} {g:.3f} {b:.3f} rg"]
        y = h - pad - size * 0.88 if f.get("multiline") else (h - size * 0.7) / 2
        for ln in lines:
            lw = stringWidth(ln, base, size)
            x = pad if f.get("align", 1) == 0 else (w - lw) / 2 if f.get("align", 1) == 1 else w - pad - lw
            ops.append(f"1 0 0 1 {x:.2f} {y:.2f} Tm {pdf_str(ln)} Tj")
            y -= lead
        ops.append("ET Q EMC")
        st = DecodedStreamObject()
        st.set_data("\n".join(ops).encode("latin-1"))
        st.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Form"),
                   NameObject("/BBox"): ArrayObject([FloatObject(0), FloatObject(0), FloatObject(w), FloatObject(h)]),
                   NameObject("/Resources"): DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/" + key): self.font_refs[key]})})})
        return self.w._add_object(st)

    def text_field(self, page, f, rect_pt, scale=1):
        """rect_pt = (x0, y0, x1, y1) in points. Same name on several pages = same value everywhere."""
        f = dict(f, scale=scale)
        key, _ = FONTS[f["font"]]
        r, g, b = rgb(f["color"])
        size = f["size"] * PX * scale
        parent = self.fields.get(f["name"])
        if parent is None:
            pd = DictionaryObject({
                NameObject("/FT"): NameObject("/Tx"), NameObject("/T"): TextStringObject(f["name"]),
                NameObject("/TU"): TextStringObject(f.get("tip", f["name"])),
                NameObject("/V"): TextStringObject(f.get("value", "")), NameObject("/DV"): TextStringObject(f.get("value", "")),
                NameObject("/Ff"): NumberObject(4096 if f.get("multiline") else 0),
                NameObject("/Q"): NumberObject(f.get("align", 1)),
                NameObject("/DA"): TextStringObject(f"/{key} {size:.2f} Tf {r:.3f} {g:.3f} {b:.3f} rg"),
                NameObject("/Kids"): ArrayObject()})
            parent = self.w._add_object(pd)
            self.fields[f["name"]] = parent
        x0, y0, x1, y1 = rect_pt
        widget = DictionaryObject({
            NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Widget"),
            NameObject("/Rect"): ArrayObject([FloatObject(v) for v in (x0, y0, x1, y1)]),
            NameObject("/F"): NumberObject(4), NameObject("/Parent"): parent,
            NameObject("/DA"): TextStringObject(f"/{key} {size:.2f} Tf {r:.3f} {g:.3f} {b:.3f} rg"),
            NameObject("/MK"): DictionaryObject(),
            NameObject("/AP"): DictionaryObject({NameObject("/N"): self.appearance(f, x1 - x0, y1 - y0)})})
        wref = self.w._add_object(widget)
        widget[NameObject("/P")] = page.indirect_reference
        parent.get_object()["/Kids"].append(wref)
        page.setdefault(NameObject("/Annots"), ArrayObject()).append(wref)

    def photo_button(self, page, name, rect_pt):
        empty = DecodedStreamObject(); empty.set_data(b"")
        x0, y0, x1, y1 = rect_pt
        empty.update({NameObject("/Type"): NameObject("/XObject"), NameObject("/Subtype"): NameObject("/Form"),
                      NameObject("/BBox"): ArrayObject([FloatObject(0), FloatObject(0), FloatObject(x1 - x0), FloatObject(y1 - y0)])})
        js = DictionaryObject({NameObject("/S"): NameObject("/JavaScript"), NameObject("/JS"): TextStringObject("event.target.buttonImportIcon();")})
        btn = DictionaryObject({
            NameObject("/Type"): NameObject("/Annot"), NameObject("/Subtype"): NameObject("/Widget"),
            NameObject("/FT"): NameObject("/Btn"), NameObject("/Ff"): NumberObject(65536), NameObject("/T"): TextStringObject(name),
            NameObject("/TU"): TextStringObject("Tap to add a photo (Adobe Acrobat Reader)"),
            NameObject("/Rect"): ArrayObject([FloatObject(v) for v in rect_pt]), NameObject("/F"): NumberObject(4),
            NameObject("/MK"): DictionaryObject({NameObject("/TP"): NumberObject(1), NameObject("/IF"): DictionaryObject({
                NameObject("/SW"): NameObject("/A"), NameObject("/S"): NameObject("/P"), NameObject("/FB"): BooleanObject(True)})}),
            NameObject("/A"): self.w._add_object(js), NameObject("/AP"): DictionaryObject({NameObject("/N"): self.w._add_object(empty)})})
        ref = self.w._add_object(btn)
        btn[NameObject("/P")] = page.indirect_reference
        self.fields[name] = ref
        page.setdefault(NameObject("/Annots"), ArrayObject()).append(ref)

    def save(self, path, title):
        dr = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/" + k): v for k, v in self.font_refs.items()})})
        self.w._root_object[NameObject("/AcroForm")] = DictionaryObject({
            NameObject("/Fields"): ArrayObject(list(self.fields.values())), NameObject("/DR"): dr,
            NameObject("/DA"): TextStringObject("/TiRo 12 Tf 0 g"), NameObject("/NeedAppearances"): BooleanObject(False)})
        self.w.add_metadata({"/Title": title, "/Author": "Forever Held"})
        with open(path, "wb") as fh:
            self.w.write(fh)


def px_rect(page_h_pt, left, top, width, height, scale=1, ox=0, oy=0):
    """Canva px box -> PDF rect in points (optionally scaled/offset for tiled copies)."""
    x0 = ox + left * PX * scale
    y1 = oy + (page_h_pt / scale - top * PX) * scale
    return (x0, y1 - height * PX * scale, x0 + width * PX * scale, y1)


def build(out_dir, only=None):
    spec = json.loads((HERE / "fields.json").read_text())
    if only:
        spec["products"] = [p for p in spec["products"] if any(p["file"].startswith(o) for o in only)]
    out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    made = []
    for prod in spec["products"]:
        bg = PdfReader(HERE / "bg" / prod["bg"])
        b = Builder()
        pages = []
        for i, bgp in enumerate(bg.pages):
            pages.append(b.add_bg_page(bgp))
        for f in prod["fields"]:
            page = pages[f.get("page", 1) - 1]
            h = float(page.mediabox.height)
            rect = px_rect(h, f["left"], f["top"], f["width"], f["height"])
            if f.get("type") == "photo":
                b.photo_button(page, f["name"], rect)
            else:
                b.text_field(page, f, rect)
        # Optional print sheet: several copies on one US Letter page, sharing the same fields.
        sheet = prod.get("sheet")
        if sheet:
            W, H = sheet["size"]
            s = sheet["scale"]
            cols, rows = sheet.get("cols", 2), sheet.get("rows", 2)
            bw, bh = float(bg.pages[0].mediabox.width) * s, float(bg.pages[0].mediabox.height) * s
            gx, gy = (W - cols * bw) / 2, (H - rows * bh) / 2
            spots = [(gx + c * bw, gy + r * bh) for r in reversed(range(rows)) for c in range(cols)]
            sp = b.add_bg_page(bg.pages[0], size=(W, H), placements=[(s, x, y) for x, y in spots])
            xs = [gx + i * bw for i in range(cols + 1)]
            ys = [gy + i * bh for i in range(rows + 1)]
            import io
            from reportlab.pdfgen import canvas as rl_canvas
            buf = io.BytesIO(); c = rl_canvas.Canvas(buf, pagesize=(W, H)); c.setStrokeColorRGB(.6, .6, .6); c.setLineWidth(.5)
            for x in xs:
                c.line(x, 0, x, gy - 6); c.line(x, H, x, H - gy + 6)
            for y in ys:
                c.line(0, y, gx - 6, y); c.line(W, y, W - gx + 6, y)
            c.save(); sp.merge_page(PdfReader(io.BytesIO(buf.getvalue())).pages[0])
            for x, y in spots:
                for f in prod["fields"]:
                    if f.get("page", 1) != 1 or f.get("type") == "photo":
                        continue
                    rect = px_rect(bh, f["left"], f["top"], f["width"], f["height"], scale=s, ox=x, oy=y)
                    b.text_field(sp, f, rect, scale=s)
        out = out_dir / prod["file"]; out.parent.mkdir(parents=True, exist_ok=True)
        b.save(out, prod["title"])
        made.append(str(out))
    return made


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--only=")]
    only = [a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--only=")]
    for p in build(args[0] if args else HERE / "out", only or None):
        print("built", p)
