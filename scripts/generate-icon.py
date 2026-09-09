#!/usr/bin/env python3
"""Flatten assets/images/logo.png onto the navy brand field as a 1024 RGB App Store icon."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/images/logo.png"
DEST = ROOT / "assets/images/icon.png"
NAVY = (6, 14, 30, 255)

src = Image.open(SRC).convert("RGBA").resize((1024, 1024), Image.Resampling.LANCZOS)
bg = Image.new("RGBA", (1024, 1024), NAVY)
bg.alpha_composite(src)
bg.convert("RGB").save(DEST, "PNG")
print(f"wrote {DEST}")
