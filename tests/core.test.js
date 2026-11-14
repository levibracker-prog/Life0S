import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, ImportError } from '../js/core/storage.js';
import { createStore, ValidationError } from '../js/core/store.js';
import { validate } from '../js/core/validate.js';
import { defaultCollections, UNDO_LIMIT, UNDO_BYTES_LIMIT } from '../js/config.js';
import { contrast, derivePaper, mix, resolvePaper, paperColor } from '../js/core/colors.js';
import { fitSize } from '../js/ui/image.js';
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
  const text = storage.exportAll(store.snapshot());
  const imported = storage.parseImport(text);
  assert.equal(imported.settings.accent, '#112233');
  assert.equal(imported.meta.ageGroup, 'unset');
});

test('Import lehnt kaputte Dateien mit lesbarer Meldung ab', async () => {
  const { storage, store } = await freshStore();
  const good = JSON.parse(storage.exportAll(store.snapshot()));
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
  await storage.importAll(store.snapshot(), {
    meta: imported.meta,
    settings: imported.settings,
    backgroundImage: imported.backgroundImage,
    dashboard: imported.dashboard,
  });
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
    targetVersion: 3,
    migrations: { 2: (data) => { data.settings.density = 'compact'; } },
  });
  const { data, problems } = await storage.loadAll();
  assert.deepEqual(problems, []);
  assert.equal(data.meta.schemaVersion, 3);
  assert.equal(data.settings.density, 'compact');
  assert.ok([...backend.map.keys()].some((k) => k.startsWith('lifeos:backup:')));
});

