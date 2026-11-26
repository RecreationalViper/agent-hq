"""Adds the fill-in fields for Golden Hour, Homegoing Grace and Rainbow Bridge to fields.json.
They reuse the Classic Elegance field layout (same geometry as suites.mjs), with each collection's colors
and its own sample text. Safe to re-run: it replaces earlier entries for these collections.
Usage: python3 products/fillable/suites_fields.py"""
import copy, json
from pathlib import Path

HERE = Path(__file__).parent
NAVY, GREY, GOLD, LIGHT, LIGHTGOLD = "#1f2d44", "#4a4a52", "#9c7a45", "#f3ede0", "#cdb88e"

SUITES = {
    "golden": {
        "name": "Golden Hour",
        "colors": {NAVY: "#3E2A1A", GREY: "#5A4636", GOLD: "#B5651D", LIGHT: "#FBF4E6", LIGHTGOLD: "#F2C14E"},
        "sign_dark": False, "first": "Margaret",
        "values": {
            "Name": "Margaret Anne Ellis", "Years": "1948  —  2026", "Full dates": "May 3, 1948  ·  November 2, 2026",
            "Subtitle": "TO THE CELEBRATION OF LIFE FOR", "Name line": "FOR MARGARET ANNE ELLIS",
            "Closing verse": "She filled every room with sunlight and every table with friends.",
            "In lieu of flowers": "IN LIEU OF FLOWERS, PLEASE PLANT SOMETHING THAT BLOOMS",
            "Service date and place": "SATURDAY, NOVEMBER 8, 2026 · 11:00 AM\nRIVERSIDE GARDEN PAVILION · FAIRVIEW",
            "Life story": "Margaret was born in the spring of 1948 and never stopped growing things: tomatoes, friendships and a family that now fills three long tables. She taught second grade for thirty-one years, kept a garden that fed half the street, and believed any day could be improved by pie. She is remembered for her laugh, her open door and the sunflowers she planted every single June.",
            "Gathering": "Celebration of Life",
            "Service details": "Saturday, November 8, 2026 · 11:00 AM\nRiverside Garden Pavilion\n200 River Road, Fairview",
            "Note": "Come as you are, wear something bright, and bring a story. A potluck lunch follows.",
            "Verse": "Do not stand at my grave and weep; I am in the morning light, the golden fields, the summer's sweep.",
            "Reception details": "Lunch on the lawn right after,\nRiverside Garden Pavilion\n200 River Road, Fairview",
            "Thank you note": "Thank you for coming to celebrate Margaret with us. She would have loved seeing all of you in one place, laughing.",
            "Signed": "With love and thanks,\nthe Ellis family",
        },
    },
    "grace": {
        "name": "Homegoing Grace",
        "colors": {NAVY: "#2E1A2B", GREY: "#4B3A47", GOLD: "#9A7638", LIGHT: "#F4EBDD", LIGHTGOLD: "#C9A45C"},
        "sign_dark": True, "first": "Dorothy",
        "values": {
            "Name": "Dorothy Mae Johnson", "Years": "1941  —  2026", "Full dates": "March 14, 1941  ·  November 9, 2026",
            "Subtitle": "TO THE HOMEGOING SERVICE FOR", "Name line": "FOR DOROTHY MAE JOHNSON",
            "Closing verse": "“I have fought a good fight, I have finished my course, I have kept the faith.” 2 Timothy 4:7",
            "In lieu of flowers": "IN LIEU OF FLOWERS, GIFTS MAY BE MADE TO THE GREATER HOPE CHURCH BUILDING FUND",
            "Service date and place": "SATURDAY, NOVEMBER 15, 2026 · 11:00 AM\nGREATER HOPE BAPTIST CHURCH · FAIRVIEW",
            "Life story": "Dorothy Mae was born March 14, 1941, the third of seven children. She gave her life to Christ at the age of twelve and served faithfully on the Mother's Board and in the choir for over fifty years. A devoted wife, mother of five and grandmother to many, she never met a stranger and never let anyone leave her kitchen hungry. Her faith, her laughter and her sweet potato pie will be remembered always.",
            "Gathering": "Homegoing Celebration",
            "Service details": "Saturday, November 15, 2026 · 11:00 AM\nGreater Hope Baptist Church\n410 Oak Street, Fairview",
            "Note": "Viewing from 10:00 AM. Repast to follow in the fellowship hall.",
            "Verse": "The Lord is my shepherd; I shall not want. He maketh me to lie down in green pastures: he leadeth me beside the still waters. Psalm 23",
            "Reception details": "Repast immediately following\nFellowship Hall, Greater Hope Baptist Church\n410 Oak Street, Fairview",
            "Service item 3 detail": "Rev. Samuel Hayes",
            "Service item 9 detail": "Rev. Samuel Hayes",
            "Service item 4 detail": "Psalm 23, read by Thomas Johnson",
            "Service item 6": "Obituary & Eulogy",
            "Service item 6 detail": "Rev. Samuel Hayes",
            "Service item 7": "Reflections",
            "Service item 7 detail": "Two minutes, please",
            "Service item 8": "Musical Selection",
            "Service item 8 detail": "Greater Hope Mass Choir",
            "Service item 1": "Processional",
            "Service item 1 detail": "Family and friends",
            "Signed": "With grateful hearts,\nthe Johnson family",
        },
    },
    "rainbow": {
        "name": "Rainbow Bridge",
        "colors": {NAVY: "#4B3B36", GREY: "#6A5A54", GOLD: "#B07A6A", LIGHT: "#4B3B36", LIGHTGOLD: "#B07A6A"},
        "sign_dark": False, "first": "Biscuit",
        "values": {
            "Name": "Biscuit", "Years": "2011  —  2026", "Full dates": "June 2011  ·  November 2026",
            "Subtitle": "TO A CELEBRATION OF", "Name line": "FOR BISCUIT",
            "Closing verse": "Until we meet again at the Rainbow Bridge.",
            "In lieu of flowers": "IN LIEU OF FLOWERS, PLEASE SUPPORT YOUR LOCAL ANIMAL SHELTER",
            "Service date and place": "SUNDAY, NOVEMBER 16, 2026 · 2:00 PM\nOUR BACKYARD · 12 MAPLE LANE",
            "Life story": "Biscuit came home in June 2011, a scruffy pup with one ear up and one ear down. For fifteen years he greeted every car in the driveway, stole exactly one sock a week, and never once let anyone eat a sandwich alone. He was a gentle shadow, a patient pillow and the best listener we ever knew. Our home is quieter now, but it is full of his love.",
            "Gathering": "A Little Goodbye",
            "Service details": "Sunday, November 16, 2026 · 2:00 PM\nIn our backyard\n12 Maple Lane, Fairview",
            "Note": "Bring a favorite story about Biscuit. Treats for the neighborhood dogs will be at the gate.",
            "Verse": "Just this side of heaven is a place called Rainbow Bridge, where our friends wait in warm green meadows until we meet again.",
            "Reception details": "Lemonade and treats after,\non the back porch",
            "Thank you note": "Thank you for loving Biscuit and for being here today. He was family, and so are you.",
            "Service item 1": "Welcome", "Service item 1 detail": "Sarah Parker",
            "Service item 2": "Biscuit's Story", "Service item 2 detail": "Emma, age 11",
            "Service item 3": "Favorite Memories", "Service item 3 detail": "Everyone is welcome to share",
            "Service item 4": "Reading", "Service item 4 detail": "\u201cThe Rainbow Bridge\u201d",
            "Service item 5": "Planting His Tree", "Service item 5 detail": "By the back gate",
            "Service item 6": "A Quiet Moment", "Service item 6 detail": "",
            "Service item 7": "Treats & Hugs", "Service item 7 detail": "For every dog in the yard",
            "Service item 8": "", "Service item 8 detail": "", "Service item 9": "", "Service item 9 detail": "", "Service item 10": "", "Service item 10 detail": "",
            "Signed": "With love and thanks,\nthe Parker family",
        },
    },
}


