#!/usr/bin/env python3
# Flatten `maestro hierarchy` JSON (stdin) to one line per element with text/id/bounds.
# Debug aid for authoring flows:  maestro hierarchy | python3 .maestro/hier.py
import json, sys
def walk(n, depth=0):
    a = n.get("attributes", {})
    t = a.get("text") or a.get("title") or a.get("accessibilityText") or ""
    rid = a.get("resource-id", "")
    if t or rid:
        print("  " * depth + "[%r] id=%r bounds=%s" % (t, rid, a.get("bounds")))
    for c in n.get("children", []):
        walk(c, depth + 1)
walk(json.load(sys.stdin))
