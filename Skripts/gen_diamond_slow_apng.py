#!/usr/bin/env python3
"""
Generate diamond_rank_slow.png — 6-second animated APNG (saved as .png) of the
Diamond Rank pattern with a slow, organic, irregularly-timed shimmer.

Key differences from gen_diamond_apng.py:
  - 6-second loop (180 frames @ 30 fps) instead of 2 s
  - Shimmers travel slower and at mutually irrational speed ratios so overlaps
    are non-repeating within the loop window
  - Shimmer 2 (narrow bright flash) is gated — fires only ~twice per loop
  - Node glow breathes once per loop instead of twice
  - Sparkle stars peak sharper in time → brief, sparse twinkles
"""

import math, os, io
import numpy as np
from PIL import Image
from apng import APNG, PNG

# ── Config ────────────────────────────────────────────────────────────────
W, H      = 1920, 1080
FRAMES    = 180          # 6-second seamless loop at 30 fps
FPS       = 30
SPACING   = 96
STAR_R    = 16
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUT_PATH  = os.path.join(PROJECT_ROOT, "diamond_rank_slow.png")

# ── CSS color stops ────────────────────────────────────────────────────────
STOPS_T = np.array([0.00, 0.40, 0.70, 1.00], dtype=np.float32)
STOPS_R = np.array([0xa8, 0x7d, 0xc7, 0xb2], dtype=np.float32) / 255.0
STOPS_G = np.array([0xed, 0xd3, 0xf2, 0xe8], dtype=np.float32) / 255.0
STOPS_B = np.array([0xff, 0xfc, 0xff, 0xff], dtype=np.float32) / 255.0

# ── Coordinate grids (computed once) ──────────────────────────────────────
y_g, x_g = np.mgrid[0:H, 0:W].astype(np.float32)
diag_px  = x_g + y_g
t_diag   = diag_px / float(W + H - 1)

# ── Static: base gradient ─────────────────────────────────────────────────
base = np.stack([
    np.interp(t_diag, STOPS_T, STOPS_R),
    np.interp(t_diag, STOPS_T, STOPS_G),
    np.interp(t_diag, STOPS_T, STOPS_B),
], axis=-1).astype(np.float32)

# ── Static: crystal diamond lattice ───────────────────────────────────────
def soft_line(d, spacing, half_w=1.4):
    dist = np.minimum(d % spacing, spacing - d % spacing)
    return np.clip(1.0 - (dist - half_w) / 0.8, 0.0, 1.0).astype(np.float32)

d1 = (x_g + y_g)
d2 = (x_g - y_g + W)
lattice   = np.maximum(soft_line(d1, SPACING), soft_line(d2, SPACING))
lattice   = (lattice * 0.20)[..., np.newaxis]

node_mask = (soft_line(d1, SPACING, 5.0) * soft_line(d2, SPACING, 5.0)).astype(np.float32)

# ── Static: vignette ──────────────────────────────────────────────────────
vx = ((x_g - W / 2.0) / (W / 2.0)) ** 2
vy = ((y_g - H / 2.0) / (H / 2.0)) ** 2
vignette = np.clip(1.0 - 0.40 * (vx + vy) / 2.0, 0.60, 1.0).astype(np.float32)[..., np.newaxis]

# ── Static: edge glow ─────────────────────────────────────────────────────
edge_dist = np.minimum(
    np.minimum(x_g, W - 1 - x_g) / 80.0,
    np.minimum(y_g, H - 1 - y_g) / 80.0
)
edge_glow_strength = np.clip(1.0 - edge_dist, 0.0, 1.0) ** 2 * 0.30
edge_glow = np.stack([
    edge_glow_strength * (125/255.0),
    edge_glow_strength * (211/255.0),
    edge_glow_strength * (252/255.0),
], axis=-1).astype(np.float32)

# ── Sparkle kernel ────────────────────────────────────────────────────────
_dy = np.arange(-STAR_R, STAR_R + 1, dtype=np.float32)[:, np.newaxis]
_dx = np.arange(-STAR_R, STAR_R + 1, dtype=np.float32)[np.newaxis, :]
star_kernel = np.maximum(
    np.exp(-np.abs(_dy) * 0.75) * np.exp(-np.abs(_dx) * 3.8),
    np.exp(-np.abs(_dx) * 0.75) * np.exp(-np.abs(_dy) * 3.8),
).astype(np.float32)[..., np.newaxis]

# ── Sparkle node positions ────────────────────────────────────────────────
half = SPACING // 2
sparkle_pts = [
    (sx, sy)
    for sy in range(half, H, SPACING)
    for sx in range(half, W, SPACING)
]
GOLDEN = 0.6180339887498949

# ── Frame generation ──────────────────────────────────────────────────────
print(f"Generating {FRAMES} frames at {W}×{H}, {FPS} fps …")
png_frames = []

