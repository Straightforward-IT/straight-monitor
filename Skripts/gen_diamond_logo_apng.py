#!/usr/bin/env python3
"""
Generate diamond_rank_logo.apng
 - 1920×1080, 16:9, 60 frames @ 30 fps (2-second loop)
 - Diamond Rank CSS gradient animation clipped to the Straightforward logo shape
 - Logo floats on a deep-dark background with an ambient icy-blue glow halo
"""

import math, os, io
import numpy as np
from PIL import Image, ImageFilter
from apng import APNG, PNG

# ── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOGO_PATH = os.path.join(PROJECT_ROOT, "frontend/Straight-Monitor/src/assets/straightforward-logo-black.png")
OUT_PATH  = os.path.join(PROJECT_ROOT, "diamond_rank_logo.apng")

# ── Config ────────────────────────────────────────────────────────────────
W, H      = 1920, 1080
FRAMES    = 60
FPS       = 30
LOGO_W    = int(W * 0.80)          # 80 % canvas width
BG_COLOR  = np.array([10, 10, 22], dtype=np.uint8)   # deep dark-navy
GLOW_COLOR= np.array([125, 211, 252], dtype=np.float32) / 255.0  # CSS #7dd3fc
SPACING   = 96
STAR_R    = 16
GOLDEN    = 0.6180339887498949

# ── Load & scale logo (use alpha as clipping mask) ────────────────────────
logo_src  = Image.open(LOGO_PATH).convert("RGBA")
logo_h    = int(logo_src.height * LOGO_W / logo_src.width)
logo_img  = logo_src.resize((LOGO_W, logo_h), Image.LANCZOS)

# Full-canvas alpha mask for the logo (0–255)
logo_mask_full = Image.new("L", (W, H), 0)
lx = (W - LOGO_W) // 2
ly = (H - logo_h) // 2
logo_mask_full.paste(logo_img.split()[3], (lx, ly))   # paste alpha channel

logo_mask_np = np.array(logo_mask_full, dtype=np.float32) / 255.0  # (H,W) 0–1

# ── Ambient glow: blur the mask → icy halo around the letters ─────────────
logo_mask_pil  = logo_mask_full
glow_blur      = logo_mask_pil.filter(ImageFilter.GaussianBlur(radius=28))
glow_np        = np.array(glow_blur, dtype=np.float32) / 255.0      # (H,W) 0–1
# Second, softer layer for a wide ambient haze
glow_wide      = logo_mask_pil.filter(ImageFilter.GaussianBlur(radius=72))
glow_wide_np   = np.array(glow_wide, dtype=np.float32) / 255.0

# ── Static background canvas (RGBA, premultiplied-style) ──────────────────
bg_rgb = np.full((H, W, 3), BG_COLOR, dtype=np.float32) / 255.0    # (H,W,3)

# ── Diamond gradient helpers (same as gen_diamond_apng.py) ───────────────
y_g, x_g = np.mgrid[0:H, 0:W].astype(np.float32)
diag_px   = x_g + y_g

STOPS_T = np.array([0.00, 0.40, 0.70, 1.00], dtype=np.float32)
STOPS_R = np.array([0xa8, 0x7d, 0xc7, 0xb2], dtype=np.float32) / 255.0
STOPS_G = np.array([0xed, 0xd3, 0xf2, 0xe8], dtype=np.float32) / 255.0
STOPS_B = np.array([0xff, 0xfc, 0xff, 0xff], dtype=np.float32) / 255.0

t_diag = diag_px / float(W + H - 1)
base   = np.stack([
    np.interp(t_diag, STOPS_T, STOPS_R),
    np.interp(t_diag, STOPS_T, STOPS_G),
    np.interp(t_diag, STOPS_T, STOPS_B),
], axis=-1).astype(np.float32)

# Lattice
def soft_line(d, spacing, half_w=1.4):
    dist = np.minimum(d % spacing, spacing - d % spacing)
    return np.clip(1.0 - (dist - half_w) / 0.8, 0.0, 1.0).astype(np.float32)

d1 = x_g + y_g
d2 = x_g - y_g + W
lattice   = np.maximum(soft_line(d1, SPACING), soft_line(d2, SPACING))
lattice   = (lattice * 0.20)[..., np.newaxis]
node_mask = (soft_line(d1, SPACING, 5.0) * soft_line(d2, SPACING, 5.0)).astype(np.float32)

# Sparkle star kernel
_dy = np.arange(-STAR_R, STAR_R + 1, dtype=np.float32)[:, np.newaxis]
_dx = np.arange(-STAR_R, STAR_R + 1, dtype=np.float32)[np.newaxis, :]
star_kernel = np.maximum(
    np.exp(-np.abs(_dy) * 0.75) * np.exp(-np.abs(_dx) * 3.8),
    np.exp(-np.abs(_dx) * 0.75) * np.exp(-np.abs(_dy) * 3.8),
).astype(np.float32)[..., np.newaxis]

