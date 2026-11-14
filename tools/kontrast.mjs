// Misst Kontraste der Design-Tokens aus css/style.css und der
// Akzentvorgaben aus js/config.js. Ziel: mindestens 4,5:1 für Text.
// Aufruf: npm run kontrast

import { readFileSync } from 'node:fs';
import {
  ACCENTS, PAPERS, PATTERNS, PATTERN_SHARE, SHEET_ALPHA,
} from '../js/config.js';
import { resolveAppearance } from '../js/core/appearance.js';
import { TEXT_TOKENS, contrast } from '../js/core/colors.js';
import { BUILTIN_DESIGNS } from '../js/core/designs.js';
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

// Alle Varianten des Hintergrunds: Verläufe (auch Grenzfälle mit hellen und
// dunklen Farben gemischt), Papier, Akzent, Muster, mit und ohne Foto. Nach der
// automatischen Korrektur muss alles lesbar sein.
console.log('\nHintergrund-Varianten');
const gradients = [
  ['#F5F1E8'], ['#15140F'], ['#000000'], ['#FFFFFF'], ['#808080'], ['#777777', '#7A7A7A'],
  ['#FF00FF'], ['#FFFF00'], ['#0000FF'], ['#00FFFF'],
  ['#000000', '#FFFFFF'], ['#FFFFFF', '#000000'],
  ['#FFE8CC', '#F4A99B', '#6F5A9E'], ['#1B1B3A', '#693668', '#C94B4B'],
  ['#FFFF00', '#0000FF', '#FF0000', '#00FF00'],
  ['#000000', '#FFFFFF', '#000000', '#FFFFFF'],
  ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#000000'],
  ['#000000', '#000000', '#000000', '#FFFFFF'],
];
const papers = [...PAPERS.map((p) => p.id), '#000000', '#FFFFFF', '#FF00FF', '#808080'];
const accents = [...ACCENTS.map((a) => a.id), '#FFFF00', '#000000', '#FFFFFF', '#00FFFF'];
let combos = 0;
let corrected = 0;
let warned = 0;
let unreadable = 0;
let worstAfter = Infinity;
for (const colors of gradients) {
  for (const type of ['linear', 'radial']) {
    for (const paper of papers) {
      for (const accent of accents) {
        for (const { id: pattern } of PATTERNS) {
          for (const photo of [false, true]) {
            combos += 1;
            const background = { gradient: { type, angle: 160, colors }, paper, pattern, usePhoto: false, dim: 35 };
            const result = resolveAppearance(background, accent, { photo });
            if (result.corrected) corrected += 1;
            if (result.warning) warned += 1;
            worstAfter = Math.min(worstAfter, result.ratioAfter);
            if (!result.readable || result.ratioAfter < 4.5) {
              unreadable += 1;
              if (unreadable <= 10) console.log(`NICHT LESBAR  ${colors.join(' ')} ${type} Papier ${paper}, Akzent ${accent}, ${pattern}, Foto ${photo}: ${result.ratioAfter.toFixed(2)}`);
            }
          }
        }
      }
    }
  }
}
console.log(`${combos} Kombinationen: ${warned} mit Warnung (unter 4,5:1 vor der Korrektur), ${corrected} korrigiert, ${unreadable} danach nicht lesbar. Schlechtester Wert nach Korrektur: ${worstAfter.toFixed(2)}:1.`);
failures += unreadable;

console.log('\nMitgelieferte Designs (sollen ohne Korrektur lesbar sein)');
for (const design of BUILTIN_DESIGNS) {
  const result = resolveAppearance(design.background, design.accent);
  const ok = !result.corrected && result.ratioAfter >= 4.5;
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'KORREKTUR NÖTIG'}  ${design.name}: ${result.scheme === 'dark' ? 'dunkel' : 'hell'}, kleinster Kontrast ${result.ratioAfter.toFixed(2)}:1, Papier ${Math.round(result.alpha * 100)} %`);
}

if (failures) {
  console.log(`\n${failures} Paar(e) unter der Grenze.`);
  process.exitCode = 1;
}
