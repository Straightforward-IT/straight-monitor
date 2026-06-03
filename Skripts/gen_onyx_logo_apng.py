#!/usr/bin/env python3
"""
Generate onyx_rank_logo.png
 - Canvas uses native logo size plus transparent safety padding
 - Onyx rank layered blooms clipped to the Straightforward logo shape
 - 6-second seamless loop at 30 fps
 - Soft purple halo around the logo on transparent background
 - Saved with .png extension — valid APNG
"""

import io
import math
import os

import numpy as np
from PIL import Image, ImageFilter
from apng import APNG, PNG

# ── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOGO_PATH = os.path.join(PROJECT_ROOT, "frontend/Straight-Monitor/src/assets/straightforward-logo-black.png")
OUT_PATH = os.path.join(PROJECT_ROOT, "onyx_rank_logo.png")

# ── Config ────────────────────────────────────────────────────────────────
FRAMES = 180
FPS = 30
PAD = 12
HALO_COLOR = np.array([168, 139, 250], dtype=np.float32) / 255.0   # violet from CSS

# ── Load logo and place it on a padded transparent canvas ─────────────────
logo_src = Image.open(LOGO_PATH).convert("RGBA")
SRC_W, SRC_H = logo_src.size
W, H = SRC_W + PAD * 2, SRC_H + PAD * 2

logo_mask_full = Image.new("L", (W, H), 0)
logo_mask_full.paste(logo_src.split()[3], (PAD, PAD))

logo_mask_np = np.array(logo_mask_full, dtype=np.float32) / 255.0
logo_mask_np = np.clip((logo_mask_np - 0.18) / 0.82, 0.0, 1.0) ** 0.9

glow_blur = logo_mask_full.filter(ImageFilter.GaussianBlur(radius=9))
glow_np = np.array(glow_blur, dtype=np.float32) / 255.0

glow_wide = logo_mask_full.filter(ImageFilter.GaussianBlur(radius=23))
glow_wide_np = np.array(glow_wide, dtype=np.float32) / 255.0

# ── Onyx gradient colors from CSS ─────────────────────────────────────────
LINEAR_STOPS_T = np.array([0.00, 0.40, 0.65, 1.00], dtype=np.float32)
LINEAR_STOPS_R = np.array([0x0D, 0x2E, 0x4A, 0x18], dtype=np.float32) / 255.0
LINEAR_STOPS_G = np.array([0x05, 0x0F, 0x1A, 0x0E], dtype=np.float32) / 255.0
LINEAR_STOPS_B = np.array([0x20, 0x6E, 0xAA, 0x40], dtype=np.float32) / 255.0

LAYER1_COLOR = np.array([216, 180, 254], dtype=np.float32) / 255.0
LAYER2_COLOR = np.array([167, 139, 250], dtype=np.float32) / 255.0
LAYER3_COLOR = np.array([255, 255, 255], dtype=np.float32) / 255.0

# ── Coordinates ───────────────────────────────────────────────────────────
y_g, x_g = np.mgrid[0:H, 0:W].astype(np.float32)
y_edge_fade = np.minimum(y_g / PAD, (H - 1 - y_g) / PAD)
x_edge_fade = np.minimum(x_g / PAD, (W - 1 - x_g) / PAD)
edge_fade = np.clip(np.minimum(x_edge_fade, y_edge_fade), 0.0, 1.0).astype(np.float32)

t_diag = (x_g + y_g) / float(W + H - 1)

base = np.stack([
    np.interp(t_diag, LINEAR_STOPS_T, LINEAR_STOPS_R),
    np.interp(t_diag, LINEAR_STOPS_T, LINEAR_STOPS_G),
    np.interp(t_diag, LINEAR_STOPS_T, LINEAR_STOPS_B),
], axis=-1).astype(np.float32)

vx = ((x_g - W / 2.0) / (W / 2.0)) ** 2
vy = ((y_g - H / 2.0) / (H / 2.0)) ** 2
vignette = np.clip(1.0 - 0.22 * (vx + vy), 0.78, 1.0).astype(np.float32)[..., np.newaxis]

# ── Background-position keyframes from CSS ────────────────────────────────
KEYFRAME_PCTS = np.array([0.0, 20.0, 40.0, 60.0, 80.0, 100.0], dtype=np.float32)

LAYER1_POS = np.array([
    [0.0, 0.0],
    [80.0, 20.0],
    [60.0, 100.0],
    [20.0, 80.0],
    [10.0, 60.0],
    [0.0, 0.0],
], dtype=np.float32)

LAYER2_POS = np.array([
    [100.0, 100.0],
    [10.0, 80.0],
    [40.0, 10.0],
    [80.0, 60.0],
    [90.0, 40.0],
    [100.0, 100.0],
], dtype=np.float32)

LAYER3_POS = np.array([
    [50.0, 0.0],
    [60.0, 40.0],
    [40.0, 100.0],
    [60.0, 100.0],
    [30.0, 60.0],
    [50.0, 0.0],
], dtype=np.float32)


def ease_in_out(t):
    return 0.5 - 0.5 * np.cos(np.clip(t, 0.0, 1.0) * math.pi)


