// Aus den Hintergrund-Einstellungen (Verlauf, Papier, Muster, Foto) wird hier
// das fertige Erscheinungsbild berechnet: Schema hell oder dunkel, Papierflächen,
// Deckkraft und die Kontrastprüfung. Reine Funktionen ohne DOM, damit die App,
// die Vorschau, die Tests und tools/kontrast.mjs dieselbe Rechnung nutzen.

import {
  PAPERS, PATTERN_SHARE_BY_PATTERN, SHEET_ALPHA, STANDARD_PAPER,
} from '../config.js';
import {
  TEXT_TOKENS, accentFor, contrast, hexToHsl, hslToHex, luminance, mix,
} from './colors.js';

const REQUIRED = 4.5;
// Reserve gegen Rundung (Hex-Werte, Farbmischung im Browser). Gemessen lagen
// die Pixelwerte bis zu 1,3 % unter der Rechnung.
const SAFETY = 1.03;
// Ab dieser Helligkeit ist dunkle Schrift besser lesbar als helle
// (Kontrast zu Weiß und zu Schwarz ist gleich groß).
const LIGHT_SCHEME_LUMINANCE = 0.179;

// --- Verlauf ----------------------------------------------------------------

// CSS für den Hintergrund. Eine Farbe ergibt eine einfarbige Fläche.
export function gradientCss(gradient) {
  const { colors, type, angle } = gradient;
  if (colors.length === 1) return colors[0];
  const list = colors.join(', ');
  return type === 'radial'
    ? `radial-gradient(circle at 50% 40%, ${list})`
    : `linear-gradient(${angle}deg, ${list})`;
}

// Prüfpunkte: jede Farbe und die Mitte zwischen je zwei Farben.
export function gradientSamples(colors) {
  const samples = [...colors];
  for (let i = 0; i + 1 < colors.length; i += 1) samples.push(mix(colors[i], colors[i + 1], 0.5));
  return samples;
}

// Hell oder dunkel nach der mittleren Helligkeit aller Prüfpunkte.
export function schemeFor(colors) {
  const samples = gradientSamples(colors);
  const mean = samples.reduce((sum, color) => sum + luminance(color), 0) / samples.length;
  return mean > LIGHT_SCHEME_LUMINANCE ? 'light' : 'dark';
}

// --- Papier -----------------------------------------------------------------

export function paperColor(setting) {
  if (setting.startsWith('#')) return setting.toUpperCase();
  return (PAPERS.find((entry) => entry.id === setting) ?? PAPERS[0]).color;
}

// Bringt eine Tönung auf die Helligkeit des Schemas, Farbton bleibt erhalten.
export function tintFor(setting, scheme) {
  if (setting === 'standard') return STANDARD_PAPER[scheme];
  const { h, s, l } = hexToHsl(paperColor(setting));
  if (scheme === 'light') return hslToHex(h, Math.min(s, 0.7), Math.max(l, l >= 0.88 ? l : 0.94));
  return hslToHex(h, Math.min(s, 0.5), l <= 0.12 ? l : 0.09);
}

