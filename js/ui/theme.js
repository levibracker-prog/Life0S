// Setzt Theme, Akzentfarbe, Dichte und Schriftgröße aus den Einstellungen
// auf das <html>-Element. Alles Visuelle läuft über CSS-Variablen.

import { ACCENTS } from '../config.js';

const darkQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

export function resolveTheme(setting) {
  if (setting === 'system') return darkQuery?.matches ? 'dark' : 'light';
  return setting;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function mixWithWhite(hex, share) {
  const rgb = hexToRgb(hex).map((c) => Math.round(c + (255 - c) * share));
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

// Eigene Farben gelten für beide Themes. Im dunklen wird sie aufgehellt,
// damit sie auf dunklem Papier lesbar bleibt.
export function accentFor(accent, theme) {
  const preset = ACCENTS.find((entry) => entry.id === accent);
  if (preset) return preset[theme];
  return theme === 'dark' ? mixWithWhite(accent, 0.3) : accent;
}

// Weiß oder Tinte, je nachdem, was auf der Akzentfläche besser lesbar ist.
export function textOnAccent(color) {
  const l = luminance(hexToRgb(color));
  const withWhite = 1.05 / (l + 0.05);
  const withInk = (l + 0.05) / 0.06;
  return withWhite >= withInk ? '#FFFFFF' : '#1C1B18';
}

export function applyAppearance(settings) {
  const root = document.documentElement;
  const theme = resolveTheme(settings.theme);
  const accent = accentFor(settings.accent, theme);
  root.dataset.theme = theme;
  root.dataset.density = settings.density;
  root.style.setProperty('--font-scale', String(settings.fontScale));
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--on-accent', textOnAccent(accent));
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', getComputedStyle(root).getPropertyValue('--paper').trim());
}

// Bei Einstellung "System" muss die App dem Wechsel des Geräts folgen.
export function watchSystemTheme(onChange) {
  darkQuery?.addEventListener('change', onChange);
}