def main():
    path = HERE / "fields.json"
    data = json.loads(path.read_text())
    classic = [p for p in data["products"] if p["file"].startswith("Classic Elegance/")]
    names = {s["name"] for s in SUITES.values()}
    data["products"] = [p for p in data["products"] if p["file"].split("/")[0] not in names]
    for key, S in SUITES.items():
        for p in classic:
            q = copy.deepcopy(p)
            piece = p["bg"].replace("classic-", "").replace(".pdf", "")
            q["bg"] = f"{key}-{piece}.pdf"
            q["file"] = p["file"].replace("Classic Elegance", S["name"])
            q["title"] = p["title"].replace("Classic Elegance", S["name"])
            for f in q["fields"]:
                c = f.get("color")
                if piece == "sign" and S["sign_dark"] and c:
                    f["color"] = {NAVY: "#F4EBDD", GREY: "#E6D8C4", GOLD: "#C9A45C"}.get(c, c)
                elif c:
                    f["color"] = S["colors"].get(c, c)
                if f.get("type") == "photo" or "value" not in f:
                    continue
                if f["name"] in S["values"]:
                    f["value"] = S["values"][f["name"]]
                elif isinstance(f["value"], str):
                    f["value"] = f["value"].replace("Robert", S["first"]).replace("Whitmore", S["values"]["Signed"].split("the ")[-1].split(" family")[0])
            data["products"].append(q)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    print("fields.json:", sum(1 for p in data["products"] if p["file"].split("/")[0] in names), "new products")


if __name__ == "__main__":
    main()
