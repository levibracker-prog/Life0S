// Setzt Theme, Akzentfarbe, Hintergrund, Dichte und Schriftgröße aus den
// Einstellungen auf das <html>-Element. Alles Visuelle läuft über CSS-Variablen.

import { SHEET_ALPHA } from '../config.js';
import {
  accentFor, contrast, paperColor, resolvePaper,
} from '../core/colors.js';

export { accentFor };

const darkQuery = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

export function resolveTheme(setting) {
  if (setting === 'system') return darkQuery?.matches ? 'dark' : 'light';
  return setting;
}

function luminanceOf(hex) {
  // contrast() gegen Schwarz und Weiß reicht, um Text-auf-Fläche zu wählen.
  return { white: contrast('#FFFFFF', hex), ink: contrast('#1C1B18', hex) };
}

// Weiß oder Tinte, je nachdem, was auf der Akzentfläche besser lesbar ist.
export function textOnAccent(color) {
  const { white, ink } = luminanceOf(color);
  return white >= ink ? '#FFFFFF' : '#1C1B18';
}

const PAPER_VARS = {
  paper: '--paper',
  raised: '--paper-raised',
  sunk: '--paper-sunk',
  line: '--line',
  lineStrong: '--line-strong',
};

// Papierfarbe, Muster und Foto. Gibt zurück, ob die gewählte Papierfarbe
// für die Lesbarkeit angepasst werden musste (für den Hinweis im Profil).
function applyBackground(settings, image, theme, accent) {
  const root = document.documentElement;
  const { background } = settings;
  const photo = background.usePhoto && image.dataUrl !== '';
  const chosen = theme === 'dark' ? background.paperDark : background.paperLight;
  const color = paperColor(chosen, theme);
  const result = resolvePaper(color, theme, { accent, pattern: background.pattern, photo });
  const isDefault = chosen === 'standard' && !result.adjusted;

  for (const [key, cssName] of Object.entries(PAPER_VARS)) {
    if (isDefault) root.style.removeProperty(cssName);
    else root.style.setProperty(cssName, result.set[key]);
  }
  root.dataset.pattern = background.pattern;
  root.style.setProperty('--sheet-mix', `${SHEET_ALPHA * 100}%`);
  root.style.setProperty('--photo-dim', String(background.dim / 100));
  setPhoto(photo ? image.dataUrl : '');
  return { adjusted: result.adjusted, readable: result.readable };
}

let backdrop;
let shownPhoto = '';

// Das Foto liegt auf einer festen Ebene hinter der App. Die Data-URL ist
// durch das Schema auf Base64-Zeichen beschränkt, deshalb ist sie in url("...") sicher.
function setPhoto(dataUrl) {
  const root = document.documentElement;
  if (dataUrl === shownPhoto) return;
  shownPhoto = dataUrl;
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.prepend(backdrop);
  }
  backdrop.style.backgroundImage = dataUrl ? `url("${dataUrl}")` : '';
  if (dataUrl) root.dataset.photo = 'on';
  else delete root.dataset.photo;
}

export function applyAppearance(settings, image) {
  const root = document.documentElement;
  const theme = resolveTheme(settings.theme);
  const accent = accentFor(settings.accent, theme);
  root.dataset.theme = theme;
  root.dataset.density = settings.density;
  root.style.setProperty('--font-scale', String(settings.fontScale));
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--on-accent', textOnAccent(accent));
  const report = applyBackground(settings, image, theme, accent);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', getComputedStyle(root).getPropertyValue('--paper').trim());
  return report;
}

// Liefert die Papierfarbe, die für die Einstellung tatsächlich gilt, und ob
// sie angepasst wurde. Das Profil zeigt damit den Lesbarkeits-Hinweis.
export function previewPaper(settings, image, theme) {
  const accent = accentFor(settings.accent, theme);
  const { background } = settings;
  const chosen = theme === 'dark' ? background.paperDark : background.paperLight;
  const photo = background.usePhoto && image.dataUrl !== '';
  return resolvePaper(paperColor(chosen, theme), theme, { accent, pattern: background.pattern, photo });
}

// Bei Einstellung "System" muss die App dem Wechsel des Geräts folgen.
export function watchSystemTheme(onChange) {
  darkQuery?.addEventListener('change', onChange);
}