half = SPACING // 2
sparkle_pts = [
    (sx, sy)
    for sy in range(half, H, SPACING)
    for sx in range(half, W, SPACING)
]

# Cross-diagonal for prismatic beam
cross_d = (W - 1 - x_g + y_g)

# ── Frame generation ──────────────────────────────────────────────────────
print(f"Generating {FRAMES} frames at {W}×{H} …")
png_frames = []

for fi in range(FRAMES):
    phase = fi / FRAMES

    # ---- Diamond texture (same animation as original) --------------------
    img = base.copy()

    s1_pos  = ((phase * 1.5) - 0.25) * (W + H)
    s1      = np.exp(-((diag_px - s1_pos) / 320.0) ** 2)[..., np.newaxis].astype(np.float32)
    img     = img + (1.0 - img) * (s1 * 0.42)

    s2_pos  = (((phase * 0.65) % 1.0) * 1.5 - 0.25) * (W + H)
    s2      = np.exp(-((diag_px - s2_pos) / 70.0) ** 2)[..., np.newaxis].astype(np.float32)
    img     = img + (1.0 - img) * (s2 * 0.70)

    s3_pos  = (((phase * 0.45 + 0.33) % 1.0) * 1.5 - 0.25) * (W + H)
    s3      = np.exp(-((cross_d - s3_pos) / 110.0) ** 2).astype(np.float32)
    prism   = 0.5 + 0.5 * math.sin(phase * 2 * math.pi)
    prism_c = np.array([0.85 + 0.15 * prism, 0.95, 1.00], dtype=np.float32)
    img     = img + (prism_c - img) * (s3[..., np.newaxis] * 0.30)

    img = img + lattice * (1.0 - img)

    node_pulse = (0.5 + 0.5 * math.sin(phase * 2 * math.pi * 2 - math.pi / 2)) ** 2
    img = img + (node_mask * node_pulse * 0.45)[..., np.newaxis] * (1.0 - img)

    for i, (sx, sy) in enumerate(sparkle_pts):
        sp_phase     = (phase + i * GOLDEN) % 1.0
        sp_intensity = max(0.0, math.cos(sp_phase * 2 * math.pi)) ** 8
        if sp_intensity < 0.01:
            continue
        x0, x1 = max(0, sx - STAR_R), min(W, sx + STAR_R + 1)
        y0, y1 = max(0, sy - STAR_R), min(H, sy + STAR_R + 1)
        kx0 = x0 - (sx - STAR_R); kx1 = star_kernel.shape[1] - ((sx + STAR_R + 1) - x1)
        ky0 = y0 - (sy - STAR_R); ky1 = star_kernel.shape[0] - ((sy + STAR_R + 1) - y1)
        k   = star_kernel[ky0:ky1, kx0:kx1, :] * sp_intensity
        img[y0:y1, x0:x1] = img[y0:y1, x0:x1] + (1.0 - img[y0:y1, x0:x1]) * k

    img = np.clip(img, 0.0, 1.0)

    # ---- Compose: background + glow halo + logo clip --------------------
    # Animated glow intensity (breathes with the node pulse)
    glow_pulse = 0.55 + 0.25 * math.sin(phase * 2 * math.pi)

    canvas = bg_rgb.copy()

    # Wide soft ambient haze (icy blue)
    haze_strength = glow_wide_np[..., np.newaxis] * GLOW_COLOR * glow_pulse * 0.35
    canvas = np.clip(canvas + haze_strength, 0.0, 1.0)

    # Tight bright glow ring
    tight_strength = glow_np[..., np.newaxis] * GLOW_COLOR * glow_pulse * 0.60
    canvas = np.clip(canvas + tight_strength, 0.0, 1.0)

    # Clip diamond texture into logo shape
    m = logo_mask_np[..., np.newaxis]            # (H,W,1) 0–1
    canvas = canvas * (1.0 - m) + img * m        # blend over background

    # ---- Convert to RGBA uint8 (background opaque, fully composited) ----
    canvas_u8  = (np.clip(canvas, 0.0, 1.0) * 255).astype(np.uint8)
    pil_img    = Image.fromarray(canvas_u8, 'RGB')

    buf = io.BytesIO()
    pil_img.save(buf, format='PNG', compress_level=2)
    buf.seek(0)
    png_frames.append(PNG.from_bytes(buf.read()))

    if (fi + 1) % 10 == 0 or fi == 0:
        print(f"  Frame {fi + 1}/{FRAMES}")

# ── Assemble APNG ─────────────────────────────────────────────────────────
print(f"Assembling APNG → {OUT_PATH}")
anim = APNG()
for png in png_frames:
    anim.append(png, delay=1, delay_den=FPS)
anim.save(OUT_PATH)

size_mb = os.path.getsize(OUT_PATH) / 1_048_576
print(f"Done! {OUT_PATH}  ({size_mb:.1f} MB)")
