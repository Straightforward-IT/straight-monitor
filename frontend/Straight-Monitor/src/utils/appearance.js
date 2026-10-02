const DEFAULT_ACCENT_COLOR = 'orange';

// This is the single source of truth for user-selectable accent colours.  CSS
// reads the resolved values from the document root, while settings can render
// its labels and swatches from the same data.
export const accentColorOptions = Object.freeze([
  Object.freeze({
    value: 'orange',
    label: 'Legacy',
    color: '#eeaf67',
    rgb: '238, 175, 103',
    onColor: '#2a2118',
    textColor: '#eeaf67',
  }),
  Object.freeze({
    value: 'baby-blue',
    label: 'Baby Shark',
    color: '#5abfeb',
    rgb: '90, 191, 235',
    onColor: '#102a43',
    textColor: '#12607e',
  }),
  Object.freeze({
    value: 'pink',
    label: 'Barbie',
    color: '#f177aa',
    rgb: '241, 119, 170',
    onColor: '#3b0a22',
    textColor: '#a52659',
    darkTextColor: '#ff90ba',
  }),
  Object.freeze({
    value: 'ac-dc',
    label: 'AC/DC',
    color: '#000000',
    rgb: '0, 0, 0',
    onColor: '#ffffff',
    textColor: '#000000',
    darkColor: '#ffffff',
    darkRgb: '255, 255, 255',
    darkOnColor: '#1d1d1d',
  }),
]);

export const accentColorValues = new Set(accentColorOptions.map(({ value }) => value));

export function normalizeAccentColor(value) {
  return accentColorValues.has(value) ? value : DEFAULT_ACCENT_COLOR;
}

export function getAccentColor(value, theme = 'light') {
  const accent = accentColorOptions.find((option) => option.value === normalizeAccentColor(value));
  const useDarkVariant = theme === 'dark' && accent.darkColor;

  return {
    value: accent.value,
    color: useDarkVariant ? accent.darkColor : accent.color,
    rgb: useDarkVariant ? accent.darkRgb : accent.rgb,
    onColor: useDarkVariant ? accent.darkOnColor : accent.onColor,
    textColor: theme === 'dark' ? (accent.darkTextColor || accent.darkColor || accent.color) : accent.textColor,
  };
}
