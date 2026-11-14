// Profil, Abschnitt "Hintergrund": Verlauf (2 bis 4 frei wählbare Farben,
// Typ, Winkel), Papier, Muster und eigenes Foto. Es gibt nur diese eine
// Einstellung. Ob die App hell oder dunkel ist, folgt aus dem Verlauf
// (core/appearance.js). Änderungen laufen über `change` (store.transact mit
// Rückgängig); beim Ziehen gibt es nur eine Vorschau.

import {
  DIM_MAX, DIM_MIN, GRADIENT_MAX_COLORS, GRADIENT_TYPES, PALETTE, PAPERS, PATTERNS,
} from '../config.js';
import { gradientCss, tintFor } from '../core/appearance.js';
import { createColorPicker } from '../ui/colorpicker.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { prepareBackgroundPhoto } from '../ui/image.js';
import { showToast } from '../ui/toast.js';
import { applyAppearance, currentAppearance } from '../ui/theme.js';

// Verhindert, dass ein zweites Foto startet, solange das erste noch verkleinert wird.
let photoBusy = false;
// Welche Verlaufsfarbe gerade im Farbwähler offen ist (überlebt das Neuzeichnen).
let openIndex = null;
// Genauer Farbton/Sättigung der offenen Farbe, damit Grautöne beim Neuzeichnen
// nicht den Farbton verlieren.
let hsvMemory = null;

const ratioText = (n) => n.toFixed(1).replace('.', ',');

function noteText(result) {
  const scheme = result.scheme === 'dark' ? 'Helle Schrift auf dunklem Grund' : 'Dunkle Schrift auf hellem Grund';
  return `${scheme}, das folgt aus dem Verlauf. Papier ${Math.round(result.alpha * 100)} % deckend, kleinster Kontrast ${ratioText(result.ratioAfter)}:1.`;
}

function warningText(result) {
  if (!result.warning) return '';
  const { color, ratio } = result.worstBefore;
  const fixes = [`Deckkraft des Papiers auf ${Math.round(result.alpha * 100)} % erhöht`];
  if (result.tintAdjusted) fixes.push('Papierfarbe angepasst');
  return `Warnung: An der Farbe ${color.toUpperCase()} läge der Kontrast bei ${ratioText(ratio)}:1, unter 4,5:1. LifeOS hat korrigiert: ${fixes.join(', ')}.`;
}

