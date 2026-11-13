// Start der App: Speicher laden, Darstellung setzen, Navigation und
// Ansichten verbinden. Hier steht nur Verdrahtung, keine Fachlogik.

import { createStorage } from './core/storage.js';
import { createStore } from './core/store.js';
import { renderNav } from './ui/nav.js';
import { askAgeGroup } from './ui/dialog.js';
import { h } from './ui/dom.js';
import { showToast } from './ui/toast.js';
import { applyAppearance, watchSystemTheme } from './ui/theme.js';
import { renderHome } from './views/home.js';
import { renderProfile } from './views/profile.js';
import * as placeholders from './views/placeholder.js';

const VIEWS = {
  home: renderHome,
  explore: placeholders.explore,
  agent: placeholders.agent,
  progress: placeholders.progress,
  profile: renderProfile,
};

const storage = createStorage();
const store = createStore(storage);
const ctx = { store, storage };

const root = document.getElementById('app');
let navHost;
let viewHost;

function currentScreen() {
  const id = location.hash.replace(/^#\//, '');
  return id in VIEWS ? id : 'home';
}

// Zeichnet die aktuelle Ansicht neu und behält Scrollposition und Fokus,
// damit eine Änderung in den Einstellungen die Seite nicht springen lässt.
function render({ animate = false } = {}) {
  const screen = currentScreen();
  const scrollY = window.scrollY;
  const focusKey = document.activeElement?.dataset?.key;

  navHost.replaceChildren(renderNav(store.get('settings').navItems, screen));
  const view = VIEWS[screen](ctx);
  if (!animate) view.style.animation = 'none';
  viewHost.replaceChildren(view);

  window.scrollTo(0, animate ? 0 : scrollY);
  if (focusKey) viewHost.querySelector(`[data-key="${focusKey}"]`)?.focus({ preventScroll: true });
  document.title = screen === 'home' ? 'LifeOS' : `${placeholdersTitle(screen)} · LifeOS`;
}

function placeholdersTitle(screen) {
  return { explore: 'Explore', agent: 'Agent', progress: 'Progress', profile: 'Profil' }[screen];
}

async function askAgeIfNeeded() {
  if (store.get('meta').ageGroup !== 'unset') return;
  const answer = await askAgeGroup();
  if (answer !== 'minor' && answer !== 'adult') return;
  try {
    await store.transact('Alter', ['meta'], (d) => { d.meta.ageGroup = answer; }, { undoable: false });
  } catch (err) {
    showToast(err.message, { error: true });
  }
}

async function start() {
  navHost = h('div');
  viewHost = h('main', { id: 'main' });
  root.replaceChildren(viewHost, navHost);

  let problems = [];
  try {
    problems = await store.init();
  } catch (err) {
    root.replaceChildren(h('main', { class: 'view' },
      h('h1', { class: 'view__title' }, 'LifeOS startet nicht'),
      h('p', { class: 'view__lead' }, err.message)));
    return;
  }

  applyAppearance(store.get('settings'));
  render({ animate: true });
  problems.forEach((text) => showToast(text, { error: true }));

  store.subscribe((event) => {
    applyAppearance(store.get('settings'));
    render({ animate: event.kind === 'load' });
    if (event.kind === 'load') askAgeIfNeeded();
  });
  watchSystemTheme(() => applyAppearance(store.get('settings')));
  window.addEventListener('hashchange', () => render({ animate: true }));

  askAgeIfNeeded();
}

start();
