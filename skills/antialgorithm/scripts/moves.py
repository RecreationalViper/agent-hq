#!/usr/bin/env python3
import argparse
import sys

import history


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("action", nargs="?", default="show", choices=["show", "add"])
    ap.add_argument("text", nargs="*")
    ap.add_argument("--last", type=int, default=12)
    args = ap.parse_args()
    if args.action == "add":
        text = " ".join(args.text).strip()
        if not text:
            sys.exit("add needs the move, for example: moves.py add \"poster: x-ray method, deep blue ground\"")
        history.add({"type": "move", "move": text})
        print(f"saved: {text}")
        return
    rows = history.load("move")[-args.last:]
    if not rows:
        print("no moves saved yet")
        return
    for row in reversed(rows):
        print(f"{row.get('date', '?')}  {row['move']}")


if __name__ == "__main__":
    main()