def interpolate_keyframes(phase, positions):
    pct = phase * 100.0
    idx = np.searchsorted(KEYFRAME_PCTS, pct, side="right") - 1
    idx = max(0, min(idx, len(KEYFRAME_PCTS) - 2))
    start_pct = KEYFRAME_PCTS[idx]
    end_pct = KEYFRAME_PCTS[idx + 1]
    local_t = 0.0 if end_pct == start_pct else (pct - start_pct) / (end_pct - start_pct)
    eased_t = ease_in_out(local_t)
    return positions[idx] * (1.0 - eased_t) + positions[idx + 1] * eased_t


def radial_layer(center_pct, radius_pct, color, alpha, softness):
    center_x = center_pct[0] / 100.0 * W
    center_y = center_pct[1] / 100.0 * H
    radius_x = radius_pct[0] / 100.0 * W
    radius_y = radius_pct[1] / 100.0 * H

    nx = (x_g - center_x) / max(radius_x, 1.0)
    ny = (y_g - center_y) / max(radius_y, 1.0)
    distance = np.sqrt(nx * nx + ny * ny)

    mask = np.clip(1.0 - distance / softness, 0.0, 1.0).astype(np.float32)
    mask = mask * mask * (3.0 - 2.0 * mask)
    return color[np.newaxis, np.newaxis, :] * (mask[..., np.newaxis] * alpha)


halo_rgb_canvas = np.ones((H, W, 3), dtype=np.float32) * HALO_COLOR

print(f"Generating {FRAMES} frames at {W}×{H}, {FPS} fps …")
png_frames = []

for fi in range(FRAMES):
    phase = fi / FRAMES
    img = base.copy()

    bloom1 = radial_layer(
        interpolate_keyframes(phase, LAYER1_POS),
        radius_pct=(60.0, 50.0),
        color=LAYER1_COLOR,
        alpha=0.55,
        softness=0.65,
    )
    bloom2 = radial_layer(
        interpolate_keyframes(phase, LAYER2_POS),
        radius_pct=(45.0, 65.0),
        color=LAYER2_COLOR,
        alpha=0.45,
        softness=0.60,
    )
    bloom3 = radial_layer(
        interpolate_keyframes(phase, LAYER3_POS),
        radius_pct=(35.0, 30.0),
        color=LAYER3_COLOR,
        alpha=0.28,
        softness=0.55,
    )

    img = img + bloom1 * (1.0 - img)
    img = img + bloom2 * (1.0 - img)
    img = img + bloom3 * (1.0 - img)

    sheen = (0.5 + 0.5 * math.sin(phase * 2 * math.pi - math.pi / 2)) ** 2
    sheen_band = np.exp(-(((x_g - W * 0.52) * 0.8 + (y_g - H * 0.45) * 1.1) / 280.0) ** 2)
    sheen_color = np.array([0.92, 0.86, 1.0], dtype=np.float32)
    img = img + (sheen_color - img) * (sheen_band[..., np.newaxis] * sheen * 0.12)

    img = np.clip(img * vignette, 0.0, 1.0)

    # Transparent logo composition with a constrained violet halo.
    glow_pulse = 0.58 + 0.42 * math.sin(phase * 2 * math.pi - math.pi / 2)
    tight_a = glow_np * glow_pulse * 0.90
    wide_a = glow_wide_np * glow_pulse * 0.55
    halo_alpha = (np.clip(np.maximum(tight_a, wide_a), 0.0, 1.0) ** 1.35) * edge_fade

    logo_alpha = logo_mask_np
    halo_only_alpha = halo_alpha * (1.0 - logo_alpha)
    canvas_alpha = np.clip(logo_alpha + halo_only_alpha, 0.0, 1.0)

    logo_premul = img * logo_alpha[..., np.newaxis]
    halo_premul = halo_rgb_canvas * halo_only_alpha[..., np.newaxis]
    canvas_premul = logo_premul + halo_premul

    canvas_rgb = np.zeros_like(canvas_premul)
    nonzero_alpha = canvas_alpha > 1e-6
    canvas_rgb[nonzero_alpha] = (
        canvas_premul[nonzero_alpha] / canvas_alpha[nonzero_alpha, np.newaxis]
    )

    rgb_u8 = (np.clip(canvas_rgb, 0.0, 1.0) * 255).astype(np.uint8)
    alpha_u8 = (canvas_alpha * 255).astype(np.uint8)
    rgba = np.dstack([rgb_u8, alpha_u8])

    pil_img = Image.fromarray(rgba, "RGBA")

    buf = io.BytesIO()
    pil_img.save(buf, format="PNG", compress_level=2)
    buf.seek(0)
    png_frames.append(PNG.from_bytes(buf.read()))

    if (fi + 1) % 20 == 0 or fi == 0:
        print(f"  Frame {fi + 1}/{FRAMES}")

print(f"Assembling APNG → {OUT_PATH}")
anim = APNG()
for png in png_frames:
    anim.append(png, delay=1, delay_den=FPS)

anim.save(OUT_PATH)
size_mb = os.path.getsize(OUT_PATH) / 1_048_576
print(f"Done! {OUT_PATH}  ({size_mb:.1f} MB)")