import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, ImportError } from '../js/core/storage.js';
import { createStore, ValidationError } from '../js/core/store.js';
import { validate } from '../js/core/validate.js';
import { defaultCollections, UNDO_LIMIT } from '../js/config.js';
import { SCHEMAS } from '../js/core/schemas.js';

function memoryBackend({ failWritesAfter = Infinity } = {}) {
  const map = new Map();
  let writes = 0;
  return {
    map,
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      writes += 1;
      if (writes > failWritesAfter) throw new Error('QuotaExceededError');
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
  };
}

async function freshStore(backend = memoryBackend()) {
  const storage = createStorage(backend);
  const store = createStore(storage);
  await store.init();
  return { backend, storage, store };
}

test('Standardwerte sind gültig', () => {
  for (const [name, value] of Object.entries(defaultCollections())) {
    assert.deepEqual(validate(value, SCHEMAS[name], name), [], name);
  }
});

test('Änderung wird gespeichert und überlebt Neuladen', async () => {
  const { backend, store } = await freshStore();
  await store.transact('Theme: Dunkel', ['settings'], (d) => { d.settings.theme = 'dark'; });
  const { store: reloaded } = await freshStore(backend);
  assert.equal(reloaded.get('settings').theme, 'dark');
});

test('Rückgängig stellt den alten Stand her, auch nach Neuladen', async () => {
  const { backend, store } = await freshStore();
  await store.transact('Theme: Dunkel', ['settings'], (d) => { d.settings.theme = 'dark'; });
  await store.transact('Dichte: Kompakt', ['settings'], (d) => { d.settings.density = 'compact'; });
  const entry = await store.undo();
  assert.equal(entry.label, 'Dichte: Kompakt');
  assert.equal(store.get('settings').density, 'normal');
  assert.equal(store.get('settings').theme, 'dark');
  const { store: reloaded } = await freshStore(backend);
  assert.equal(reloaded.get('settings').density, 'normal');
  assert.equal(reloaded.get('undoLog').length, 1);
});

test('Rückgängig ohne Eintrag gibt null zurück', async () => {
  const { store } = await freshStore();
  assert.equal(await store.undo(), null);
});

test('Unveränderte Daten erzeugen keinen Rückgängig-Eintrag', async () => {
  const { store } = await freshStore();
  const result = await store.transact('nichts', ['settings'], (d) => { d.settings.theme = 'system'; });
  assert.equal(result, null);
  assert.equal(store.get('undoLog').length, 0);
});

test('Ungültige Änderung wird abgelehnt und nichts gespeichert', async () => {
  const { backend, store } = await freshStore();
  await assert.rejects(
    store.transact('kaputt', ['settings'], (d) => { d.settings.theme = 'neon'; }),
    ValidationError,
  );
  assert.equal(store.get('settings').theme, 'system');
  assert.equal(backend.getItem('lifeos:settings'), null);
});

test('Gelesene Daten sind schreibgeschützt', async () => {
  const { store } = await freshStore();
  assert.throws(() => { 'use strict'; store.get('settings').theme = 'dark'; }, TypeError);
});

test('Rückgängig-Protokoll ist auf UNDO_LIMIT begrenzt', async () => {
  const { store } = await freshStore();
  for (let i = 0; i < UNDO_LIMIT + 5; i += 1) {
    await store.transact(`Wechsel ${i}`, ['settings'], (d) => {
      d.settings.theme = d.settings.theme === 'dark' ? 'light' : 'dark';
    });
  }
  assert.equal(store.get('undoLog').length, UNDO_LIMIT);
});

test('nicht rückgängig machbare Änderung schreibt keinen Eintrag', async () => {
  const { store } = await freshStore();
  await store.transact('Alter', ['meta'], (d) => { d.meta.ageGroup = 'adult'; }, { undoable: false });
  assert.equal(store.get('undoLog').length, 0);
  assert.equal(store.get('meta').ageGroup, 'adult');
});

test('Speicher voll: Fehler, Zustand bleibt unverändert', async () => {
  const backend = memoryBackend({ failWritesAfter: 0 });
  const store = createStore(createStorage(backend));
  await store.init();
  await assert.rejects(store.transact('x', ['settings'], (d) => { d.settings.theme = 'dark'; }), /Speichern fehlgeschlagen/);
  assert.equal(store.get('settings').theme, 'system');
});

test('Teilweise geschriebene Änderung wird zurückgerollt', async () => {
  const backend = memoryBackend();
  const store = createStore(createStorage(backend));
  await store.init();
  await store.transact('a', ['settings'], (d) => { d.settings.theme = 'light'; });
  // Nächster Schreibvorgang (meta) klappt, der zweite (settings) scheitert.
  const real = backend.setItem;
  let calls = 0;
  backend.setItem = (k, v) => { calls += 1; if (calls === 2) throw new Error('voll'); real(k, v); };
  await assert.rejects(store.transact('b', ['meta', 'settings'], (d) => {
    d.meta.ageGroup = 'adult';
    d.settings.theme = 'dark';
  }));
  backend.setItem = real;
  const { store: reloaded } = await freshStore(backend);
  assert.equal(reloaded.get('meta').ageGroup, 'unset');
  assert.equal(reloaded.get('settings').theme, 'light');
});

