#!/usr/bin/env python3
"""
Generate diamond_rank_logo_slow.png
 - Canvas uses native logo size plus transparent safety padding, 180 frames @ 30 fps (6-second loop)
 - Slow, organically-timed shimmer (irrational speed ratios, gated bright flash)
 - Diamond texture clipped to Straightforward logo shape
 - Transparent background with an icy-blue semi-transparent glow halo
 - Saved with .png extension — valid APNG, animates in all APNG-capable renderers
"""

import math, os, io
import numpy as np
from PIL import Image, ImageFilter
from apng import APNG, PNG

# ── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOGO_PATH = os.path.join(PROJECT_ROOT, "frontend/Straight-Monitor/src/assets/straightforward-logo-black.png")
OUT_PATH  = os.path.join(PROJECT_ROOT, "diamond_rank_logo_slow.png")

# ── Config ────────────────────────────────────────────────────────────────
FRAMES    = 180          # 6-second seamless loop at 30 fps
FPS       = 30
GLOW_COLOR= np.array([125, 211, 252], dtype=np.float32) / 255.0   # #7dd3fc
GOLDEN    = 0.6180339887498949

# ── Load logo and place it on a padded transparent canvas ──────────────────
logo_src  = Image.open(LOGO_PATH).convert("RGBA")
SRC_W, SRC_H = logo_src.size   # 835 × 120
PAD = 12
W, H = SRC_W + PAD * 2, SRC_H + PAD * 2

# Spatial parameters scaled proportionally to canvas diagonal vs original 1920×1080
SPACING   = 30
STAR_R    = 5

logo_mask_full = Image.new("L", (W, H), 0)
logo_mask_full.paste(logo_src.split()[3], (PAD, PAD))

logo_mask_np = np.array(logo_mask_full, dtype=np.float32) / 255.0   # (H,W) 0–1
# Trim the weakest edge alpha so the source logo's soft antialias fringe does not
# read as a gray border once the bright texture and glow are composited.
logo_mask_np = np.clip((logo_mask_np - 0.18) / 0.82, 0.0, 1.0) ** 0.9

# ── Glow halo layers (blurred mask → icy halo around the letters) ─────────
glow_blur    = logo_mask_full.filter(ImageFilter.GaussianBlur(radius=9))
glow_np      = np.array(glow_blur, dtype=np.float32) / 255.0        # tight ring

glow_wide    = logo_mask_full.filter(ImageFilter.GaussianBlur(radius=23))
glow_wide_np = np.array(glow_wide, dtype=np.float32) / 255.0        # wide haze

# ── Diamond gradient helpers ──────────────────────────────────────────────
y_g, x_g = np.mgrid[0:H, 0:W].astype(np.float32)
y_edge_fade = np.minimum(y_g / PAD, (H - 1 - y_g) / PAD)
x_edge_fade = np.minimum(x_g / PAD, (W - 1 - x_g) / PAD)
edge_fade = np.clip(np.minimum(x_edge_fade, y_edge_fade), 0.0, 1.0).astype(np.float32)

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

def soft_line(d, spacing, half_w=1.4):
    dist = np.minimum(d % spacing, spacing - d % spacing)
    return np.clip(1.0 - (dist - half_w) / 0.8, 0.0, 1.0).astype(np.float32)

d1 = x_g + y_g
d2 = x_g - y_g + W
lattice   = np.maximum(soft_line(d1, SPACING), soft_line(d2, SPACING))
lattice   = (lattice * 0.20)[..., np.newaxis]
node_mask = (soft_line(d1, SPACING, 5.0) * soft_line(d2, SPACING, 5.0)).astype(np.float32)

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

cross_d = (W - 1 - x_g + y_g)

# ── Glow color canvas (pre-built, reused each frame for non-logo pixels) ──
glow_rgb_canvas = np.ones((H, W, 3), dtype=np.float32) * GLOW_COLOR

# ── Frame generation ──────────────────────────────────────────────────────
print(f"Generating {FRAMES} frames at {W}×{H}, {FPS} fps …")
png_frames = []

