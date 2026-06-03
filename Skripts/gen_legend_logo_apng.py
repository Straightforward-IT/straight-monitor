#!/usr/bin/env python3
"""
Generate legend_rank_logo.png
 - Transparent padded logo canvas
 - Straight-Legend fireworks burst clipped to the Straightforward logo shape
 - 18-second seamless loop matching the 1.8s spin / 2.0s pulse relationship
 - Golden halo constrained away from the outer border
 - Saved with .png extension — valid APNG
"""

import io
import math
import os

import numpy as np
from PIL import Image, ImageFilter
from apng import APNG, PNG

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOGO_PATH = os.path.join(PROJECT_ROOT, "frontend/Straight-Monitor/src/assets/straightforward-logo-black.png")
OUT_PATH = os.path.join(PROJECT_ROOT, "legend_rank_logo.png")

FRAMES = 360
FPS = 20
PAD = 12

BASE_COLOR = np.array([0x0D, 0x0D, 0x0D], dtype=np.float32) / 255.0
HALO_COLOR = np.array([255, 215, 0], dtype=np.float32) / 255.0

RAY_STOPS = [
    (2.0, 5.0, np.array([255, 215, 0], dtype=np.float32) / 255.0, 0.95),
    (29.0, 32.0, np.array([255, 150, 0], dtype=np.float32) / 255.0, 0.85),
    (59.0, 62.0, np.array([255, 255, 200], dtype=np.float32) / 255.0, 0.95),
    (89.0, 92.0, np.array([255, 80, 0], dtype=np.float32) / 255.0, 0.85),
    (119.0, 122.0, np.array([255, 215, 0], dtype=np.float32) / 255.0, 0.95),
    (149.0, 152.0, np.array([255, 200, 100], dtype=np.float32) / 255.0, 0.85),
    (179.0, 182.0, np.array([255, 255, 255], dtype=np.float32) / 255.0, 0.95),
    (209.0, 212.0, np.array([255, 100, 0], dtype=np.float32) / 255.0, 0.85),
    (239.0, 242.0, np.array([255, 215, 0], dtype=np.float32) / 255.0, 0.95),
    (269.0, 272.0, np.array([255, 150, 50], dtype=np.float32) / 255.0, 0.85),
    (299.0, 302.0, np.array([255, 255, 200], dtype=np.float32) / 255.0, 0.95),
    (329.0, 332.0, np.array([255, 80, 0], dtype=np.float32) / 255.0, 0.85),
]

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

y_g, x_g = np.mgrid[0:H, 0:W].astype(np.float32)
y_edge_fade = np.minimum(y_g / PAD, (H - 1 - y_g) / PAD)
x_edge_fade = np.minimum(x_g / PAD, (W - 1 - x_g) / PAD)
edge_fade = np.clip(np.minimum(x_edge_fade, y_edge_fade), 0.0, 1.0).astype(np.float32)

cx, cy = W / 2.0, H / 2.0
dx = x_g - cx
dy = y_g - cy
radius = np.sqrt(dx * dx + dy * dy)
theta_deg = (np.degrees(np.arctan2(dy, dx)) + 360.0) % 360.0

max_radius = math.sqrt(cx * cx + cy * cy)
radial_falloff = np.clip(1.0 - (radius / max_radius) ** 0.72, 0.0, 1.0).astype(np.float32)
burst_window = np.clip((radius / max_radius - 0.06) / 0.82, 0.0, 1.0).astype(np.float32)
burst_window = burst_window * (1.0 - np.clip((radius / max_radius - 0.92) / 0.08, 0.0, 1.0))
center_shadow = np.exp(-(((dx / (W * 0.28)) ** 2) + ((dy / (H * 0.40)) ** 2)) * 2.2).astype(np.float32)


def sector_mask(theta, start_deg, end_deg):
    start = start_deg % 360.0
    end = end_deg % 360.0
    if start <= end:
        return ((theta >= start) & (theta <= end)).astype(np.float32)
    return ((theta >= start) | (theta <= end)).astype(np.float32)


print(f"Generating {FRAMES} frames at {W}×{H}, {FPS} fps …")
png_frames = []

