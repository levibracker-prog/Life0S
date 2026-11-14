// Misst Kontraste der Design-Tokens aus css/style.css und der
// Akzentvorgaben aus js/config.js. Ziel: mindestens 4,5:1 für Text.
// Aufruf: npm run kontrast

import { readFileSync } from 'node:fs';
import {
  ACCENTS, PAPERS, PATTERNS, PATTERN_SHARE, SHEET_ALPHA,
} from '../js/config.js';
import {
  TEXT_TOKENS, accentFor, contrast, resolvePaper,
} from '../js/core/colors.js';
import { textOnAccent } from '../js/ui/theme.js';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');

function tokens(selector) {
  const start = css.indexOf(selector);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}

const light = tokens(':root {');
const dark = { ...light, ...tokens(":root[data-theme='dark'] {") };

const ratio = contrast;

let failures = 0;
// advisory: nur Hinweis, lässt den Lauf nicht fehlschlagen.
function report(name, fg, bg, min = 4.5, advisory = false) {
  const value = ratio(fg, bg);
  const ok = value >= min;
  if (!ok && !advisory) failures += 1;
  console.log(`${ok ? 'ok  ' : advisory ? 'Hinweis  ' : 'ZU NIEDRIG'}  ${value.toFixed(2).padStart(5)}:1  ${name} (${fg} auf ${bg})`);
}

for (const [themeName, t] of [['hell', light], ['dunkel', dark]]) {
  console.log(`\n${themeName}`);
  for (const bg of ['paper', 'paper-raised', 'paper-sunk']) {
    report(`ink auf ${bg}`, t.ink, t[bg]);
    report(`ink-soft auf ${bg}`, t['ink-soft'], t[bg]);
  }
  for (const bg of ['paper', 'paper-raised']) {
    report(`accent auf ${bg}`, t.accent, t[bg]);
    for (const status of ['ok', 'warn', 'bad']) report(`${status} auf ${bg}`, t[status], t[bg]);
  }
  report('on-accent auf accent', t['on-accent'], t.accent);
  // Ränder von Bedienelementen sollen 3:1 erreichen. Das ist bewusst weicher
  // gehalten, weil jedes Element zusätzlich einen Text trägt.
  report('Rand von Bedienelementen (Ziel 3:1)', t['line-strong'], t.paper, 3, true);
}

console.log('\nAkzentvorgaben');
for (const accent of ACCENTS) {
  for (const [themeName, t, key] of [['hell', light, 'light'], ['dunkel', dark, 'dark']]) {
    const color = accent[key];
    report(`${accent.name} ${themeName} auf paper`, color, t.paper);
    report(`${accent.name} ${themeName} auf paper-raised`, color, t['paper-raised']);
    report(`${accent.name} ${themeName}: Text auf Fläche`, textOnAccent(color), color);
  }
}

// Die Textfarben in colors.js müssen mit style.css übereinstimmen.
console.log('\nTextfarben: CSS gegen colors.js');
for (const [themeName, t] of [['light', light], ['dark', dark]]) {
  for (const [token, value] of Object.entries(TEXT_TOKENS[themeName])) {
    const same = t[token]?.toUpperCase() === value.toUpperCase();
    if (!same) failures += 1;
    console.log(`${same ? 'ok  ' : 'ABWEICHUNG'}  ${themeName} ${token}: CSS ${t[token]} / colors.js ${value}`);
  }
}
for (const [key, value] of [['PATTERN_SHARE', PATTERN_SHARE]]) {
  const match = css.match(/--pattern-line: color-mix\(in srgb, var\(--ink\) (\d+)%/);
  const same = match && Number(match[1]) / 100 === value;
  if (!same) failures += 1;
  console.log(`${same ? 'ok  ' : 'ABWEICHUNG'}  ${key} = ${value} (CSS: ${match?.[1]} %)`);
}
{
  const match = css.match(/--sheet-mix: (\d+)%/);
  const same = match && Number(match[1]) / 100 === SHEET_ALPHA;
  if (!same) failures += 1;
  console.log(`${same ? 'ok  ' : 'ABWEICHUNG'}  SHEET_ALPHA = ${SHEET_ALPHA} (CSS: ${match?.[1]} %)`);
}

// Alle Varianten des Hintergrunds: Papier (Vorgaben und Grenzfälle), Akzent,
// Muster, mit und ohne Foto. Nach der automatischen Anpassung muss alles lesbar sein.
console.log('\nHintergrund-Varianten');
const customPapers = ['#000000', '#FFFFFF', '#FF00FF', '#808080', '#FFFF00', '#0000FF'];
const customAccents = ['#FFFF00', '#000000', '#808080', '#FFFFFF', '#00FFFF'];
let combos = 0;
let adjustedCount = 0;
let unreadable = 0;
const standardAdjusted = [];
for (const theme of ['light', 'dark']) {
  const papers = [
    ...PAPERS[theme].map((p) => ({ name: p.id, color: p.color })),
    ...customPapers.map((c) => ({ name: c, color: c })),
  ];
  const accents = [
    ...ACCENTS.map((a) => ({ name: a.id, color: a[theme] })),
    ...customAccents.map((c) => ({ name: c, color: accentFor(c, theme) })),
  ];
  for (const paper of papers) {
    for (const accent of accents) {
      for (const { id: pattern } of PATTERNS) {
        for (const photo of [false, true]) {
          combos += 1;
          const result = resolvePaper(paper.color, theme, { accent: accent.color, pattern, photo });
          if (result.adjusted) adjustedCount += 1;
          if (!result.readable) {
            unreadable += 1;
            console.log(`NICHT LESBAR  ${theme} Papier ${paper.name}, Akzent ${accent.name}, ${pattern}, Foto ${photo}: ${result.margin.toFixed(2)}`);
          }
          if (paper.name === 'standard' && result.adjusted && !photo && pattern === 'plain'
            && ACCENTS.some((a) => a.id === accent.name)) {
            standardAdjusted.push(`${theme}/${accent.name}`);
          }
        }
      }
    }
  }
}
console.log(`${combos} Kombinationen, ${adjustedCount} mit Anpassung der Papierfarbe, ${unreadable} nicht lesbar.`);
if (standardAdjusted.length) {
  failures += 1;
  console.log(`ZU NIEDRIG  Standardpapier ohne Muster und Foto braucht Anpassung: ${standardAdjusted.join(', ')}`);
}
failures += unreadable;

if (failures) {
  console.log(`\n${failures} Paar(e) unter der Grenze.`);
  process.exitCode = 1;
}
