// Farbrechnung ohne DOM: Umrechnung, Mischen, Kontrast. Die Logik für
// Verlauf, Papier und Lesbarkeit steht in appearance.js.

import { ACCENTS } from '../config.js';

// Textfarben je Schema. Müssen mit css/style.css übereinstimmen,
// tools/kontrast.mjs vergleicht beides.
export const TEXT_TOKENS = {
  light: { ink: '#1C1B18', 'ink-soft': '#5E5A52', ok: '#37613A', warn: '#8A5F00', bad: '#A23131' },
  dark: { ink: '#F2EDE0', 'ink-soft': '#A39D8E', ok: '#86B98B', warn: '#E0AE4A', bad: '#E58282' },
};

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(rgb) {
  const clamp = (c) => Math.min(255, Math.max(0, Math.round(c)));
  return `#${rgb.map((c) => clamp(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// Nimmt "#1a2b3c", "1a2b3c", "#abc" und "abc" an und gibt "#1A2B3C" zurück,
// sonst null.
export function normalizeHex(text) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(text).trim());
  if (!match) return null;
  const digits = match[1].length === 3
    ? [...match[1]].map((c) => c + c).join('')
    : match[1];
  return `#${digits.toUpperCase()}`;
}

export function luminance(hex) {
  const lin = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Mischt a mit dem Anteil `share` (0..1) von b.
export function mix(a, b, share) {
  const [ra, rb] = [hexToRgb(a), hexToRgb(b)];
  return rgbToHex(ra.map((c, i) => c + (rb[i] - c) * share));
}

// h in Grad (0..360), s und v in 0..1.
export function hsvToHex(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return rgbToHex([f(5) * 255, f(3) * 255, f(1) * 255]);
}

export function hexToHsv(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: hexToHsv(hex).h, s, l };
}

export function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return rgbToHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

// Akzentfarbe für ein Schema. Vorgaben haben je einen Wert für hell und dunkel.
// Eine freie Farbe wird im dunklen Schema aufgehellt und in beiden so weit
// Richtung Schwarz (hell) oder Weiß (dunkel) gezogen, dass sie als Text auf
// dem Standardpapier mindestens 6:1 erreicht. Das lässt dem Papier Spielraum
// für Muster und Foto.
export function accentFor(accent, scheme) {
  const preset = ACCENTS.find((entry) => entry.id === accent);
  if (preset) return preset[scheme];
  const surface = scheme === 'dark' ? '#2A2822' : '#F5F1E8';
  const target = scheme === 'dark' ? '#FFFFFF' : '#000000';
  const start = scheme === 'dark' ? mix(accent, '#FFFFFF', 0.3) : accent.toUpperCase();
  for (let step = 0; step <= 50; step += 1) {
    const candidate = step === 0 ? start : mix(start, target, step / 50);
    if (contrast(candidate, surface) >= 6) return candidate;
  }
  return target;
}
