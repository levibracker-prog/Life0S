// Explore: Designs entdecken und mit einem Tipp übernehmen. Ein Design bündelt
// Verlauf, Papier, Muster und Akzentfarbe. Module und Widgets folgen später.

import { MAX_DESIGNS } from '../config.js';
import { previewColors } from '../core/appearance.js';
import {
  BUILTIN_DESIGNS, applyDesign, designFromSettings, isActive,
} from '../core/designs.js';
import { makeChange } from '../ui/changes.js';
import { promptDialog } from '../ui/dialog.js';
import { h } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { showToast } from '../ui/toast.js';

// Eine kleine Seite, gezeichnet mit den Farben, die das Design in der App hätte.
function preview(design) {
  const c = previewColors(design.background, design.accent);
  return h('span', {
    class: 'design-preview',
    'data-pattern': design.background.pattern,
    style: `background: ${c.backdrop}; --ink: ${c.ink}; --pattern-line: color-mix(in srgb, ${c.ink} 6%, transparent)`,
    'aria-hidden': 'true',
  },
  h('span', { class: 'design-preview__sheet', style: `background-color: ${c.sheet}` },
    h('span', { class: 'design-preview__title', style: `color: ${c.ink}` }, 'Aa'),
    h('span', { class: 'design-preview__line', style: `background: ${c.soft}` }),
    h('span', { class: 'design-preview__line design-preview__line--short', style: `background: ${c.soft}` }),
    h('span', { class: 'design-preview__card', style: `background: ${c.raised}` },
      h('span', { class: 'design-preview__chip', style: `background: ${c.accent}` }))));
}

function designItem({ design, active, custom, onApply, onDelete }) {
  return h('li', { class: 'design' },
    h('button', {
      type: 'button',
      class: 'design__tile',
      'data-key': `design-${design.id}`,
      'aria-pressed': String(active),
      'aria-label': `Design ${design.name}${active ? ', aktiv' : ''}`,
      onClick: onApply,
    }, preview(design)),
    h('div', { class: 'design__caption' },
      h('div', {},
        h('div', { class: 'design__name' }, design.name),
        h('div', { class: 'row__hint' }, active ? 'Aktiv' : (design.note ?? 'Eigenes Design'))),
      custom && h('button', {
        type: 'button',
        class: 'icon-button',
        'aria-label': `Design ${design.name} löschen`,
        onClick: onDelete,
      }, icon('trash', 20))));
}

export function renderExplore(ctx) {
  const { store } = ctx;
  const change = makeChange(ctx);
  const settings = store.get('settings');
  const custom = store.get('designs');

  const apply = (design) => change(`Design: ${design.name}`, ['settings'], (d) => applyDesign(d.settings, design));

  async function saveCurrent() {
    if (custom.length >= MAX_DESIGNS) {
      showToast(`Es sind höchstens ${MAX_DESIGNS} eigene Designs möglich. Lösche eins, um Platz zu schaffen.`, { error: true });
      return;
    }
    const withPhoto = settings.background.usePhoto && store.get('backgroundImage').dataUrl !== '';
    const taken = new Set(custom.map((d) => d.name));
    const name = await promptDialog({
      title: 'Aussehen als Design speichern',
      text: withPhoto
        ? 'Gespeichert werden Verlauf, Papier, Muster und Akzentfarbe. Das Foto gehört nicht dazu, es ist zu groß, um es mehrfach zu speichern.'
        : 'Gespeichert werden Verlauf, Papier, Muster und Akzentfarbe.',
      label: 'Name des Designs',
      confirmLabel: 'Speichern',
    });
    if (!name) return;
    let unique = name;
    for (let n = 2; taken.has(unique); n += 1) unique = `${name} ${n}`.slice(0, 40);
    await change(`Design gespeichert: ${unique}`, ['designs'], (d) => {
      d.designs.push({
        v: 1,
        id: crypto.randomUUID(),
        name: unique,
        createdAt: new Date().toISOString(),
        ...designFromSettings(settings),
      });
    });
  }

  const remove = (design) => change(`Design gelöscht: ${design.name}`, ['designs'], (d) => {
    d.designs = d.designs.filter((entry) => entry.id !== design.id);
  });

  return h('section', { class: 'view', 'aria-labelledby': 'view-title' },
    h('h1', { class: 'view__title', id: 'view-title' }, 'Explore'),
    h('p', { class: 'view__lead' }, 'Designs, Module und Widgets zum Ausprobieren.'),

    h('div', { class: 'section' },
      h('h2', { class: 'section__title' }, 'Designs'),
      h('p', { class: 'row__hint' }, 'Ein Tipp übernimmt Verlauf, Papier, Muster und Akzentfarbe. Rückgängig geht danach über die Meldung unten.'),
      h('ul', { class: 'designs' },
        BUILTIN_DESIGNS.map((design) => designItem({
          design, active: isActive(settings, design), custom: false, onApply: () => apply(design),
        })),
        custom.map((design) => designItem({
          design, active: isActive(settings, design), custom: true, onApply: () => apply(design), onDelete: () => remove(design),
        }))),
      h('button', { type: 'button', class: 'button', onClick: saveCurrent },
        icon('plus', 20), 'Aktuelles Aussehen speichern')),

    h('div', { class: 'section' },
      h('h2', { class: 'section__title' }, 'Module'),
      h('div', { class: 'empty' },
        h('h2', { class: 'empty__title' }, 'Noch keine Module eingebaut'),
        h('p', { class: 'empty__text' }, 'Habits, Aufgaben, Ziele und Ernährung folgen. Jedes läuft allein und lässt sich ein- und ausschalten.'))));
}
