// Farbwähler aus Farbfläche (Sättigung und Helligkeit), Farbtonregler,
// Hex-Eingabe und Schnellauswahl. Während des Ziehens gibt es nur eine
// Vorschau (onPreview), gespeichert wird beim Loslassen (onCommit).

import { PALETTE } from '../config.js';
import { hexToHsv, hsvToHex, normalizeHex } from '../core/colors.js';
import { h } from './dom.js';

const KEY_DELAY_MS = 500;
const clamp01 = (n) => Math.min(1, Math.max(0, n));

export function createColorPicker({
  value, hsv: initialHsv, label, onPreview, onCommit,
}) {
  let hsv = initialHsv ?? hexToHsv(value);

  const thumb = h('span', { class: 'cp-thumb' });
  const area = h('div', {
    class: 'cp-area',
    tabindex: '0',
    role: 'application',
    'aria-label': `${label}: Farbfläche. Pfeiltasten ändern Sättigung und Helligkeit.`,
  }, thumb);
  const hue = h('input', {
    type: 'range', class: 'cp-hue', min: 0, max: 360, step: 1, 'aria-label': `${label}: Farbton`,
  });
  const hexInput = h('input', {
    type: 'text', class: 'text-input cp-hex', maxlength: 7, spellcheck: 'false', autocomplete: 'off',
    autocapitalize: 'characters', 'aria-label': `${label}: Hex-Wert`,
  });
  const hexError = h('p', { class: 'cp-error', role: 'alert' });

  const currentHex = () => hsvToHex(hsv.h, hsv.s, hsv.v);

  function paint() {
    const hex = currentHex();
    area.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${Math.round(hsv.h)}, 100%, 50%))`;
    thumb.style.left = `${hsv.s * 100}%`;
    thumb.style.top = `${(1 - hsv.v) * 100}%`;
    thumb.style.background = hex;
    hue.value = String(Math.round(hsv.h));
    if (document.activeElement !== hexInput) hexInput.value = hex;
    hexInput.removeAttribute('aria-invalid');
    hexError.textContent = '';
  }

  let keyTimer;
  const preview = () => { paint(); onPreview(currentHex(), hsv); };
  const commit = () => {
    clearTimeout(keyTimer);
    onCommit(currentHex(), { ...hsv });
  };

  function pick(event) {
    const rect = area.getBoundingClientRect();
    hsv = { ...hsv, s: clamp01((event.clientX - rect.left) / rect.width), v: 1 - clamp01((event.clientY - rect.top) / rect.height) };
    preview();
  }

  area.addEventListener('pointerdown', (event) => {
    area.setPointerCapture(event.pointerId);
    area.focus({ preventScroll: true });
    pick(event);
  });
  area.addEventListener('pointermove', (event) => {
    if (area.hasPointerCapture(event.pointerId)) pick(event);
  });
  area.addEventListener('pointerup', (event) => {
    if (area.hasPointerCapture(event.pointerId)) {
      area.releasePointerCapture(event.pointerId);
      commit();
    }
  });
  area.addEventListener('keydown', (event) => {
    const step = event.shiftKey ? 0.1 : 0.01;
    const moves = {
      ArrowLeft: { s: -step }, ArrowRight: { s: step }, ArrowUp: { v: step }, ArrowDown: { v: -step },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    hsv = { ...hsv, s: clamp01(hsv.s + (move.s ?? 0)), v: clamp01(hsv.v + (move.v ?? 0)) };
    preview();
    clearTimeout(keyTimer);
    keyTimer = setTimeout(commit, KEY_DELAY_MS);
  });

  hue.addEventListener('input', () => {
    hsv = { ...hsv, h: Number(hue.value) };
    preview();
  });
  hue.addEventListener('change', commit);

  hexInput.addEventListener('input', () => {
    const hex = normalizeHex(hexInput.value);
    if (!hex) {
      hexInput.setAttribute('aria-invalid', 'true');
      hexError.textContent = 'Kein gültiger Hex-Wert. Beispiel: #1A2B3C';
      return;
    }
    hexInput.removeAttribute('aria-invalid');
    hexError.textContent = '';
    hsv = hexToHsv(hex);
    area.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${Math.round(hsv.h)}, 100%, 50%))`;
    thumb.style.left = `${hsv.s * 100}%`;
    thumb.style.top = `${(1 - hsv.v) * 100}%`;
    thumb.style.background = hex;
    hue.value = String(Math.round(hsv.h));
    onPreview(hex, hsv);
  });
  hexInput.addEventListener('change', () => {
    if (normalizeHex(hexInput.value)) commit();
  });
  hexInput.addEventListener('blur', () => {
    // Ungültige Eingabe verwerfen und zur letzten gültigen Farbe zurückkehren.
    if (!normalizeHex(hexInput.value)) {
      paint();
      onPreview(currentHex(), hsv);
    }
  });

  const palette = h('div', { class: 'cp-palette', role: 'group', 'aria-label': `${label}: Schnellauswahl` },
    PALETTE.map(({ name, color }) => h('button', {
      type: 'button',
      class: 'cp-swatch',
      style: `--swatch: ${color}`,
      'aria-label': name,
      title: name,
      onClick: () => {
        hsv = hexToHsv(color);
        paint();
        onPreview(color.toUpperCase(), hsv);
        commit();
      },
    })));

  paint();
  return h('div', { class: 'cp' }, area, hue, h('div', { class: 'cp-hex-row' }, hexInput), hexError, palette);
}
