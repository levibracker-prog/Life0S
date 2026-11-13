// Misst Kontraste der Design-Tokens aus css/style.css und der
// Akzentvorgaben aus js/config.js. Ziel: mindestens 4,5:1 für Text.
// Aufruf: npm run kontrast

import { readFileSync } from 'node:fs';
import { ACCENTS } from '../js/config.js';
import { textOnAccent } from '../js/ui/theme.js';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');

function tokens(selector) {
  const start = css.indexOf(selector);
  const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}

const light = tokens(':root {');
const dark = { ...light, ...tokens(":root[data-theme='dark'] {") };

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = [n >> 16, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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

if (failures) {
  console.log(`\n${failures} Paar(e) unter der Grenze.`);
  process.exitCode = 1;
}