export function derivePaper(paper, scheme) {
  if (scheme === 'dark') {
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

// --- Kontrastprüfung --------------------------------------------------------

// Alle Paare (Text, Untergrund, Mindestwert). Das Papier liegt mit `alpha` über
// dem Hintergrund; dort wirkt der Hintergrund an jedem Prüfpunkt durch. Karten
// und Segmentflächen sind deckend. Muster verstärken die Tinte auf dem Papier.
function checkPairs({ set, scheme, accent, samples, pattern, alpha }) {
  const t = TEXT_TOKENS[scheme];
  const texts = [t.ink, t['ink-soft'], t.ok, t.bad, accent];
  const sheets = samples.map((back) => mix(back, set.paper, alpha));
  const patterned = pattern === 'plain' ? [] : sheets.map((s) => mix(s, t.ink, PATTERN_SHARE_BY_PATTERN[pattern]));
  const pairs = [];
  [...sheets, ...patterned].forEach((surface) => texts.forEach((text) => pairs.push([text, surface, REQUIRED])));
  texts.forEach((text) => pairs.push([text, set.raised, REQUIRED]));
  [t.ink, t['ink-soft']].forEach((text) => pairs.push([text, set.sunk, REQUIRED]));
  // Warnfarbe nur als Rand, nicht als Text: 3:1 genügt.
  pairs.push([t.warn, set.raised, 3]);
  return pairs;
}

function marginOf(context) {
  return Math.min(...checkPairs(context).map(([a, b, need]) => contrast(a, b) / need));
}

// Kleinster Kontrast von Schrift auf dem Papier an einem einzelnen Prüfpunkt
// (für die Anzeige pro Farbe).
function sampleRatio(context, back) {
  return Math.min(...checkPairs({ ...context, samples: [back] })
    .filter(([, , need]) => need === REQUIRED)
    .map(([a, b]) => contrast(a, b)));
}

// --- Gesamtergebnis ---------------------------------------------------------

// background: { gradient, paper, pattern, usePhoto, dim }, accent: Vorgabe oder #hex.
// photo: true, wenn ein Foto den Verlauf verdeckt (Prüfpunkte dann Schwarz und Weiß).
export function resolveAppearance(background, accentSetting, { photo = false } = {}) {
  const { gradient, pattern } = background;
  const scheme = schemeFor(gradient.colors);
  const accent = accentFor(accentSetting, scheme);
  const samples = photo ? ['#000000', '#FFFFFF'] : gradientSamples(gradient.colors);
  const target = scheme === 'dark' ? '#000000' : '#FFFFFF';
  const startTint = tintFor(background.paper, scheme);

  const baseContext = {
    set: derivePaper(startTint, scheme), scheme, accent, samples, pattern, alpha: SHEET_ALPHA,
  };
  const ratiosBefore = samples.map((color) => ({ color, ratio: sampleRatio(baseContext, color) }));

  // 1. Deckkraft erhöhen, 2. wenn das nicht reicht, das Papier selbst anpassen.
  let result = null;
  for (let tintStep = 0; tintStep <= 50 && !result; tintStep += 1) {
    const tint = tintStep === 0 ? startTint : mix(startTint, target, tintStep / 50);
    const set = derivePaper(tint, scheme);
    for (let alpha = SHEET_ALPHA; alpha <= 1.0001; alpha += 0.01) {
      const a = Math.min(1, Math.round(alpha * 100) / 100);
      const margin = marginOf({ set, scheme, accent, samples, pattern, alpha: a });
      if (margin >= SAFETY) {
        result = { set, alpha: a, tintAdjusted: tintStep > 0, margin };
        break;
      }
    }
  }
  const readable = result !== null;
  if (!readable) {
    const set = derivePaper(mix(startTint, target, 1), scheme);
    result = { set, alpha: 1, tintAdjusted: true, margin: marginOf({ set, scheme, accent, samples, pattern, alpha: 1 }) };
  }

  const finalContext = { set: result.set, scheme, accent, samples, pattern, alpha: result.alpha };
  const ratioAfter = Math.min(...checkPairs(finalContext).filter(([, , need]) => need === REQUIRED).map(([a, b]) => contrast(a, b)));
  const worstBefore = ratiosBefore.reduce((a, b) => (b.ratio < a.ratio ? b : a));
  const alphaRaised = result.alpha > SHEET_ALPHA + 0.001;
  return {
    scheme,
    accent,
    text: TEXT_TOKENS[scheme],
    surfaces: result.set,
    alpha: result.alpha,
    readable,
    // Warnung nur, wenn die Grenze von 4,5:1 ohne Korrektur unterschritten wäre.
    warning: worstBefore.ratio < REQUIRED,
    corrected: alphaRaised || result.tintAdjusted,
    alphaRaised,
    tintAdjusted: result.tintAdjusted,
    // Für die Warnung: so schlecht wäre es ohne Korrektur gewesen.
    worstBefore,
    samplesBefore: ratiosBefore,
    margin: result.margin,
    ratioAfter,
    backdrop: gradientCss(gradient),
  };
}

// Für die Vorschau: Farben, mit denen eine Mini-Seite gezeichnet wird.
export function previewColors(background, accentSetting) {
  const r = resolveAppearance(background, accentSetting);
  return {
    backdrop: r.backdrop,
    sheet: mix(gradientSamples(background.gradient.colors)[0], r.surfaces.paper, r.alpha),
    paper: r.surfaces.paper,
    raised: r.surfaces.raised,
    ink: r.text.ink,
    soft: r.text['ink-soft'],
    accent: r.accent,
    scheme: r.scheme,
  };
}

