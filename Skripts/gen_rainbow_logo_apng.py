#!/usr/bin/env python3
"""
Generate rainbow_rank_logo.png
 - Transparent padded logo canvas
 - Rainbow rank animated gradient clipped to the Straightforward logo shape
 - 5-second seamless loop at 30 fps
 - Animated chromatic halo constrained away from the outer border
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
OUT_PATH = os.path.join(PROJECT_ROOT, "rainbow_rank_logo.png")

# ── Config ────────────────────────────────────────────────────────────────
FRAMES = 150
FPS = 30
PAD = 12

RAINBOW_COLORS = np.array([
    [0xFF, 0x00, 0x40],
    [0xFF, 0x6A, 0x00],
    [0xFF, 0xD0, 0x00],
    [0x00, 0xE6, 0x76],
    [0x00, 0xB0, 0xFF],
    [0xC0, 0x40, 0xFB],
    [0xFF, 0x00, 0x40],
], dtype=np.float32) / 255.0
RAINBOW_STOPS = np.linspace(0.0, 1.0, len(RAINBOW_COLORS), dtype=np.float32)

KEYFRAME_PCTS = np.array([0.0, 33.0, 66.0, 100.0], dtype=np.float32)
BG_POS = np.array([
    [0.0, 50.0],
    [60.0, 20.0],
    [100.0, 80.0],
    [0.0, 50.0],
], dtype=np.float32)
HUE_DEG = np.array([0.0, 90.0, 210.0, 360.0], dtype=np.float32)
BRIGHTNESS = np.array([1.10, 1.30, 1.15, 1.10], dtype=np.float32)

# ── Load logo and padded mask ─────────────────────────────────────────────
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

nx = x_g / max(W - 1, 1)
ny = y_g / max(H - 1, 1)


def ease_in_out(t):
    return 0.5 - 0.5 * np.cos(np.clip(t, 0.0, 1.0) * math.pi)


def interpolate_keyframes(phase, values):
    pct = phase * 100.0
    idx = np.searchsorted(KEYFRAME_PCTS, pct, side="right") - 1
    idx = max(0, min(idx, len(KEYFRAME_PCTS) - 2))
    start_pct = KEYFRAME_PCTS[idx]
    end_pct = KEYFRAME_PCTS[idx + 1]
    local_t = 0.0 if end_pct == start_pct else (pct - start_pct) / (end_pct - start_pct)
    eased_t = ease_in_out(local_t)
    return values[idx] * (1.0 - eased_t) + values[idx + 1] * eased_t


def sample_gradient(t):
    r = np.interp(t, RAINBOW_STOPS, RAINBOW_COLORS[:, 0])
    g = np.interp(t, RAINBOW_STOPS, RAINBOW_COLORS[:, 1])
    b = np.interp(t, RAINBOW_STOPS, RAINBOW_COLORS[:, 2])
    return np.stack([r, g, b], axis=-1).astype(np.float32)


def rgb_to_hsv(rgb):
    r = rgb[..., 0]
    g = rgb[..., 1]
    b = rgb[..., 2]

    maxc = np.max(rgb, axis=-1)
    minc = np.min(rgb, axis=-1)
    delta = maxc - minc

    hue = np.zeros_like(maxc)
    sat = np.where(maxc > 0.0, delta / np.maximum(maxc, 1e-6), 0.0)
    val = maxc

    mask = delta > 1e-6
    r_mask = mask & (maxc == r)
    g_mask = mask & (maxc == g)
    b_mask = mask & (maxc == b)

    hue[r_mask] = ((g[r_mask] - b[r_mask]) / delta[r_mask]) % 6.0
    hue[g_mask] = ((b[g_mask] - r[g_mask]) / delta[g_mask]) + 2.0
    hue[b_mask] = ((r[b_mask] - g[b_mask]) / delta[b_mask]) + 4.0
    hue = hue / 6.0
    return np.stack([hue, sat, val], axis=-1).astype(np.float32)


def hsv_to_rgb(hsv):
    h = hsv[..., 0] % 1.0
    s = np.clip(hsv[..., 1], 0.0, 1.0)
    v = np.clip(hsv[..., 2], 0.0, 1.5)

    i = np.floor(h * 6.0).astype(np.int32)
    f = h * 6.0 - i
    p = v * (1.0 - s)
    q = v * (1.0 - f * s)
    t = v * (1.0 - (1.0 - f) * s)
    i = i % 6

    out = np.zeros_like(hsv)
    conditions = [i == 0, i == 1, i == 2, i == 3, i == 4, i == 5]
    values = [
        np.stack([v, t, p], axis=-1),
        np.stack([q, v, p], axis=-1),
        np.stack([p, v, t], axis=-1),
        np.stack([p, q, v], axis=-1),
        np.stack([t, p, v], axis=-1),
        np.stack([v, p, q], axis=-1),
    ]
    for cond, val in zip(conditions, values):
        out[cond] = val[cond]
    return out.astype(np.float32)


print(f"Generating {FRAMES} frames at {W}×{H}, {FPS} fps …")
png_frames = []

for fi in range(FRAMES):
    phase = fi / FRAMES

    pos = interpolate_keyframes(phase, BG_POS)
    hue_deg = float(interpolate_keyframes(phase, HUE_DEG))
    brightness = float(interpolate_keyframes(phase, BRIGHTNESS))

    offset_x = pos[0] / 100.0
    offset_y = pos[1] / 100.0
    grad_t = (
        0.75
        - 0.90 * nx
        + 0.12 * ny
        + offset_x * 1.35
        - offset_y * 0.18
    )
    grad_t = np.mod(grad_t, 1.0).astype(np.float32)
    img = sample_gradient(grad_t)

    shine1 = np.exp(-(((x_g - W * 0.28) * 0.8 + (y_g - H * 0.24) * 1.5) / 260.0) ** 2)
    shine2 = np.exp(-(((x_g - W * 0.67) * 0.9 - (y_g - H * 0.72) * 1.3) / 220.0) ** 2)
    sweep = np.exp(-(((x_g - (phase * 1.20 - 0.10) * W) * 1.0 + (y_g - H * 0.52) * 0.25) / 180.0) ** 2)
    sparkle = (0.5 + 0.5 * math.sin(phase * 2 * math.pi * 2 - math.pi / 2)) ** 2

    img = img + (1.0 - img) * (shine1[..., np.newaxis] * 0.12)
    img = img + (1.0 - img) * (shine2[..., np.newaxis] * 0.10)
    img = img + (1.0 - img) * (sweep[..., np.newaxis] * sparkle * 0.18)

    hsv = rgb_to_hsv(np.clip(img, 0.0, 1.0))
    hsv[..., 0] = np.mod(hsv[..., 0] + hue_deg / 360.0, 1.0)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.08, 0.0, 1.0)
    hsv[..., 2] = np.clip(hsv[..., 2] * brightness, 0.0, 1.0)
    img = hsv_to_rgb(hsv)

    vx = ((x_g - W / 2.0) / (W / 2.0)) ** 2
    vy = ((y_g - H / 2.0) / (H / 2.0)) ** 2
    vignette = np.clip(1.0 - 0.18 * (vx + vy), 0.82, 1.0).astype(np.float32)[..., np.newaxis]
    img = np.clip(img * vignette, 0.0, 1.0)

    # Animated rainbow halo, kept away from the outer border.
    halo_color = sample_gradient(np.array([np.mod(phase + 0.08, 1.0)], dtype=np.float32))[0]
    glow_pulse = 0.58 + 0.42 * math.sin(phase * 2 * math.pi - math.pi / 2)
    tight_a = glow_np * glow_pulse * 0.95
    wide_a = glow_wide_np * glow_pulse * 0.58
    halo_alpha = (np.clip(np.maximum(tight_a, wide_a), 0.0, 1.0) ** 1.35) * edge_fade

    logo_alpha = logo_mask_np
    halo_only_alpha = halo_alpha * (1.0 - logo_alpha)
    canvas_alpha = np.clip(logo_alpha + halo_only_alpha, 0.0, 1.0)

    logo_premul = img * logo_alpha[..., np.newaxis]
    halo_premul = halo_color[np.newaxis, np.newaxis, :] * halo_only_alpha[..., np.newaxis]
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