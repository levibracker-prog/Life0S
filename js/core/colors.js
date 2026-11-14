// Farbrechnung und die Lesbarkeitsprüfung für Papierfarben. Reine Funktionen
// ohne DOM, damit tools/kontrast.mjs und die Tests dieselbe Logik nutzen
// wie die App.

import {
  ACCENTS, PAPERS, PATTERN_SHARE_BY_PATTERN, SHEET_ALPHA,
} from '../config.js';

// Textfarben je Theme. Müssen mit css/style.css übereinstimmen,
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
  return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
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

// Gibt die Papierfarbe zu einer Einstellung zurück: "standard", eine
// Vorgabe-ID oder eine freie Farbe (#rrggbb).
export function paperColor(setting, theme) {
  if (setting.startsWith('#')) return setting.toUpperCase();
  const preset = PAPERS[theme].find((entry) => entry.id === setting) ?? PAPERS[theme][0];
  return preset.color;
}

// Leitet aus der Papierfarbe alle Flächen und Linien ab. Die Faktoren sind
// so gewählt, dass die Standardfarben ungefähr die Werte aus style.css ergeben.
export function derivePaper(paper, theme) {
  if (theme === 'dark') {
    return {
      paper,
      raised: mix(paper, '#FFFFFF', 0.04),
      sunk: mix(paper, '#000000', 0.28),
      line: mix(paper, '#FFFFFF', 0.13),
      lineStrong: mix(paper, '#FFFFFF', 0.22),
    };
  }
  return {
    paper,
    raised: mix(paper, '#FFFFFF', 0.55),
    sunk: mix(paper, '#000000', 0.05),
    line: mix(paper, '#000000', 0.075),
    lineStrong: mix(paper, '#000000', 0.18),
  };
}

// Prüfpaare: (Untergrund, Textfarben). Nur das Papier selbst (Seitenfläche)
// kann ein Muster tragen oder als halbtransparentes Blatt über einem Foto
// liegen, im ungünstigsten Fall über Schwarz oder Weiß. Karten und Segment-
// flächen sind deckend und bleiben davon unberührt.
function checkPairs(set, theme, accent, { pattern, photo }) {
  const t = TEXT_TOKENS[theme];
  const pageTexts = [t.ink, t['ink-soft'], t.ok, t.bad, accent];
  const pageSurfaces = photo
    ? ['#000000', '#FFFFFF'].map((back) => mix(set.paper, back, 1 - SHEET_ALPHA))
    : [set.paper];
  const patterned = pattern === 'plain' ? [] : pageSurfaces.map((s) => mix(s, t.ink, PATTERN_SHARE_BY_PATTERN[pattern]));
  const pairs = [...pageSurfaces, ...patterned].flatMap((surface) => pageTexts.map((text) => [text, surface, 4.5]));
  for (const text of [t.ink, t['ink-soft'], t.ok, t.bad, accent]) pairs.push([text, set.raised, 4.5]);
  for (const text of [t.ink, t['ink-soft']]) pairs.push([text, set.sunk, 4.5]);
  // Warnfarbe wird nur als Rand genutzt, nicht als Text: 3:1 genügt.
  pairs.push([t.warn, set.raised, 3]);
  return pairs;
}

// Kleinster Abstand zur jeweiligen Grenze (>= 1 heißt: alles erfüllt).
export function minMargin(set, theme, accent, options) {
  return Math.min(...checkPairs(set, theme, accent, options).map(([a, b, need]) => contrast(a, b) / need));
}

// Holt die Papierfarbe, falls nötig, schrittweise Richtung Weiß (hell) oder
// Schwarz (dunkel), bis alles lesbar ist. Liefert die abgeleiteten Farben,
// ob angepasst wurde und ob die Lesbarkeit am Ende erreicht ist.
// Reserve gegen Rundung (Hex-Werte, Farbmischung im Browser): Gemessen lagen
// die Pixelwerte bis zu 1,3 % unter der Rechnung.
const SAFETY = 1.03;

export function resolvePaper(color, theme, { accent, pattern = 'plain', photo = false }) {
  const target = theme === 'dark' ? '#000000' : '#FFFFFF';
  let result;
  for (let step = 0; step <= 50; step += 1) {
    const candidate = step === 0 ? color : mix(color, target, step / 50);
    const set = derivePaper(candidate, theme);
    const margin = minMargin(set, theme, accent, { pattern, photo });
    result = { set, adjusted: step > 0, readable: margin >= SAFETY, margin };
    if (result.readable) return result;
  }
  return result;
}

// Akzentfarbe für ein Theme. Vorgaben haben je einen Wert für hell und dunkel.
// Eine freie Farbe wird im dunklen Theme aufgehellt und in beiden so weit
// Richtung Schwarz (hell) oder Weiß (dunkel) gezogen, dass sie als Text auf
// dem Standardpapier mindestens 6:1 erreicht. Das lässt dem Papier Spielraum
// für Muster und Foto.
export function accentFor(accent, theme) {
  const preset = ACCENTS.find((entry) => entry.id === accent);
  if (preset) return preset[theme];
  const surface = theme === 'dark' ? '#2A2822' : '#F5F1E8';
  const target = theme === 'dark' ? '#FFFFFF' : '#000000';
  const start = theme === 'dark' ? mix(accent, '#FFFFFF', 0.3) : accent.toUpperCase();
  for (let step = 0; step <= 50; step += 1) {
    const candidate = step === 0 ? start : mix(start, target, step / 50);
    if (contrast(candidate, surface) >= 6) return candidate;
  }
  return target;
}
