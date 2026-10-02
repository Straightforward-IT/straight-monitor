// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { accentColorOptions, getAccentColor } from '../src/utils/appearance';

const stylesheet = readFileSync(new URL('../src/assets/styles/theme.scss', import.meta.url), 'utf8');
const themeBlock = theme => theme === 'light'
    ? stylesheet.split('/* Dark */')[0]
    : stylesheet.split('[data-theme="dark"]')[1].split('}')[0];
const surfaces = theme => {
  return [...themeBlock(theme).matchAll(/--(?:bg|panel|tile-bg|surface|modal-bg|hover):\s*(#[a-f\d]+);/gi)]
    .map(match => rgb(match[1]));
};
function rgb(hex) {
  const digits = hex.slice(1);
  const expanded = digits.length === 3 ? [...digits].map(value => value + value).join('') : digits;
  return [0, 2, 4].map(index => parseInt(expanded.slice(index, index + 2), 16) / 255);
}
function luminance(color) {
  const [r, g, b] = color.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const mix = (foreground, background, opacity) => foreground.map((value, index) => value * opacity + background[index] * (1 - opacity));

describe.each(['light', 'dark'])('%s accent text contrast', theme => {
  it('keeps status messages readable on theme surfaces', () => {
    for (const token of ['status-danger-text', 'status-success-text', 'status-warning-text']) {
      const color = themeBlock(theme).match(new RegExp(`--${token}:\\s*(#[a-f\\d]+);`, 'i'))[1];
      for (const surface of surfaces(theme)) {
        expect(contrast(rgb(color), surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('keeps inventory warning and empty-stock text readable on tinted surfaces', () => {
    const root = themeBlock('light');
    const tokenColor = token => (themeBlock(theme).match(new RegExp(`--${token}:\\s*(#[a-f\\d]+);`, 'i'))
      || root.match(new RegExp(`--${token}:\\s*(#[a-f\\d]+);`, 'i')))[1];
    for (const [text, fill, opacity] of [
      ['status-warning-text', 'status-warning', 0.10],
      ['status-danger-text', 'action-danger', 0.09],
    ]) {
      for (const surface of surfaces(theme)) {
        expect(contrast(rgb(tokenColor(text)), mix(rgb(tokenColor(fill)), surface, opacity))).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it.each(accentColorOptions)('$value stays readable on theme surfaces and action hover states', option => {
    const accent = getAccentColor(option.value, theme);
    const fill = rgb(accent.color);
    expect(surfaces(theme)).toHaveLength(6);
    for (const surface of surfaces(theme)) {
      expect(contrast(rgb(accent.textColor), surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(accent.textColor), mix(fill, surface, 0.12))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(rgb(accent.onColor), fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(rgb(accent.onColor), mix(fill, rgb('#000'), 0.88))).toBeGreaterThanOrEqual(4.5);
  });
});
