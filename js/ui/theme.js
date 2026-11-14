// Setzt Verlauf, Papier, Schema (hell oder dunkel), Akzentfarbe, Dichte und
// Schriftgröße aus den Einstellungen auf das <html>-Element. Alles Visuelle
// läuft über CSS-Variablen; die Rechnung steht in core/appearance.js.

import { resolveAppearance } from '../core/appearance.js';
import { contrast } from '../core/colors.js';

// Weiß oder Tinte, je nachdem, was auf der Akzentfläche besser lesbar ist.
export function textOnAccent(color) {
  return contrast('#FFFFFF', color) >= contrast('#1C1B18', color) ? '#FFFFFF' : '#1C1B18';
}

const PAPER_VARS = {
  paper: '--paper',
  raised: '--paper-raised',
  sunk: '--paper-sunk',
  line: '--line',
  lineStrong: '--line-strong',
};

let backdrop;
let shown = '';
let lastAppearance = null;

// Die Hintergrundebene hinter der App. Die Data-URL eines Fotos ist durch das
// Schema auf Base64-Zeichen beschränkt und damit in url("...") sicher.
function setBackdrop(css, isPhoto) {
  const root = document.documentElement;
  if (css !== shown) {
    shown = css;
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.prepend(backdrop);
    }
    backdrop.style.background = isPhoto ? `url("${css}") center / cover` : css;
  }
  if (isPhoto) root.dataset.photo = 'on';
  else delete root.dataset.photo;
}

// Gibt das berechnete Erscheinungsbild zurück (Schema, Warnungen, Deckkraft).
export function applyAppearance(settings, image) {
  const root = document.documentElement;
  const { background } = settings;
  const photo = background.usePhoto && image.dataUrl !== '';
  const result = resolveAppearance(background, settings.accent, { photo });

  root.dataset.theme = result.scheme;
  root.dataset.density = settings.density;
  root.dataset.pattern = background.pattern;
  root.style.setProperty('--font-scale', String(settings.fontScale));
  root.style.setProperty('--accent', result.accent);
  root.style.setProperty('--on-accent', textOnAccent(result.accent));
  for (const [key, cssName] of Object.entries(PAPER_VARS)) {
    root.style.setProperty(cssName, result.surfaces[key]);
  }
  root.style.setProperty('--sheet-mix', `${Math.round(result.alpha * 100)}%`);
  root.style.setProperty('--photo-dim', String(background.dim / 100));
  setBackdrop(photo ? image.dataUrl : result.backdrop, photo);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', result.surfaces.paper);

  lastAppearance = result;
  return result;
}

// Das zuletzt angewendete Erscheinungsbild (für Profil und Vorschau).
export const currentAppearance = () => lastAppearance;