for fi in range(FRAMES):
    phase = fi / FRAMES
    # All periodic functions use INTEGER cycle counts so phase=0 == phase=1 exactly.
    # Traveling beams are sized to be strictly off-screen at both phase=0 and phase→1.

    img = base.copy()

    # ── S1: Wide brightness pulse — 2 full cycles per loop ────────────────
    # sin(phase*2π*2 - π/2): starts at −1 (dark), peaks twice, ends at −1 again ✓
    s1_pulse = (0.5 + 0.5 * math.sin(phase * 2 * math.pi * 2 - math.pi / 2)) ** 2
    img = img + (1.0 - img) * (s1_pulse * 0.60)

    # ── S2: Narrow bright traveling beam — 1 sweep per loop ───────────────
    # Canvas diag ≈ W+H = 955 px. σ=18 px → need 4σ=72 px off-screen margins.
    # Range: −72 to 955+72 = 1027. Speed = 1099/955 ≈ 1.15.
    # phase=0  → pos = −0.075*(955) = −72  (4σ left of canvas edge) ✓
    # phase→1  → pos ≈ 1.075*(955) = 1027  (72 px right of canvas edge, 4σ) ✓
    s2_pos = (phase * 1.15 - 0.075) * (W + H)
    s2     = np.exp(-((diag_px - s2_pos) / 18.0) ** 2)[..., np.newaxis].astype(np.float32)
    img    = img + (1.0 - img) * (s2 * 0.92)

    # ── S3: Prismatic color pulse — 1 full cycle per loop ─────────────────
    # Same sin formula (phase*2π - π/2) → 0 at start/end, peaks at phase=0.5 ✓
    prism_t = (0.5 + 0.5 * math.sin(phase * 2 * math.pi - math.pi / 2)) ** 2
    prism_c = np.array([0.85 + 0.15 * prism_t, 0.95, 1.00], dtype=np.float32)
    img = img + (prism_c - img) * (prism_t * 0.50)

    # ── Crystal lattice ────────────────────────────────────────────────────
    img = img + lattice * (1.0 - img)

    # ── Node glow — 1 full breath per loop ────────────────────────────────
    # sin(phase*2π - π/2): 0 at start/end, full at phase=0.5 ✓ (same envelope as S3,
    # but peaks coincide — that's intentional: the gem glows at its brightest together)
    node_pulse = (0.5 + 0.5 * math.sin(phase * 2 * math.pi - math.pi / 2)) ** 2
    img = img + (node_mask * node_pulse * 0.65)[..., np.newaxis] * (1.0 - img)

    # ── Sparkle stars — exponent 10 for more visible twinkles ─────────────
    # (phase + i*GOLDEN)%1 is periodic with period 1 in phase ✓
    for i, (sx, sy) in enumerate(sparkle_pts):
        sp_phase     = (phase + i * GOLDEN) % 1.0
        sp_intensity = max(0.0, math.cos(sp_phase * 2 * math.pi)) ** 10
        if sp_intensity < 0.01:
            continue
        x0, x1 = max(0, sx - STAR_R), min(W, sx + STAR_R + 1)
        y0, y1 = max(0, sy - STAR_R), min(H, sy + STAR_R + 1)
        kx0 = x0 - (sx - STAR_R); kx1 = star_kernel.shape[1] - ((sx + STAR_R + 1) - x1)
        ky0 = y0 - (sy - STAR_R); ky1 = star_kernel.shape[0] - ((sy + STAR_R + 1) - y1)
        k   = star_kernel[ky0:ky1, kx0:kx1, :] * sp_intensity
        img[y0:y1, x0:x1] = img[y0:y1, x0:x1] + (1.0 - img[y0:y1, x0:x1]) * k

    img = np.clip(img, 0.0, 1.0)

    # ── Compose RGBA: transparent background ─────────────────────────────
    # Glow pulse breathes with the loop (1 full cycle) ✓
    glow_pulse = 0.60 + 0.40 * math.sin(phase * 2 * math.pi - math.pi / 2)

    # Alpha: logo over halo over transparent, using proper "over" compositing.
    # Keep halo outside the logo so the edge stays soft without gray matting.
    tight_a    = glow_np * glow_pulse * 1.00
    wide_a     = glow_wide_np * glow_pulse * 0.65
    halo_alpha = (np.clip(np.maximum(tight_a, wide_a), 0.0, 1.0) ** 1.35) * edge_fade

    logo_alpha = logo_mask_np
    halo_only_alpha = halo_alpha * (1.0 - logo_alpha)
    canvas_alpha = np.clip(logo_alpha + halo_only_alpha, 0.0, 1.0)  # (H,W)

    # Build premultiplied contributions first, then convert back to straight alpha RGB
    # before writing the PNG. This avoids the gray fringe caused by storing premultiplied
    # colors in a straight-alpha image.
    logo_premul = img * logo_alpha[..., np.newaxis]
    halo_premul = glow_rgb_canvas * halo_only_alpha[..., np.newaxis]
    canvas_premul = logo_premul + halo_premul

    canvas_rgb = np.zeros_like(canvas_premul)
    nonzero_alpha = canvas_alpha > 1e-6
    canvas_rgb[nonzero_alpha] = (
        canvas_premul[nonzero_alpha] / canvas_alpha[nonzero_alpha, np.newaxis]
    )

    # Pack RGBA uint8
    rgb_u8   = (np.clip(canvas_rgb, 0.0, 1.0) * 255).astype(np.uint8)
    alpha_u8 = (canvas_alpha * 255).astype(np.uint8)
    rgba     = np.dstack([rgb_u8, alpha_u8])                                  # (H,W,4)

    pil_img = Image.fromarray(rgba, 'RGBA')

    buf = io.BytesIO()
    pil_img.save(buf, format='PNG', compress_level=2)
    buf.seek(0)
    png_frames.append(PNG.from_bytes(buf.read()))

    if (fi + 1) % 20 == 0 or fi == 0:
        print(f"  Frame {fi + 1}/{FRAMES}")

# ── Assemble APNG (written with .png extension — valid APNG) ──────────────
print(f"Assembling APNG → {OUT_PATH}")
anim = APNG()
for png in png_frames:
    anim.append(png, delay=1, delay_den=FPS)
anim.save(OUT_PATH)

size_mb = os.path.getsize(OUT_PATH) / 1_048_576
print(f"Done! {OUT_PATH}  ({size_mb:.1f} MB)")