export function renderBackgroundSection({
  store, change, reportError, rerender,
}) {
  const settings = store.get('settings');
  const image = store.get('backgroundImage');
  const { background } = settings;
  const { gradient } = background;
  const hasPhoto = image.dataUrl !== '';
  const applied = currentAppearance();

  const setBackground = (label, patch) => change(label, ['settings'], (d) => {
    Object.assign(d.settings.background, patch);
  });
  const setGradient = (label, patch) => change(label, ['settings'], (d) => {
    Object.assign(d.settings.background.gradient, patch);
  });

  const strip = h('div', { class: 'gradient-preview', role: 'img', 'aria-label': 'Vorschau des Verlaufs' });
  const note = h('p', { class: 'row__hint' });
  const warning = h('p', { class: 'notice', role: 'status' });

  function show(result, previewGradient) {
    strip.style.background = gradientCss(previewGradient);
    note.textContent = noteText(result);
    warning.textContent = warningText(result);
    warning.hidden = !result.warning;
  }
  show(applied, gradient);

  // Entwurf anzeigen, ohne zu speichern.
  const previewGradientChange = (nextGradient) => {
    const draft = { ...settings, background: { ...background, gradient: nextGradient } };
    show(applyAppearance(draft, image), nextGradient);
  };
  const revertPreview = () => show(applyAppearance(settings, image), gradient);

  const withColor = (index, hex) => ({
    ...gradient, colors: gradient.colors.map((c, i) => (i === index ? hex.toLowerCase() : c)),
  });

  const chips = gradient.colors.map((color, index) => h('button', {
    type: 'button',
    class: 'color-chip',
    'data-key': `gradient-color-${index}`,
    'aria-expanded': String(openIndex === index),
    'aria-label': `Farbe ${index + 1}: ${color.toUpperCase()}`,
    onClick: () => {
      openIndex = openIndex === index ? null : index;
      hsvMemory = null;
      rerender();
    },
  }, h('span', { class: 'color-chip__dot', style: `--swatch: ${color}` }), h('span', { class: 'num' }, color.toUpperCase())));

  const addButton = gradient.colors.length < GRADIENT_MAX_COLORS && h('button', {
    type: 'button',
    class: 'color-chip color-chip--add',
    'data-key': 'gradient-add',
    onClick: () => {
      const taken = gradient.colors.map((c) => c.toUpperCase());
      const next = (PALETTE.find((p) => !taken.includes(p.color.toUpperCase())) ?? PALETTE[0]).color.toLowerCase();
      openIndex = gradient.colors.length;
      hsvMemory = null;
      setGradient('Verlauf: Farbe hinzugefügt', { colors: [...gradient.colors, next] });
    },
  }, icon('plus', 18), 'Farbe');

  let panel = null;
  if (openIndex !== null && openIndex < gradient.colors.length) {
    const index = openIndex;
    const value = gradient.colors[index].toUpperCase();
    const remembered = hsvMemory && hsvMemory.hex === value ? hsvMemory.hsv : undefined;
    panel = h('div', { class: 'cp-panel' },
      createColorPicker({
        value,
        hsv: remembered,
        label: `Farbe ${index + 1}`,
        onPreview: (hex) => previewGradientChange(withColor(index, hex)),
        onCommit: (hex, hsv) => {
          hsvMemory = { hex: hex.toUpperCase(), hsv };
          const next = withColor(index, hex);
          if (next.colors[index] === gradient.colors[index].toLowerCase()) { revertPreview(); return; }
          setGradient(`Verlauf: Farbe ${index + 1}`, { colors: next.colors });
        },
      }),
      gradient.colors.length > 1 && h('button', {
        type: 'button',
        class: 'button button--quiet',
        onClick: () => {
          openIndex = null;
          setGradient('Verlauf: Farbe entfernt', { colors: gradient.colors.filter((_, i) => i !== index) });
        },
      }, icon('trash', 20), `Farbe ${index + 1} entfernen`));
  }

  const single = gradient.colors.length === 1;
  const angleDisabled = single || gradient.type === 'radial';
  const angleValue = h('span', { class: 'num', id: 'angle-value' }, `${gradient.angle}°`);
  const angleSlider = h('input', {
    type: 'range', class: 'slider', min: 0, max: 360, step: 1, value: gradient.angle,
    'data-key': 'gradient-angle', 'aria-labelledby': 'angle-label', disabled: angleDisabled,
    onInput: (event) => {
      angleValue.textContent = `${event.target.value}°`;
      previewGradientChange({ ...gradient, angle: Number(event.target.value) });
    },
    onChange: (event) => setGradient(`Verlauf: Winkel ${event.target.value}°`, { angle: Number(event.target.value) }),
  });

  return h('div', { class: 'section' },
    h('h2', { class: 'section__title' }, 'Hintergrund'),
    h('div', { class: 'rows' },
      h('div', { class: 'row row--stacked' },
        h('div', {},
          h('div', { class: 'row__label' }, 'Verlauf'),
          h('div', { class: 'row__hint' }, single ? 'Eine Farbe ergibt eine einfarbige Fläche.' : 'Helle und dunkle Farben dürfen gemischt werden.')),
        strip,
        h('div', { class: 'chip-row' }, chips, addButton),
        panel,
        h('div', { class: 'segmented', role: 'group', 'aria-label': 'Verlaufstyp' },
          GRADIENT_TYPES.map(({ id, name }) => h('button', {
            type: 'button',
            'data-key': `gradient-type-${id}`,
            'aria-pressed': String(id === gradient.type),
            disabled: single,
            onClick: () => id !== gradient.type && setGradient(`Verlauf: ${name}`, { type: id }),
          }, name))),
        h('div', { class: 'slider-row' },
          h('span', { id: 'angle-label' }, 'Winkel'), angleValue, angleSlider),
        note,
        warning),
      paperRow(settings, background, applied, setBackground),
      h('div', { class: 'row row--stacked' },
        h('div', { class: 'row__label' }, 'Muster'),
        h('div', { class: 'segmented', role: 'group', 'aria-label': 'Muster' },
          PATTERNS.map(({ id, name }) => h('button', {
            type: 'button',
            'data-key': `pattern-${id}`,
            'aria-pressed': String(id === background.pattern),
            onClick: () => id !== background.pattern && setBackground(`Muster: ${name}`, { pattern: id }),
          }, name)))),
      photoRow({ image, hasPhoto, background, setBackground, change, reportError })));
}

