import json
import os
import shutil
import time

STATE = os.environ.get("XDG_STATE_HOME") or os.path.join(os.path.expanduser("~"), ".local", "state")
PATH = os.environ.get("ANTIALGORITHM_HISTORY") or os.path.join(STATE, "antialgorithm", "history.jsonl")
OLD_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "history.jsonl")
LIMIT = 300


def migrate():
    if not os.path.exists(PATH) and os.path.exists(OLD_PATH):
        os.makedirs(os.path.dirname(PATH), exist_ok=True)
        shutil.copyfile(OLD_PATH, PATH)


def load(kind=None):
    migrate()
    try:
        with open(PATH, encoding="utf-8") as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        return []
    out = []
    for line in lines:
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        if kind is None or entry.get("type") == kind:
            out.append(entry)
    return out


def add(entry):
    entry = {"date": time.strftime("%Y-%m-%d"), **entry}
    rows = load()[-(LIMIT - 1):] + [entry]
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    tmp = PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    os.replace(tmp, PATH)
