#!/usr/bin/env python3
"""Drop hollow GSUB tables (zero coverage across all subtables) from woff2
subset files. Google's subsetter empties GSUB lookups but leaves the shell,
and Takumi's font loader rejects at least some such files outright (proven:
VT323 subsets rendered as fallback until the GSUB was dropped, while the
rest of the bytes were identical). An empty-coverage GSUB cannot affect
shaping in any engine, so removal is invisible to browsers.

Usage: python cli/strip-hollow-gsub.py [file ...]  (default: vt323-*.woff2)
Requires: fonttools, brotli.
"""
import glob
import os
import sys

from fontTools.ttLib import TTFont


def gsub_coverage_total(font: TTFont) -> int:
    if "GSUB" not in font:
        return -1
    total = 0
    for lookup in font["GSUB"].table.LookupList.Lookup:
        for st in lookup.SubTable:
            if getattr(st, "coverage", None) is not None:
                total += len(st.coverage.glyphs)
    return total


def main(files: list[str]) -> None:
    for pattern in files or ["input/fonts/vt323-*.woff2"]:
        for path in sorted(glob.glob(pattern)):
            font = TTFont(path)
            total = gsub_coverage_total(font)
            if total != 0:
                print(f"{os.path.basename(path)}: kept (GSUB coverage {total})")
                continue
            del font["GSUB"]
            font.flavor = "woff2"
            font.save(path)
            print(f"{os.path.basename(path)}: GSUB dropped ({os.path.getsize(path)} bytes)")


if __name__ == "__main__":
    main(sys.argv[1:])
