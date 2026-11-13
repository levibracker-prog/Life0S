// Ansichten, deren Inhalt in einem späteren Schritt kommt. Sie sagen das
// offen, statt Funktionen vorzutäuschen.

import { h } from '../ui/dom.js';

export function renderPlaceholder({ title, lead, emptyTitle, emptyText }) {
  return h('section', { class: 'view', 'aria-labelledby': 'view-title' },
    h('h1', { class: 'view__title', id: 'view-title' }, title),
    h('p', { class: 'view__lead' }, lead),
    h('div', { class: 'view__body empty' },
      h('h2', { class: 'empty__title' }, emptyTitle),
      h('p', { class: 'empty__text' }, emptyText)));
}

export const explore = () => renderPlaceholder({
  title: 'Explore',
  lead: 'Module und Widgets, die du einschalten kannst.',
  emptyTitle: 'Noch keine Module eingebaut',
  emptyText: 'Habits, Aufgaben, Ziele und Ernährung folgen. Jedes läuft allein und lässt sich ein- und ausschalten.',
});

export const agent = () => renderPlaceholder({
  title: 'Agent',
  lead: 'Sag, was sich in der App ändern soll.',
  emptyTitle: 'Noch nicht angeschlossen',
  emptyText: 'Der Agent braucht das Backend. Alles andere in LifeOS läuft auch ohne ihn.',
});

export const progress = () => renderPlaceholder({
  title: 'Progress',
  lead: 'Zahlen aus deinen eigenen Daten.',
  emptyTitle: 'Noch nichts auszuwerten',
  emptyText: 'Sobald du Habits oder Aufgaben nutzt, steht hier, wie es läuft.',
});