for fi in range(FRAMES):
    phase = fi / FRAMES   # 0 → 1, seamless loop

    img = base.copy()

    # ── Shimmer 1: wide primary sweep — slow (0.6× per loop) ──────────────
    # Wider Gaussian (480 px) → gradual soft wash
    s1_pos  = ((phase * 0.6) - 0.15) * (W + H)
    s1_dist = diag_px - s1_pos
    s1      = np.exp(-(s1_dist / 480.0) ** 2)[..., np.newaxis].astype(np.float32)
    img     = img + (1.0 - img) * (s1 * 0.42)

    # ── Shimmer 2: narrow bright flash — gated, fires ~twice in 6 s ───────
    # Speed ratio 0.31 is irrational to S1 (0.6), so peaks never align the same.
    # Gate envelope: max(0, sin(phase * 2π * 1.7))^6 fires ~1-2× per loop and
    # fades cleanly so the flash appears suddenly rather than cycling visibly.
    s2_gate = max(0.0, math.sin(phase * 2 * math.pi * 1.7)) ** 6
    if s2_gate > 0.005:
        s2_pos  = (((phase * 0.31) % 1.0) * 1.5 - 0.25) * (W + H)
        s2_dist = diag_px - s2_pos
        s2      = np.exp(-(s2_dist / 70.0) ** 2)[..., np.newaxis].astype(np.float32)
        img     = img + (1.0 - img) * (s2 * 0.70 * s2_gate)

    # ── Shimmer 3: prismatic cross-beam — slow (0.19× per loop) ───────────
    # Speed ratio 0.19 is irrational to both S1 and S2.
    cross_d = (W - 1 - x_g + y_g)
    s3_pos  = (((phase * 0.19 + 0.33) % 1.0) * 1.5 - 0.25) * (W + H)
    s3_dist = cross_d - s3_pos
    s3      = np.exp(-(s3_dist / 180.0) ** 2).astype(np.float32)   # wider: 110→180
    prism_hue   = 0.5 + 0.5 * math.sin(phase * 2 * math.pi)
    prism_color = np.array([0.85 + 0.15 * prism_hue, 0.95, 1.00], dtype=np.float32)
    img = img + (prism_color - img) * (s3[..., np.newaxis] * 0.22)  # softer: 0.30→0.22

    # ── Crystal lattice ────────────────────────────────────────────────────
    img = img + lattice * (1.0 - img)

    # ── Global node glow — single lazy breath per loop ────────────────────
    # 0.67 cycles/loop ≈ one full inhale-exhale in ~1.5 loops → lazy pulse
    node_pulse = (0.5 + 0.5 * math.sin(phase * 2 * math.pi * 0.67 - math.pi / 2)) ** 2
    img        = img + (node_mask * node_pulse * 0.30)[..., np.newaxis] * (1.0 - img)

    # ── Per-node sparkle stars — sharp narrow peak, sparse flashes ─────────
    # Exponent 14 (was 8) → tiny time window at peak, most frames skip entirely
    for i, (sx, sy) in enumerate(sparkle_pts):
        sp_phase     = (phase + i * GOLDEN) % 1.0
        sp_intensity = max(0.0, math.cos(sp_phase * 2 * math.pi)) ** 14
        if sp_intensity < 0.01:
            continue

        x0, x1 = max(0, sx - STAR_R), min(W, sx + STAR_R + 1)
        y0, y1 = max(0, sy - STAR_R), min(H, sy + STAR_R + 1)
        kx0, kx1 = x0 - (sx - STAR_R), star_kernel.shape[1] - ((sx + STAR_R + 1) - x1)
        ky0, ky1 = y0 - (sy - STAR_R), star_kernel.shape[0] - ((sy + STAR_R + 1) - y1)

        k_patch = star_kernel[ky0:ky1, kx0:kx1, :] * sp_intensity
        img[y0:y1, x0:x1] = img[y0:y1, x0:x1] + (1.0 - img[y0:y1, x0:x1]) * k_patch

    # ── Edge glow ──────────────────────────────────────────────────────────
    img = img + edge_glow * (1.0 - img)

    # ── Vignette ───────────────────────────────────────────────────────────
    img = img * vignette

    # ── Convert & store ────────────────────────────────────────────────────
    img_u8  = (np.clip(img, 0.0, 1.0) * 255).astype(np.uint8)
    pil_img = Image.fromarray(img_u8, 'RGB')

    buf = io.BytesIO()
    pil_img.save(buf, format='PNG', compress_level=2)
    buf.seek(0)
    png_frames.append(PNG.from_bytes(buf.read()))

    if (fi + 1) % 20 == 0 or fi == 0:
        print(f"  Frame {fi + 1}/{FRAMES}")

# ── Assemble APNG (written with .png extension — fully valid PNG) ──────────
print(f"Assembling APNG → {OUT_PATH}")
anim = APNG()
for png in png_frames:
    anim.append(png, delay=1, delay_den=FPS)

anim.save(OUT_PATH)
size_mb = os.path.getsize(OUT_PATH) / 1_048_576
print(f"Done! {OUT_PATH}  ({size_mb:.1f} MB)")
