import { SCREENS } from '../config.js';
import { h } from './dom.js';
import { icon } from './icons.js';

// Der Agent steht immer in der Mitte, die vier anderen Bereiche folgen
// der Reihenfolge aus den Einstellungen.
export function renderNav(navItems, currentId) {
  const order = [navItems[0], navItems[1], 'agent', navItems[2], navItems[3]];
  return h('nav', { class: 'nav', 'aria-label': 'Hauptnavigation' },
    order.map((id) => {
      const isAgent = id === 'agent';
      const symbol = icon(id, isAgent ? 26 : 24);
      return h('a', {
        class: isAgent ? 'nav__item nav__item--agent' : 'nav__item',
        href: `#/${id}`,
        'aria-current': id === currentId ? 'page' : null,
      },
      isAgent ? h('span', { class: 'nav__agent-disc' }, symbol) : symbol,
      h('span', {}, SCREENS[id]));
    }));
}