function paperRow(settings, background, applied, setBackground) {
  const current = background.paper;
  const isCustom = current.startsWith('#');
  const scheme = applied.scheme;
  const pick = (value, name) => setBackground(`Papier: ${name}`, { paper: value });
  return h('div', { class: 'row row--stacked' },
    h('div', {},
      h('div', { class: 'row__label' }, 'Papier'),
      h('div', { class: 'row__hint' }, 'Die Fläche unter Karten und Inhalt. Die Helligkeit passt sich dem Verlauf an.'),
      applied.tintAdjusted && h('div', { class: 'row__hint' }, 'Für gute Lesbarkeit leicht angepasst.')),
    h('div', { class: 'swatches' },
      PAPERS.map((entry) => h('button', {
        type: 'button',
        class: 'swatch swatch--paper',
        style: `--swatch: ${tintFor(entry.id, scheme)}`,
        'data-key': `paper-${entry.id}`,
        'aria-label': `Papier: ${entry.name}`,
        'aria-pressed': String(current === entry.id),
        onClick: () => current !== entry.id && pick(entry.id, entry.name),
      })),
      h('label', { class: 'swatch swatch--custom', 'aria-pressed': String(isCustom) },
        h('span', { class: 'visually-hidden' }, 'Papier: eigene Farbe wählen'),
        h('input', {
          type: 'color',
          value: (isCustom ? current : tintFor('standard', scheme)).toLowerCase(),
          'data-key': 'paper-custom',
          onChange: (event) => pick(event.target.value.toLowerCase(), 'eigene Farbe'),
        }))));
}

function photoRow({
  image, hasPhoto, background, setBackground, change, reportError,
}) {
  const input = h('input', {
    type: 'file',
    accept: 'image/*',
    class: 'visually-hidden',
    'aria-label': 'Foto wählen',
    onChange: async () => {
      const file = input.files[0];
      input.value = '';
      if (!file || photoBusy) return;
      photoBusy = true;
      showToast('Foto wird verkleinert …');
      try {
        const photo = await prepareBackgroundPhoto(file);
        await change('Hintergrund: Foto', ['settings', 'backgroundImage'], (d) => {
          d.backgroundImage.dataUrl = photo.dataUrl;
          d.backgroundImage.width = photo.width;
          d.backgroundImage.height = photo.height;
          d.settings.background.usePhoto = true;
        });
      } catch (err) {
        reportError(err);
      } finally {
        photoBusy = false;
      }
    },
  });

  const removePhoto = () => change('Hintergrund: Foto entfernt', ['settings', 'backgroundImage'], (d) => {
    d.backgroundImage.dataUrl = '';
    d.backgroundImage.width = 0;
    d.backgroundImage.height = 0;
    d.settings.background.usePhoto = false;
  });

  const dimLabel = h('span', { class: 'num', id: 'dim-value' }, `${background.dim} %`);
  const slider = h('input', {
    type: 'range',
    class: 'slider',
    min: DIM_MIN,
    max: DIM_MAX,
    step: 5,
    value: background.dim,
    'data-key': 'photo-dim',
    'aria-labelledby': 'dim-label',
    // Beim Ziehen nur Vorschau, gespeichert wird erst beim Loslassen.
    onInput: (event) => {
      document.documentElement.style.setProperty('--photo-dim', String(event.target.value / 100));
      dimLabel.textContent = `${event.target.value} %`;
    },
    onChange: (event) => setBackground(`Abdunkeln: ${event.target.value} %`, { dim: Number(event.target.value) }),
  });

  return h('div', { class: 'row row--stacked' },
    h('div', {},
      h('div', { class: 'row__label' }, 'Eigenes Foto'),
      h('div', { class: 'row__hint' }, hasPhoto
        ? `Gespeichert als JPEG, ${image.width} × ${image.height} px. Das Foto ersetzt den Verlauf, hell oder dunkel folgt weiter dem Verlauf.`
        : 'Wird beim Hochladen auf höchstens 1600 px verkleinert und bleibt auf diesem Gerät.')),
    input,
    hasPhoto && h('img', {
      class: 'photo-preview',
      src: image.dataUrl,
      alt: 'Vorschau des Hintergrundfotos',
      width: 96,
      height: Math.max(1, Math.round((96 * image.height) / image.width)),
    }),
    h('div', { class: 'button-row' },
      h('button', { type: 'button', class: 'button', onClick: () => input.click() },
        icon('upload', 20), hasPhoto ? 'Foto ändern' : 'Foto wählen'),
      hasPhoto && h('button', { type: 'button', class: 'button button--quiet', onClick: removePhoto },
        icon('trash', 20), 'Entfernen')),
    hasPhoto && h('div', { class: 'segmented', role: 'group', 'aria-label': 'Foto anzeigen' },
      [{ id: false, name: 'Aus' }, { id: true, name: 'An' }].map(({ id, name }) => h('button', {
        type: 'button',
        'data-key': `photo-use-${id}`,
        'aria-pressed': String(background.usePhoto === id),
        onClick: () => background.usePhoto !== id && setBackground(`Foto: ${name}`, { usePhoto: id }),
      }, name))),
    hasPhoto && h('div', { class: 'slider-row' },
      h('span', { id: 'dim-label' }, 'Abdunkeln'),
      dimLabel,
      slider));
}
