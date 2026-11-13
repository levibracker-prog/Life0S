// Profil: Darstellung, Navigation, Alter, Daten. Jede Änderung läuft
// über store.transact und lässt sich per Toast rückgängig machen.

import {
  ACCENTS, DENSITIES, FONT_SCALES, SCREENS, THEMES,
} from '../config.js';
import { confirmDialog } from '../ui/dialog.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';
import { accentFor, resolveTheme } from '../ui/theme.js';

export function renderProfile(ctx) {
  const { store, storage } = ctx;
  const settings = store.get('settings');
  const meta = store.get('meta');

  async function change(label, collections, mutate) {
    try {
      const entry = await store.transact(label, collections, mutate);
      if (entry) {
        showToast(label, { actionLabel: 'Rückgängig', onAction: () => undoLast(ctx) });
      }
    } catch (err) {
      reportError(err);
    }
  }

  const setting = (label, key, value) => change(label, ['settings'], (d) => { d.settings[key] = value; });

  return h('section', { class: 'view', 'aria-labelledby': 'view-title' },
    h('h1', { class: 'view__title', id: 'view-title' }, 'Profil'),
    h('p', { class: 'view__lead' }, 'Hier stellst du LifeOS auf dich ein.'),

    h('div', { class: 'section' },
      h('h2', { class: 'section__title' }, 'Darstellung'),
      h('div', { class: 'rows' },
        row('Thema', segmented('theme', THEMES, settings.theme, (id, name) => setting(`Thema: ${name}`, 'theme', id))),
        row('Akzentfarbe', accentPicker(settings, setting)),
        row('Dichte', segmented('density', DENSITIES, settings.density, (id, name) => setting(`Dichte: ${name}`, 'density', id))),
        row('Schriftgröße', segmented('fontScale', FONT_SCALES, settings.fontScale, (id, name) => setting(`Schriftgröße: ${name}`, 'fontScale', id))))),

    h('div', { class: 'section' },
      h('h2', { class: 'section__title' }, 'Navigation'),
      h('p', { class: 'row__hint' }, 'Der Agent bleibt immer in der Mitte.'),
      h('div', { class: 'rows' },
        settings.navItems.map((id, index) => navRow(id, index, settings.navItems, change)))),

    h('div', { class: 'section' },
      h('h2', { class: 'section__title' }, 'Alter'),
      h('div', { class: 'rows' },
        row('Unter 18', segmented('age', [
          { id: 'minor', name: 'Ja' },
          { id: 'adult', name: 'Nein' },
        ], meta.ageGroup === 'unset' ? '' : meta.ageGroup, (id) => change(
          id === 'minor' ? 'Alter: unter 18' : 'Alter: ab 18',
          ['meta'],
          (d) => { d.meta.ageGroup = id; },
        )),
        meta.ageGroup === 'unset' ? 'Noch nicht beantwortet. Bis dahin gelten die Schutzregeln für unter 18.' : 'Bei unter 18 gibt es keine Kalorienziele und keine Abnehmtipps.'))),

    h('div', { class: 'section' },
      h('h2', { class: 'section__title' }, 'Daten'),
      h('p', { class: 'row__hint' }, 'Alles liegt nur auf diesem Gerät. Exportiere es ab und zu, falls der Browser seinen Speicher leert.'),
      h('div', { class: 'rows' },
        row('Rückgängig', undoRow(store, ctx)),
        row('Exportieren', h('button', { type: 'button', class: 'button', onClick: () => exportData(store, storage) },
          icon('download', 20), 'Datei laden')),
        row('Importieren', importControl(ctx)),
        row('Alles löschen', h('button', {
          type: 'button',
          class: 'button button--danger',
          onClick: () => wipeData(ctx),
        }, icon('trash', 20), 'Löschen')))));
}

function row(label, control, hint) {
  return h('div', { class: 'row row--stacked' },
    h('div', {},
      h('div', { class: 'row__label' }, label),
      hint && h('div', { class: 'row__hint' }, hint)),
    control);
}

function segmented(group, options, current, onPick) {
  return h('div', { class: 'segmented', role: 'group', 'aria-label': group },
    options.map(({ id, name }) => h('button', {
      type: 'button',
      'data-key': `${group}-${id}`,
      'aria-pressed': String(id === current),
      onClick: () => id !== current && onPick(id, name),
    }, name)));
}

