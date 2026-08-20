import type { CSSProperties } from 'vue'
import type { ModalDockTheme } from './types'

const THEME_PROPERTIES = {
  accent: '--vmd-accent',
  accentContrast: '--vmd-accent-contrast',
  surface: '--vmd-surface',
  surfaceMuted: '--vmd-surface-muted',
  text: '--vmd-text',
  textMuted: '--vmd-text-muted',
  border: '--vmd-border',
  radius: '--vmd-radius',
  dockRadius: '--vmd-dock-radius',
  itemRadius: '--vmd-item-radius',
  controlRadius: '--vmd-control-radius',
  shadow: '--vmd-shadow',
  dockShadow: '--vmd-dock-shadow',
  controlShadow: '--vmd-control-shadow',
  fontFamily: '--vmd-font-family',
  fontSize: '--vmd-font-size',
  titleFontWeight: '--vmd-title-font-weight',
  zIndex: '--vmd-z-index',
  dockBottom: '--vmd-dock-bottom',
  dockBackground: '--vmd-dock-background',
  itemBackground: '--vmd-item-background',
  controlBackground: '--vmd-control-background',
  focusRing: '--vmd-focus-ring',
  backdropFilter: '--vmd-backdrop-filter',
} as const satisfies Record<keyof ModalDockTheme, `--vmd-${string}`>

type ModalDockThemeStyle = CSSProperties &
  Partial<Record<(typeof THEME_PROPERTIES)[keyof ModalDockTheme], string | number>>

/** Convert semantic package tokens into the CSS custom properties it consumes. */
export function createModalDockThemeStyle(
  ...themes: readonly (ModalDockTheme | undefined)[]
): ModalDockThemeStyle {
  const merged = Object.assign({}, ...themes.filter(Boolean)) as ModalDockTheme
  const style: Record<string, string | number> = {}

  for (const key of Object.keys(THEME_PROPERTIES) as (keyof ModalDockTheme)[]) {
    const value = merged[key]
    if (value !== undefined && value !== '') {
      style[THEME_PROPERTIES[key]] = value
    }
  }

  return style as ModalDockThemeStyle
}