test('Kaputtes JSON im Speicher: App startet, Kopie bleibt erhalten', async () => {
  const backend = memoryBackend();
  backend.setItem('lifeos:settings', '{kaputt');
  const storage = createStorage(backend);
  const { data, problems } = await storage.loadAll();
  assert.equal(data.settings.theme, 'system');
  assert.equal(problems.length, 1);
  assert.ok([...backend.map.keys()].some((k) => k.startsWith('lifeos:defekt:settings')));
});

test('Gültiges JSON mit falschem Inhalt wird zurückgesetzt', async () => {
  const backend = memoryBackend();
  backend.setItem('lifeos:settings', JSON.stringify({ v: 1, theme: 'neon' }));
  const { data, problems } = await createStorage(backend).loadAll();
  assert.equal(data.settings.theme, 'system');
  assert.equal(problems.length, 1);
});

test('Export und Import ergeben dieselben Daten', async () => {
  const { storage, store } = await freshStore();
  await store.transact('t', ['settings'], (d) => { d.settings.accent = '#112233'; });
  const text = storage.exportAll({
    meta: store.get('meta'), settings: store.get('settings'), dashboard: store.get('dashboard'),
  });
  const imported = storage.parseImport(text);
  assert.equal(imported.settings.accent, '#112233');
  assert.equal(imported.meta.ageGroup, 'unset');
});

test('Import lehnt kaputte Dateien mit lesbarer Meldung ab', async () => {
  const { storage, store } = await freshStore();
  const good = JSON.parse(storage.exportAll({
    meta: store.get('meta'), settings: store.get('settings'), dashboard: store.get('dashboard'),
  }));
  const cases = {
    'kein JSON': 'das ist nichts',
    'leere Datei': '',
    'fremdes JSON': '{"a":1}',
    'null': 'null',
    'Sammlung fehlt': JSON.stringify({ ...good, collections: { meta: good.collections.meta } }),
    'falscher Wert': JSON.stringify({ ...good, collections: { ...good.collections, settings: { ...good.collections.settings, theme: 'neon' } } }),
    'neuere Version': JSON.stringify({ ...good, schemaVersion: 99 }),
    'unbekanntes Feld': JSON.stringify({ ...good, collections: { ...good.collections, meta: { ...good.collections.meta, boese: 1 } } }),
  };
  for (const [name, text] of Object.entries(cases)) {
    assert.throws(() => storage.parseImport(text), ImportError, name);
  }
});

test('Import ersetzt Daten, legt Backup an und leert das Rückgängig-Protokoll', async () => {
  const { backend, storage, store } = await freshStore();
  await store.transact('t', ['settings'], (d) => { d.settings.theme = 'dark'; });
  const imported = defaultCollections();
  imported.settings.density = 'compact';
  await storage.importAll(
    { meta: store.get('meta'), settings: store.get('settings'), dashboard: store.get('dashboard') },
    { meta: imported.meta, settings: imported.settings, dashboard: imported.dashboard },
  );
  const { store: reloaded } = await freshStore(backend);
  assert.equal(reloaded.get('settings').density, 'compact');
  assert.equal(reloaded.get('settings').theme, 'system');
  assert.equal(reloaded.get('undoLog').length, 0);
  assert.ok([...backend.map.keys()].some((k) => k.startsWith('lifeos:backup:')));
});

test('Migration: Schritte laufen der Reihe nach, Backup entsteht', async () => {
  const backend = memoryBackend();
  const old = defaultCollections();
  backend.setItem('lifeos:meta', JSON.stringify(old.meta));
  const storage = createStorage(backend, {
    targetVersion: 2,
    migrations: { 1: (data) => { data.settings.density = 'compact'; } },
  });
  const { data, problems } = await storage.loadAll();
  assert.deepEqual(problems, []);
  assert.equal(data.meta.schemaVersion, 2);
  assert.equal(data.settings.density, 'compact');
  assert.ok([...backend.map.keys()].some((k) => k.startsWith('lifeos:backup:')));
});

test('Migration: Fehler lässt die Daten unverändert und meldet es', async () => {
  const backend = memoryBackend();
  backend.setItem('lifeos:meta', JSON.stringify(defaultCollections().meta));
  const storage = createStorage(backend, {
    targetVersion: 2,
    migrations: { 1: () => { throw new Error('kaputt'); } },
  });
  const { data, problems } = await storage.loadAll();
  assert.equal(data.meta.schemaVersion, 1);
  assert.match(problems[0], /migration/i);
});

test('Validierung: Grenzen und unbekannte Felder', () => {
  const schema = { type: 'object', props: { n: { type: 'number', min: 1, max: 3, integer: true } } };
  assert.equal(validate({ n: 2 }, schema).length, 0);
  assert.equal(validate({ n: 4 }, schema).length, 1);
  assert.equal(validate({ n: 1.5 }, schema).length, 1);
  assert.equal(validate({ n: NaN }, schema).length, 1);
  assert.equal(validate({ n: 1, x: 1 }, schema).length, 1);
  assert.equal(validate([], schema).length, 1);
});