function accentPicker(settings, setting) {
  const theme = resolveTheme(settings.theme);
  const isCustom = settings.accent.startsWith('#');
  const customValue = isCustom ? settings.accent : '#B63E1A';
  return h('div', { class: 'swatches' },
    ACCENTS.map((entry) => h('button', {
      type: 'button',
      class: 'swatch',
      style: `--swatch: ${entry[theme]}`,
      'data-key': `accent-${entry.id}`,
      'aria-label': entry.name,
      'aria-pressed': String(settings.accent === entry.id),
      onClick: () => setting(`Akzentfarbe: ${entry.name}`, 'accent', entry.id),
    })),
    h('label', {
      class: 'swatch swatch--custom',
      'aria-pressed': String(isCustom),
    },
    h('span', { class: 'visually-hidden' }, 'Eigene Farbe wählen'),
    h('input', {
      type: 'color',
      value: accentFor(customValue, 'light'),
      'data-key': 'accent-custom',
      onChange: (event) => setting('Akzentfarbe: eigene', 'accent', event.target.value.toLowerCase()),
    })));
}

function navRow(id, index, order, change) {
  const move = (delta) => change(`Navigation: ${SCREENS[id]} verschoben`, ['settings'], (d) => {
    const items = d.settings.navItems;
    [items[index], items[index + delta]] = [items[index + delta], items[index]];
  });
  return h('div', { class: 'row' },
    h('span', { class: 'row__label' }, SCREENS[id]),
    h('span', {},
      h('button', {
        type: 'button', class: 'icon-button', 'data-key': `nav-up-${id}`,
        'aria-label': `${SCREENS[id]} nach vorn`, disabled: index === 0, onClick: () => move(-1),
      }, icon('up', 22)),
      h('button', {
        type: 'button', class: 'icon-button', 'data-key': `nav-down-${id}`,
        'aria-label': `${SCREENS[id]} nach hinten`, disabled: index === order.length - 1, onClick: () => move(1),
      }, icon('down', 22))));
}

function undoRow(store, ctx) {
  const last = store.lastUndoEntry();
  return h('button', {
    type: 'button',
    class: 'button',
    disabled: !last,
    onClick: () => undoLast(ctx),
  }, icon('undo', 20), last ? `Rückgängig: ${last.label}` : 'Nichts zum Rückgängigmachen');
}

export async function undoLast({ store }) {
  try {
    const entry = await store.undo();
    if (entry) showToast(`Rückgängig gemacht: ${entry.label}`);
  } catch (err) {
    reportError(err);
  }
}

function reportError(err) {
  showToast(err.message || 'Das hat nicht geklappt.', { error: true });
}

function exportData(store, storage) {
  try {
    const text = storage.exportAll({
      meta: store.get('meta'),
      settings: store.get('settings'),
      dashboard: store.get('dashboard'),
    });
    const day = new Date().toISOString().slice(0, 10);
    const link = h('a', {
      href: URL.createObjectURL(new Blob([text], { type: 'application/json' })),
      download: `lifeos-${day}.json`,
    });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast('Export gespeichert.');
  } catch (err) {
    reportError(err);
  }
}

function importControl(ctx) {
  const input = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    class: 'visually-hidden',
    'aria-label': 'Importdatei wählen',
    onChange: async () => {
      const file = input.files[0];
      input.value = '';
      if (file) await importFile(file, ctx);
    },
  });
  return h('div', {},
    input,
    h('button', { type: 'button', class: 'button', onClick: () => input.click() },
      icon('upload', 20), 'Datei wählen'));
}

async function importFile(file, { store, storage }) {
  try {
    const imported = storage.parseImport(await file.text());
    const ok = await confirmDialog({
      title: 'Daten ersetzen?',
      text: 'Die Daten in der Datei ersetzen die aktuellen. Vorher legt LifeOS eine Sicherung im Browser an.',
      confirmLabel: 'Ersetzen',
      danger: true,
    });
    if (!ok) return;
    await storage.importAll({
      meta: store.get('meta'),
      settings: store.get('settings'),
      dashboard: store.get('dashboard'),
    }, imported);
    await store.reload();
    showToast('Import abgeschlossen.');
  } catch (err) {
    reportError(err);
  }
}

async function wipeData({ store, storage }) {
  const ok = await confirmDialog({
    title: 'Alles löschen?',
    text: 'Einstellungen und alle Daten auf diesem Gerät werden entfernt. Das lässt sich nicht rückgängig machen. Exportiere vorher, wenn du etwas behalten willst.',
    confirmLabel: 'Alles löschen',
    danger: true,
  });
  if (!ok) return;
  try {
    await storage.wipe();
    await store.reload();
    showToast('Alles gelöscht.');
  } catch (err) {
    reportError(err);
  }
}
