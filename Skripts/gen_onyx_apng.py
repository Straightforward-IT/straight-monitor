#!/usr/bin/env python3
"""
Generate onyx_rank.png — 6-second animated APNG (saved as .png) of the
Onyx rank background from PublicJobDetail.vue.

Matches the app styling:
  - 3 animated radial blooms over a dark purple linear gradient
  - 6-second seamless loop at 30 fps
  - 1920×1080 output
"""

import io
import math
import os

import numpy as np
from PIL import Image
from apng import APNG, PNG

# ── Config ────────────────────────────────────────────────────────────────
W, H = 1920, 1080
FRAMES = 180
FPS = 30
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUT_PATH = os.path.join(PROJECT_ROOT, "onyx_rank.png")

# ── Gradient colors from CSS ──────────────────────────────────────────────
LINEAR_STOPS_T = np.array([0.00, 0.40, 0.65, 1.00], dtype=np.float32)
LINEAR_STOPS_R = np.array([0x0D, 0x2E, 0x4A, 0x18], dtype=np.float32) / 255.0
LINEAR_STOPS_G = np.array([0x05, 0x0F, 0x1A, 0x0E], dtype=np.float32) / 255.0
LINEAR_STOPS_B = np.array([0x20, 0x6E, 0xAA, 0x40], dtype=np.float32) / 255.0

LAYER1_COLOR = np.array([216, 180, 254], dtype=np.float32) / 255.0
LAYER2_COLOR = np.array([167, 139, 250], dtype=np.float32) / 255.0
LAYER3_COLOR = np.array([255, 255, 255], dtype=np.float32) / 255.0

# ── Coordinates ───────────────────────────────────────────────────────────
y_g, x_g = np.mgrid[0:H, 0:W].astype(np.float32)
t_diag = (x_g + y_g) / float(W + H - 1)

base = np.stack([
    np.interp(t_diag, LINEAR_STOPS_T, LINEAR_STOPS_R),
    np.interp(t_diag, LINEAR_STOPS_T, LINEAR_STOPS_G),
    np.interp(t_diag, LINEAR_STOPS_T, LINEAR_STOPS_B),
], axis=-1).astype(np.float32)

# Subtle obsidian depth like polished stone.
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
    """CSS-like smooth easing inside each keyframe interval."""
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
    """Render one elliptical bloom in normalized canvas space."""
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

    # Gentle crystalline sheen to keep the surface alive without changing the 6 s pace.
    sheen = (0.5 + 0.5 * math.sin(phase * 2 * math.pi - math.pi / 2)) ** 2
    sheen_band = np.exp(-(((x_g - W * 0.52) * 0.8 + (y_g - H * 0.45) * 1.1) / 280.0) ** 2)
    sheen_color = np.array([0.92, 0.86, 1.0], dtype=np.float32)
    img = img + (sheen_color - img) * (sheen_band[..., np.newaxis] * sheen * 0.12)

    img = img * vignette

    img_u8 = (np.clip(img, 0.0, 1.0) * 255).astype(np.uint8)
    pil_img = Image.fromarray(img_u8, "RGB")

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