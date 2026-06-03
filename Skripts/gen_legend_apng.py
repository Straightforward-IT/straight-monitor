#!/usr/bin/env python3
"""
Generate legend_rank.png — animated APNG (saved as .png) for the
Straight-Legend tier from PublicJobDetail.vue.

Design notes:
  - dark background (#0d0d0d)
  - rotating conic fireworks burst in gold/orange/white
  - soft 2-second golden pulse like the CSS firework-glow timing
  - seamless loop: 18 seconds (LCM of 1.8s spin and 2.0s glow)
"""

import io
import math
import os

import numpy as np
from PIL import Image
from apng import APNG, PNG

W, H = 1920, 1080
FRAMES = 360
FPS = 20  # 18-second exact loop with acceptable smoothness
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
OUT_PATH = os.path.join(PROJECT_ROOT, "legend_rank.png")

BASE_COLOR = np.array([0x0D, 0x0D, 0x0D], dtype=np.float32) / 255.0

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

y_g, x_g = np.mgrid[0:H, 0:W].astype(np.float32)
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
edge_gold = np.clip(1.0 - np.minimum.reduce([
    x_g / 90.0,
    (W - 1 - x_g) / 90.0,
    y_g / 90.0,
    (H - 1 - y_g) / 90.0,
]), 0.0, 1.0) ** 2


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

    # Exact CSS-inspired timing: 10 spins in 18 s, 9 glow pulses in 18 s.
    spin_deg = phase * 360.0 * 10.0
    glow_pulse = (0.5 + 0.5 * math.sin(phase * 2 * math.pi * 9 - math.pi / 2)) ** 2

    firework = np.zeros_like(img)
    firework_alpha = np.zeros((H, W), dtype=np.float32)

    for start_deg, end_deg, color, alpha in RAY_STOPS:
        mask = sector_mask(theta_deg, start_deg + spin_deg, end_deg + spin_deg)
        ray_strength = mask * burst_window * (0.30 + 0.70 * radial_falloff)
        firework = firework + color[np.newaxis, np.newaxis, :] * ray_strength[..., np.newaxis] * alpha
        firework_alpha = np.maximum(firework_alpha, ray_strength * alpha)

    img = img + firework * 0.95

    # Gold pulse and embers to give it the tier's prestige feel.
    ember1 = np.exp(-(((dx - W * 0.12) / (W * 0.14)) ** 2 + ((dy + H * 0.10) / (H * 0.22)) ** 2) * 3.0)
    ember2 = np.exp(-(((dx + W * 0.18) / (W * 0.16)) ** 2 + ((dy - H * 0.06) / (H * 0.24)) ** 2) * 3.0)
    gold_light = np.array([1.0, 0.88, 0.28], dtype=np.float32)
    img = img + gold_light[np.newaxis, np.newaxis, :] * (ember1[..., np.newaxis] * (0.10 + glow_pulse * 0.16))
    img = img + gold_light[np.newaxis, np.newaxis, :] * (ember2[..., np.newaxis] * (0.08 + glow_pulse * 0.12))
    img = img + gold_light[np.newaxis, np.newaxis, :] * (edge_gold[..., np.newaxis] * (0.04 + glow_pulse * 0.08))

    # CSS ::after center shading translated into the image.
    img = img * (1.0 - center_shadow[..., np.newaxis] * 0.65)

    # A subtle sparkle ring riding on the spin so it doesn't feel static.
    sparkle_angle = np.radians(spin_deg * 1.35)
    sparkle_line = np.exp(-(((dx * math.cos(sparkle_angle) + dy * math.sin(sparkle_angle)) / 150.0) ** 2))
    sparkle_band = np.exp(-(((radius - max_radius * 0.48) / 120.0) ** 2))
    img = img + (1.0 - img) * ((sparkle_line * sparkle_band * (0.08 + glow_pulse * 0.10))[..., np.newaxis])

    img = np.clip(img, 0.0, 1.0)

    img_u8 = (img * 255).astype(np.uint8)
    pil_img = Image.fromarray(img_u8, "RGB")

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