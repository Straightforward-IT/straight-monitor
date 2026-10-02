import { defineStore } from 'pinia';
import { useAuth } from '@/stores/auth';
import { accentColorValues, getAccentColor, normalizeAccentColor } from '@/utils/appearance';

const THEMES = new Set(['light', 'dark']);

function applyAppearance(theme, accentColor) {
  const root = document.documentElement;
  const accent = getAccentColor(accentColor, theme);

  root.setAttribute('data-theme', theme);
  root.setAttribute('data-accent', accent.value);
  root.style.setProperty('--primary', accent.color);
  root.style.setProperty('--primary-rgb', accent.rgb);
  root.style.setProperty('--primary-contrast', accent.onColor);
  root.style.setProperty('--primary-text', accent.textColor);
}

export const useTheme = defineStore('theme', {
  state: () => ({
    theme: 'light',
    accentColor: 'orange',
    inited: false,
  }),
  getters: {
    isDark: (s) => s.theme === 'dark',
  },
  actions: {
    init() {
      if (this.inited) return;
      const saved = localStorage.getItem('theme');
      const savedAccentColor = localStorage.getItem('accentColor');
      const sysDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
      this.theme = THEMES.has(saved) ? saved : (sysDark ? 'dark' : 'light');
      this.accentColor = normalizeAccentColor(savedAccentColor);
      applyAppearance(this.theme, this.accentColor);
      this.inited = true;
    },
    set(t) {
      if (!THEMES.has(t)) return;
      this.theme = t;
      localStorage.setItem('theme', t);
      applyAppearance(this.theme, this.accentColor);
      
      // Add transition class for smooth switching
      document.documentElement.classList.add('theme-transition');
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
      }, 300);
    },
    setAccentColor(accentColor) {
      if (!accentColorValues.has(accentColor)) return;
      this.accentColor = accentColor;
      localStorage.setItem('accentColor', accentColor);
      applyAppearance(this.theme, this.accentColor);
    },
    hydrateFromUser(user) {
      const savedTheme = user?.preferences?.appearance?.theme;
      const savedAccentColor = user?.preferences?.appearance?.accentColor;
      if (THEMES.has(savedTheme)) this.set(savedTheme);
      if (savedAccentColor !== undefined) {
        this.setAccentColor(normalizeAccentColor(savedAccentColor));
      }
    },
    async setForUser(t) {
      if (!THEMES.has(t)) return;
      const previousTheme = this.theme;
      this.set(t);
      try {
        await useAuth().updatePreferences({ appearance: { theme: t } });
      } catch (error) {
        this.set(previousTheme);
        throw error;
      }
    },
    async setAccentColorForUser(accentColor) {
      if (!accentColorValues.has(accentColor)) return;
      const previousAccentColor = this.accentColor;
      this.setAccentColor(accentColor);
      try {
        await useAuth().updatePreferences({ appearance: { accentColor } });
      } catch (error) {
        this.setAccentColor(previousAccentColor);
        throw error;
      }
    },
    toggle() { this.set(this.isDark ? 'light' : 'dark'); },
    async toggleForUser() { await this.setForUser(this.isDark ? 'light' : 'dark'); }
  }
});
