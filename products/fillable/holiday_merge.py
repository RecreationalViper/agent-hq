"""Merges holiday-fields.json (written by holiday.mjs) into fields.json, replacing older copies of the same files."""
import json
from pathlib import Path
HERE = Path(__file__).parent
spec = json.loads((HERE / "fields.json").read_text())
new = json.loads((HERE / "holiday-fields.json").read_text())["products"]
names = {p["file"] for p in new}
cols = {p["file"].split("/")[0] for p in new}
spec["products"] = [p for p in spec["products"] if p["file"].split("/")[0] not in cols] + new
(HERE / "fields.json").write_text(json.dumps(spec, indent=1))
print("merged", len(new), "holiday products")
