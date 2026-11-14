// Profil, Abschnitt "Hintergrund": Papierfarbe (hell und dunkel getrennt),
// Muster und eigenes Foto mit Abdunkeln. Änderungen laufen über `change`
// aus profile.js, also über store.transact mit Rückgängig.

import { DIM_MAX, DIM_MIN, PAPERS, PATTERNS } from '../config.js';
import { paperColor } from '../core/colors.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { prepareBackgroundPhoto } from '../ui/image.js';
import { showToast } from '../ui/toast.js';
import { previewPaper } from '../ui/theme.js';

// Verhindert, dass ein zweites Foto startet, solange das erste noch verkleinert wird.
let photoBusy = false;

export function renderBackgroundSection({ store, change, reportError }) {
  const settings = store.get('settings');
  const image = store.get('backgroundImage');
  const { background } = settings;
  const hasPhoto = image.dataUrl !== '';

  const setBackground = (label, patch) => change(label, ['settings'], (d) => {
    Object.assign(d.settings.background, patch);
  });

  return h('div', { class: 'section' },
    h('h2', { class: 'section__title' }, 'Hintergrund'),
    h('div', { class: 'rows' },
      paperRow('Papier hell', 'light', settings, image, setBackground),
      paperRow('Papier dunkel', 'dark', settings, image, setBackground),
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

function paperRow(label, theme, settings, image, setBackground) {
  const key = theme === 'light' ? 'paperLight' : 'paperDark';
  const current = settings.background[key];
  const isCustom = current.startsWith('#');
  const adjusted = previewPaper(settings, image, theme).adjusted;
  const customStart = isCustom ? current : PAPERS[theme][0].color;

  const pick = (value, name) => setBackground(`${label}: ${name}`, { [key]: value });

  return h('div', { class: 'row row--stacked' },
    h('div', {},
      h('div', { class: 'row__label' }, label),
      adjusted && h('div', { class: 'row__hint' }, 'Für gute Lesbarkeit leicht angepasst.')),
    h('div', { class: 'swatches' },
      PAPERS[theme].map((entry) => h('button', {
        type: 'button',
        class: 'swatch swatch--paper',
        style: `--swatch: ${entry.color}`,
        'data-key': `${key}-${entry.id}`,
        'aria-label': `${label}: ${entry.name}`,
        'aria-pressed': String(current === entry.id),
        onClick: () => current !== entry.id && pick(entry.id, entry.name),
      })),
      h('label', { class: 'swatch swatch--custom', 'aria-pressed': String(isCustom) },
        h('span', { class: 'visually-hidden' }, `${label}: eigene Farbe wählen`),
        h('input', {
          type: 'color',
          value: paperColor(customStart, theme).toLowerCase(),
          'data-key': `${key}-custom`,
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
        ? `Gespeichert als JPEG, ${image.width} × ${image.height} px. Der Inhalt liegt auf einem Blatt, damit Text lesbar bleibt.`
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