test('Migration: Fehler lässt die Daten unverändert und meldet es', async () => {
  const backend = memoryBackend();
  backend.setItem('lifeos:meta', JSON.stringify(defaultCollections().meta));
  const storage = createStorage(backend, {
    targetVersion: 3,
    migrations: { 2: () => { throw new Error('kaputt'); } },
  });
  const { data, problems } = await storage.loadAll();
  assert.equal(data.meta.schemaVersion, 2);
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

// Daten, wie Schritt 2 sie gespeichert hat (Schema 1, ohne Hintergrund).
function version1Data() {
  const current = defaultCollections();
  const { background, ...settings } = current.settings;
  return {
    meta: { ...current.meta, schemaVersion: 1 },
    settings: { ...settings, v: 1, theme: 'dark', accent: 'moos' },
    dashboard: current.dashboard,
  };
}

test('Migration 1 -> 2: Hintergrund kommt dazu, bisherige Einstellungen bleiben', async () => {
  const backend = memoryBackend();
  const old = version1Data();
  for (const [name, value] of Object.entries(old)) backend.setItem(`lifeos:${name}`, JSON.stringify(value));
  const { data, problems } = await createStorage(backend).loadAll();
  assert.deepEqual(problems, []);
  assert.equal(data.meta.schemaVersion, 2);
  assert.equal(data.settings.v, 2);
  assert.equal(data.settings.theme, 'dark');
  assert.equal(data.settings.accent, 'moos');
  assert.deepEqual(data.settings.background, defaultCollections().settings.background);
  assert.equal(data.backgroundImage.dataUrl, '');
  assert.ok([...backend.map.keys()].some((k) => k.startsWith('lifeos:backup:')));
});

test('Import einer Exportdatei aus Schema 1 wird migriert', async () => {
  const storage = createStorage(memoryBackend());
  const old = version1Data();
  const file = JSON.stringify({ app: 'lifeos', exportVersion: 1, schemaVersion: 1, collections: old });
  const imported = storage.parseImport(file);
  assert.equal(imported.settings.background.pattern, 'plain');
  assert.equal(imported.meta.schemaVersion, 2);
  assert.equal(imported.settings.theme, 'dark');
});

test('Hintergrund: Änderung ist rückgängig-fähig und überlebt Neuladen', async () => {
  const { backend, store } = await freshStore();
  await store.transact('Muster: Kariert', ['settings'], (d) => { d.settings.background.pattern = 'grid'; });
  await store.transact('Papier dunkel', ['settings'], (d) => { d.settings.background.paperDark = '#223344'; });
  const { store: reloaded } = await freshStore(backend);
  assert.equal(reloaded.get('settings').background.pattern, 'grid');
  assert.equal(reloaded.get('settings').background.paperDark, '#223344');
  await reloaded.undo();
  assert.equal(reloaded.get('settings').background.paperDark, 'standard');
  assert.equal(reloaded.get('settings').background.pattern, 'grid');
});

test('Hintergrund: ungültige Werte werden abgelehnt', async () => {
  const { store } = await freshStore();
  for (const [key, value] of [['pattern', 'wellen'], ['paperLight', 'rot'], ['paperLight', '#12345'], ['dim', 90], ['dim', 12.5], ['usePhoto', 'ja']]) {
    await assert.rejects(
      store.transact('x', ['settings'], (d) => { d.settings.background[key] = value; }),
      ValidationError,
      `${key}=${value}`,
    );
  }
});

const TINY_JPEG = `data:image/jpeg;base64,${Buffer.from('jpegdaten').toString('base64')}`;

test('Foto: Speichern, Export, Import und Rückgängig inklusive Bild', async () => {
  const { backend, storage, store } = await freshStore();
  await store.transact('Foto', ['settings', 'backgroundImage'], (d) => {
    d.backgroundImage.dataUrl = TINY_JPEG;
    d.backgroundImage.width = 1600;
    d.backgroundImage.height = 900;
    d.settings.background.usePhoto = true;
  });
  const exported = storage.exportAll(store.snapshot());
  const imported = storage.parseImport(exported);
  assert.equal(imported.backgroundImage.dataUrl, TINY_JPEG);
  await store.undo();
  assert.equal(store.get('backgroundImage').dataUrl, '');
  assert.equal(store.get('settings').background.usePhoto, false);
  const { store: reloaded } = await freshStore(backend);
  assert.equal(reloaded.get('backgroundImage').dataUrl, '');
});

test('Foto: kein Bild-Format außer JPEG, keine Einschleusung über die Data-URL', async () => {
  const { store } = await freshStore();
  const bad = [
    'data:image/png;base64,AAAA',
    'data:text/html;base64,AAAA',
    'javascript:alert(1)',
    'data:image/jpeg;base64,AAAA");background:url("http://x',
    'http://example.com/a.jpg',
  ];
  for (const dataUrl of bad) {
    await assert.rejects(
      store.transact('x', ['backgroundImage'], (d) => { d.backgroundImage.dataUrl = dataUrl; }),
      ValidationError,
      dataUrl,
    );
  }
});

test('Foto: zu große Data-URL wird abgelehnt, auch im Import', async () => {
  const { storage, store } = await freshStore();
  const huge = `data:image/jpeg;base64,${'A'.repeat(900_000)}`;
  await assert.rejects(
    store.transact('x', ['backgroundImage'], (d) => { d.backgroundImage.dataUrl = huge; }),
    ValidationError,
  );
  const good = JSON.parse(storage.exportAll(store.snapshot()));
  good.collections.backgroundImage.dataUrl = huge;
  assert.throws(() => storage.parseImport(JSON.stringify(good)), ImportError);
});

test('Backup enthält das Foto nicht', async () => {
  const { backend, storage, store } = await freshStore();
  await store.transact('Foto', ['backgroundImage'], (d) => { d.backgroundImage.dataUrl = TINY_JPEG; });
  const stamp = storage.makeBackup(store.snapshot());
  const saved = JSON.parse(backend.getItem(`lifeos:backup:${stamp}`));
  assert.equal('backgroundImage' in saved, false);
});

test('Rückgängig-Protokoll ist zusätzlich nach Größe begrenzt, der neueste Eintrag bleibt', async () => {
  const { store } = await freshStore();
  const big = `data:image/jpeg;base64,${'A'.repeat(700_000)}`;
  for (let i = 0; i < 6; i += 1) {
    await store.transact(`Foto ${i}`, ['backgroundImage'], (d) => {
      d.backgroundImage.dataUrl = i % 2 ? big : `${big.slice(0, -4)}BBBB`;
    });
  }
  const log = store.get('undoLog');
  assert.ok(log.length >= 1 && log.length < 6);
  assert.ok(JSON.stringify(log).length <= UNDO_BYTES_LIMIT || log.length === 1);
  assert.equal(log.at(-1).label, 'Foto 5');
});

test('Bildgröße: längere Seite höchstens 1600, Verhältnis bleibt, kleine bleiben', () => {
  assert.deepEqual(fitSize(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(fitSize(3000, 4000, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(fitSize(800, 600, 1600), { width: 800, height: 600 });
  assert.deepEqual(fitSize(10000, 1, 1600), { width: 1600, height: 1 });
});

test('Papier: freie Farben werden so angepasst, dass Text lesbar bleibt', () => {
  const accent = '#A93818';
  const black = resolvePaper('#000000', 'light', { accent });
  assert.equal(black.adjusted, true);
  assert.equal(black.readable, true);
  assert.ok(contrast('#5E5A52', black.set.paper) >= 4.5);
  const white = resolvePaper('#FFFFFF', 'dark', { accent: '#EE7B54' });
  assert.equal(white.adjusted, true);
  assert.equal(white.readable, true);
  assert.ok(contrast('#A39D8E', white.set.paper) >= 4.5);
  const standard = resolvePaper(paperColor('standard', 'light'), 'light', { accent });
  assert.equal(standard.adjusted, false);
});

test('Papier: abgeleitete Standardflächen liegen nahe an style.css', () => {
  const light = derivePaper('#F5F1E8', 'light');
  assert.ok(contrast(light.raised, '#FBF9F3') < 1.02);
  assert.ok(contrast(light.sunk, '#ECE6D8') < 1.03);
  const dark = derivePaper('#15140F', 'dark');
  assert.ok(contrast(dark.raised, '#1F1D17') < 1.05);
  assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080');
});
