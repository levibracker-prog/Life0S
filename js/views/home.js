import { buildDayNote } from '../core/daynote.js';
import { h } from '../ui/dom.js';

const dateFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });

export function renderHome({ store }) {
  const note = buildDayNote({ dashboard: store.get('dashboard') });
  const widgets = store.get('dashboard').widgets;

  return h('section', { class: 'view', 'aria-labelledby': 'home-note' },
    h('p', { class: 'home__date' }, dateFormat.format(new Date())),
    h('h1', { class: note.empty ? 'home__note home__note--empty' : 'home__note', id: 'home-note' }, note.text),
    h('div', { class: 'home__board' },
      widgets.length === 0 && h('div', { class: 'empty' },
        h('h2', { class: 'empty__title' }, 'Hier liegen deine Widgets'),
        h('p', { class: 'empty__text' }, 'Es gibt noch keine. Ordnen und anlegen kannst du sie, sobald die Widget-Engine eingebaut ist.'))));
}