for fi in range(FRAMES):
    phase = fi / FRAMES
    img = np.ones((H, W, 3), dtype=np.float32) * BASE_COLOR

    spin_deg = phase * 360.0 * 10.0
    glow_pulse = (0.5 + 0.5 * math.sin(phase * 2 * math.pi * 9 - math.pi / 2)) ** 2

    firework = np.zeros_like(img)
    for start_deg, end_deg, color, alpha in RAY_STOPS:
        mask = sector_mask(theta_deg, start_deg + spin_deg, end_deg + spin_deg)
        ray_strength = mask * burst_window * (0.30 + 0.70 * radial_falloff)
        firework = firework + color[np.newaxis, np.newaxis, :] * ray_strength[..., np.newaxis] * alpha

    img = img + firework * 0.95

    ember1 = np.exp(-(((dx - W * 0.12) / (W * 0.14)) ** 2 + ((dy + H * 0.10) / (H * 0.22)) ** 2) * 3.0)
    ember2 = np.exp(-(((dx + W * 0.18) / (W * 0.16)) ** 2 + ((dy - H * 0.06) / (H * 0.24)) ** 2) * 3.0)
    gold_light = np.array([1.0, 0.88, 0.28], dtype=np.float32)
    img = img + gold_light[np.newaxis, np.newaxis, :] * (ember1[..., np.newaxis] * (0.10 + glow_pulse * 0.16))
    img = img + gold_light[np.newaxis, np.newaxis, :] * (ember2[..., np.newaxis] * (0.08 + glow_pulse * 0.12))
    img = img * (1.0 - center_shadow[..., np.newaxis] * 0.65)

    sparkle_angle = np.radians(spin_deg * 1.35)
    sparkle_line = np.exp(-(((dx * math.cos(sparkle_angle) + dy * math.sin(sparkle_angle)) / 150.0) ** 2))
    sparkle_band = np.exp(-(((radius - max_radius * 0.48) / 120.0) ** 2))
    img = img + (1.0 - img) * ((sparkle_line * sparkle_band * (0.08 + glow_pulse * 0.10))[..., np.newaxis])
    img = np.clip(img, 0.0, 1.0)

    tight_a = glow_np * (0.45 + glow_pulse * 0.55) * 0.95
    wide_a = glow_wide_np * (0.35 + glow_pulse * 0.45) * 0.60
    halo_alpha = (np.clip(np.maximum(tight_a, wide_a), 0.0, 1.0) ** 1.35) * edge_fade

    logo_alpha = logo_mask_np
    halo_only_alpha = halo_alpha * (1.0 - logo_alpha)
    canvas_alpha = np.clip(logo_alpha + halo_only_alpha, 0.0, 1.0)

    logo_premul = img * logo_alpha[..., np.newaxis]
    halo_color = np.array([
        1.0,
        0.78 + glow_pulse * 0.10,
        0.12 + glow_pulse * 0.06,
    ], dtype=np.float32)
    halo_premul = halo_color[np.newaxis, np.newaxis, :] * halo_only_alpha[..., np.newaxis]
    canvas_premul = logo_premul + halo_premul

    canvas_rgb = np.zeros_like(canvas_premul)
    nonzero_alpha = canvas_alpha > 1e-6
    canvas_rgb[nonzero_alpha] = canvas_premul[nonzero_alpha] / canvas_alpha[nonzero_alpha, np.newaxis]

    rgb_u8 = (np.clip(canvas_rgb, 0.0, 1.0) * 255).astype(np.uint8)
    alpha_u8 = (canvas_alpha * 255).astype(np.uint8)
    rgba = np.dstack([rgb_u8, alpha_u8])

    pil_img = Image.fromarray(rgba, "RGBA")
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG", compress_level=2)
    buf.seek(0)
    png_frames.append(PNG.from_bytes(buf.read()))

    if (fi + 1) % 30 == 0 or fi == 0:
        print(f"  Frame {fi + 1}/{FRAMES}")

print(f"Assembling APNG → {OUT_PATH}")
anim = APNG()
for png in png_frames:
    anim.append(png, delay=1, delay_den=FPS)
anim.save(OUT_PATH)

size_mb = os.path.getsize(OUT_PATH) / 1_048_576
print(f"Done! {OUT_PATH}  ({size_mb:.1f} MB)")