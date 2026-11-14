import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, ImportError } from '../js/core/storage.js';
import { createStore, ValidationError } from '../js/core/store.js';
import { validate } from '../js/core/validate.js';
import { defaultCollections, SCHEMA_VERSION, UNDO_LIMIT, UNDO_BYTES_LIMIT } from '../js/config.js';
import {
  contrast, hexToHsl, hexToHsv, hsvToHex, mix, normalizeHex, accentFor,
} from '../js/core/colors.js';
import {
  derivePaper, gradientCss, gradientSamples, previewColors, resolveAppearance, schemeFor, tintFor,
} from '../js/core/appearance.js';
import {
  BUILTIN_DESIGNS, applyDesign, designFromSettings, isActive,
} from '../js/core/designs.js';
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


const bgOf = (colors, extra = {}) => ({
  gradient: { type: 'linear', angle: 160, colors, ...extra.gradient },
  paper: 'standard',
  pattern: 'plain',
  usePhoto: false,
  dim: 35,
  ...extra.background,
});

test('Standardwerte sind gültig', () => {
  for (const [name, value] of Object.entries(defaultCollections())) {
    assert.deepEqual(validate(value, SCHEMAS[name], name), [], name);
  }
});

test('Änderung wird gespeichert und überlebt Neuladen', async () => {
  const { backend, store } = await freshStore();
  await store.transact('Dichte: Kompakt', ['settings'], (d) => { d.settings.density = 'compact'; });
  const { store: reloaded } = await freshStore(backend);
  assert.equal(reloaded.get('settings').density, 'compact');
});

test('Rückgängig stellt den alten Stand her, auch nach Neuladen', async () => {
  const { backend, store } = await freshStore();
  await store.transact('Akzent: Moos', ['settings'], (d) => { d.settings.accent = 'moos'; });
  await store.transact('Dichte: Kompakt', ['settings'], (d) => { d.settings.density = 'compact'; });
  const entry = await store.undo();
  assert.equal(entry.label, 'Dichte: Kompakt');
  assert.equal(store.get('settings').density, 'normal');
  assert.equal(store.get('settings').accent, 'moos');
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
  const result = await store.transact('nichts', ['settings'], (d) => { d.settings.density = 'normal'; });
  assert.equal(result, null);
  assert.equal(store.get('undoLog').length, 0);
});

test('Ungültige Änderung wird abgelehnt und nichts gespeichert', async () => {
  const { backend, store } = await freshStore();
  await assert.rejects(
    store.transact('kaputt', ['settings'], (d) => { d.settings.density = 'riesig'; }),
    ValidationError,
  );
  assert.equal(store.get('settings').density, 'normal');
  assert.equal(backend.getItem('lifeos:settings'), null);
});

test('Gelesene Daten sind schreibgeschützt', async () => {
  const { store } = await freshStore();
  assert.throws(() => { 'use strict'; store.get('settings').density = 'compact'; }, TypeError);
});

test('Rückgängig-Protokoll ist auf UNDO_LIMIT begrenzt', async () => {
  const { store } = await freshStore();
  for (let i = 0; i < UNDO_LIMIT + 5; i += 1) {
    await store.transact(`Wechsel ${i}`, ['settings'], (d) => {
      d.settings.density = d.settings.density === 'compact' ? 'normal' : 'compact';
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
  await assert.rejects(store.transact('x', ['settings'], (d) => { d.settings.density = 'compact'; }), /Speichern fehlgeschlagen/);
  assert.equal(store.get('settings').density, 'normal');
});

test('Teilweise geschriebene Änderung wird zurückgerollt', async () => {
  const backend = memoryBackend();
  const store = createStore(createStorage(backend));
  await store.init();
  await store.transact('a', ['settings'], (d) => { d.settings.accent = 'moos'; });
  const real = backend.setItem;
  let calls = 0;
  backend.setItem = (k, v) => { calls += 1; if (calls === 2) throw new Error('voll'); real(k, v); };
  await assert.rejects(store.transact('b', ['meta', 'settings'], (d) => {
    d.meta.ageGroup = 'adult';
    d.settings.accent = 'tinte';
  }));
  backend.setItem = real;
  const { store: reloaded } = await freshStore(backend);
  assert.equal(reloaded.get('meta').ageGroup, 'unset');
  assert.equal(reloaded.get('settings').accent, 'moos');
});

test('Kaputtes JSON im Speicher: App startet, Kopie bleibt erhalten', async () => {
  const backend = memoryBackend();
  backend.setItem('lifeos:settings', '{kaputt');
  const { data, problems } = await createStorage(backend).loadAll();
  assert.equal(data.settings.density, 'normal');
  assert.equal(problems.length, 1);
  assert.ok([...backend.map.keys()].some((k) => k.startsWith('lifeos:defekt:settings')));
});

test('Gültiges JSON mit falschem Inhalt wird zurückgesetzt', async () => {
  const backend = memoryBackend();
  backend.setItem('lifeos:settings', JSON.stringify({ v: 3, density: 'riesig' }));
  const { data, problems } = await createStorage(backend).loadAll();
  assert.equal(data.settings.density, 'normal');
  assert.equal(problems.length, 1);
});

test('Export und Import ergeben dieselben Daten', async () => {
  const { storage, store } = await freshStore();
  await store.transact('t', ['settings'], (d) => { d.settings.accent = '#112233'; });
  const imported = storage.parseImport(storage.exportAll(store.snapshot()));
  assert.equal(imported.settings.accent, '#112233');
  assert.equal(imported.meta.ageGroup, 'unset');
  assert.deepEqual(imported.designs, []);
});

test('Import lehnt kaputte Dateien mit lesbarer Meldung ab', async () => {
  const { storage, store } = await freshStore();
  const good = JSON.parse(storage.exportAll(store.snapshot()));
  const withSettings = (patch) => JSON.stringify({
    ...good, collections: { ...good.collections, settings: { ...good.collections.settings, ...patch } },
  });
  const cases = {
    'kein JSON': 'das ist nichts',
    'leere Datei': '',
    'fremdes JSON': '{"a":1}',
    'null': 'null',
    'Sammlung fehlt': JSON.stringify({ ...good, collections: { meta: good.collections.meta } }),
    'falscher Wert': withSettings({ density: 'riesig' }),
    'neuere Version': JSON.stringify({ ...good, schemaVersion: 99 }),
    'unbekanntes Feld': JSON.stringify({ ...good, collections: { ...good.collections, meta: { ...good.collections.meta, boese: 1 } } }),
    'Verlauf mit 5 Farben': withSettings({ background: { ...good.collections.settings.background, gradient: { type: 'linear', angle: 0, colors: ['#111111', '#222222', '#333333', '#444444', '#555555'] } } }),
    'Verlauf ohne Farben': withSettings({ background: { ...good.collections.settings.background, gradient: { type: 'linear', angle: 0, colors: [] } } }),
  };
  for (const [name, text] of Object.entries(cases)) {
    assert.throws(() => storage.parseImport(text), ImportError, name);
  }
});

test('Import ersetzt Daten, legt Backup an und leert das Rückgängig-Protokoll', async () => {
  const { backend, storage, store } = await freshStore();
  await store.transact('t', ['settings'], (d) => { d.settings.accent = 'moos'; });
  const imported = defaultCollections();
  imported.settings.density = 'compact';
  await storage.importAll(store.snapshot(), {
    meta: imported.meta,
    settings: imported.settings,
    backgroundImage: imported.backgroundImage,
    designs: imported.designs,
    dashboard: imported.dashboard,
  });
  const { store: reloaded } = await freshStore(backend);
  assert.equal(reloaded.get('settings').density, 'compact');
  assert.equal(reloaded.get('settings').accent, 'terrakotta');
  assert.equal(reloaded.get('undoLog').length, 0);
  assert.ok([...backend.map.keys()].some((k) => k.startsWith('lifeos:backup:')));
});

test('Migration: Schritte laufen der Reihe nach, Backup entsteht', async () => {
  const backend = memoryBackend();
  backend.setItem('lifeos:meta', JSON.stringify(defaultCollections().meta));
  const storage = createStorage(backend, {
    targetVersion: SCHEMA_VERSION + 1,
    migrations: { [SCHEMA_VERSION]: (data) => { data.settings.density = 'compact'; } },
  });
  const { data, problems } = await storage.loadAll();
  assert.deepEqual(problems, []);
  assert.equal(data.meta.schemaVersion, SCHEMA_VERSION + 1);
  assert.equal(data.settings.density, 'compact');
  assert.ok([...backend.map.keys()].some((k) => k.startsWith('lifeos:backup:')));
});

test('Migration: Fehler lässt die Daten unverändert und meldet es', async () => {
  const backend = memoryBackend();
  backend.setItem('lifeos:meta', JSON.stringify(defaultCollections().meta));
  const storage = createStorage(backend, {
    targetVersion: SCHEMA_VERSION + 1,
    migrations: { [SCHEMA_VERSION]: () => { throw new Error('kaputt'); } },
  });
  const { data, problems } = await storage.loadAll();
  assert.equal(data.meta.schemaVersion, SCHEMA_VERSION);
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

// --- Migration von Schema 1 und 2 auf 3 ------------------------------------

function version1Data(theme = 'dark') {
  const current = defaultCollections();
  const { background, ...settings } = current.settings;
  return {
    meta: { ...current.meta, schemaVersion: 1 },
    settings: { ...settings, v: 1, theme, accent: 'moos' },
    dashboard: current.dashboard,
  };
}

function version2Data(theme, background) {
  const current = defaultCollections();
  const { background: ignored, ...settings } = current.settings;
  return {
    meta: { ...current.meta, schemaVersion: 2 },
    settings: {
      ...settings,
      v: 2,
      theme,
      accent: 'tinte',
      background: {
        paperLight: 'standard', paperDark: 'standard', pattern: 'plain', usePhoto: false, dim: 35, ...background,
      },
    },
    backgroundImage: { v: 1, dataUrl: '', width: 0, height: 0 },
    dashboard: current.dashboard,
  };
}

async function loadFrom(data, options = {}) {
  const backend = memoryBackend();
  for (const [name, value] of Object.entries(data)) backend.setItem(`lifeos:${name}`, JSON.stringify(value));
  const result = await createStorage(backend, options).loadAll();
  return { ...result, backend };
}

test('Migration 1 -> 3: Einstellungen bleiben, Thema wird zum Verlauf', async () => {
  const { data, problems, backend } = await loadFrom(version1Data('dark'));
  assert.deepEqual(problems, []);
  assert.equal(data.meta.schemaVersion, 3);
  assert.equal(data.settings.v, 3);
  assert.equal('theme' in data.settings, false);
  assert.equal(data.settings.accent, 'moos');
  assert.deepEqual(data.settings.background.gradient.colors, ['#15140F']);
  assert.equal(schemeFor(data.settings.background.gradient.colors), 'dark');
  assert.equal(data.settings.migrated.theme, 'dark');
  assert.deepEqual(data.designs, []);
  assert.ok([...backend.map.keys()].some((k) => k.startsWith('lifeos:backup:')));
});

test('Migration 2 -> 3: jedes Thema ergibt dasselbe Schema wie vorher', async () => {
  const cases = [
    ['light', false, 'light'],
    ['dark', false, 'dark'],
    ['system', true, 'dark'],
    ['system', false, 'light'],
  ];
  for (const [theme, prefersDark, expected] of cases) {
    const { data, problems } = await loadFrom(version2Data(theme, {}), { prefersDark });
    assert.deepEqual(problems, [], `${theme}/${prefersDark}`);
    assert.equal(schemeFor(data.settings.background.gradient.colors), expected, `${theme}/${prefersDark}`);
    assert.equal(data.settings.background.paper, 'standard');
  }
});

test('Migration 2 -> 3: gewählte Papierfarbe bleibt, die unbenutzte geht nicht verloren', async () => {
  const input = version2Data('dark', { paperLight: 'creme', paperDark: 'tanne', pattern: 'grid', usePhoto: true, dim: 55 });
  const { data } = await loadFrom(input);
  const { background, migrated } = data.settings;
  assert.deepEqual(background.gradient.colors, ['#131A15']);
  assert.equal(background.paper, '#131A15');
  assert.equal(background.pattern, 'grid');
  assert.equal(background.usePhoto, true);
  assert.equal(background.dim, 55);
  assert.deepEqual(migrated, { fromVersion: 2, theme: 'dark', paperLight: 'creme', paperDark: 'tanne' });
  assert.equal(data.settings.accent, 'tinte');
});

test('Migration 2 -> 3: helles Thema mit schwarzem Papier bleibt hell', async () => {
  const { data } = await loadFrom(version2Data('light', { paperLight: '#000000' }));
  assert.equal(schemeFor(data.settings.background.gradient.colors), 'light');
  const { data: darkData } = await loadFrom(version2Data('dark', { paperDark: '#FFFFFF' }));
  assert.equal(schemeFor(darkData.settings.background.gradient.colors), 'dark');
});

test('Migration 2 -> 3: Foto bleibt unverändert erhalten', async () => {
  const input = version2Data('light', { usePhoto: true });
  input.backgroundImage = { v: 1, dataUrl: TINY_JPEG, width: 800, height: 600 };
  const { data } = await loadFrom(input);
  assert.equal(data.backgroundImage.dataUrl, TINY_JPEG);
  assert.equal(data.backgroundImage.width, 800);
});

test('Import: Exportdateien aus Schema 1 und 2 werden migriert', async () => {
  const storage = createStorage(memoryBackend(), { prefersDark: false });
  const v1 = storage.parseImport(JSON.stringify({ app: 'lifeos', schemaVersion: 1, collections: version1Data('light') }));
  assert.equal(v1.settings.v, 3);
  assert.equal(v1.meta.schemaVersion, 3);
  assert.deepEqual(v1.designs, []);
  const v2data = version2Data('dark', { pattern: 'dots' });
  const { dashboard, meta, settings, backgroundImage } = v2data;
  const v2 = storage.parseImport(JSON.stringify({
    app: 'lifeos', schemaVersion: 2, collections: { dashboard, meta, settings, backgroundImage },
  }));
  assert.equal(v2.settings.background.pattern, 'dots');
  assert.equal(schemeFor(v2.settings.background.gradient.colors), 'dark');
  assert.deepEqual(v2.designs, []);
});

// --- Hintergrund, Foto, Designs im Speicher --------------------------------

test('Hintergrund: Änderung ist rückgängig-fähig und überlebt Neuladen', async () => {
  const { backend, store } = await freshStore();
  await store.transact('Muster: Kariert', ['settings'], (d) => { d.settings.background.pattern = 'grid'; });
  await store.transact('Verlauf', ['settings'], (d) => {
    d.settings.background.gradient = { type: 'radial', angle: 0, colors: ['#223344', '#ffeecc'] };
  });
  const { store: reloaded } = await freshStore(backend);
  assert.equal(reloaded.get('settings').background.gradient.type, 'radial');
  await reloaded.undo();
  assert.deepEqual(reloaded.get('settings').background.gradient.colors, ['#F5F1E8']);
  assert.equal(reloaded.get('settings').background.pattern, 'grid');
});

test('Hintergrund: ungültige Werte werden abgelehnt', async () => {
  const { store } = await freshStore();
  const tries = [
    ['gradient', { type: 'conic', angle: 0, colors: ['#111111'] }],
    ['gradient', { type: 'linear', angle: 361, colors: ['#111111'] }],
    ['gradient', { type: 'linear', angle: 10.5, colors: ['#111111'] }],
    ['gradient', { type: 'linear', angle: 0, colors: [] }],
    ['gradient', { type: 'linear', angle: 0, colors: ['#111111', '#222222', '#333333', '#444444', '#555555'] }],
    ['gradient', { type: 'linear', angle: 0, colors: ['rot'] }],
    ['gradient', { type: 'linear', angle: 0, colors: ['#12345'] }],
    ['gradient', { type: 'linear', angle: 0, colors: ['url(x)'] }],
    ['paper', 'rot'],
    ['pattern', 'wellen'],
    ['dim', 90],
    ['usePhoto', 'ja'],
  ];
  for (const [key, value] of tries) {
    await assert.rejects(
      store.transact('x', ['settings'], (d) => { d.settings.background[key] = value; }),
      ValidationError,
      `${key}=${JSON.stringify(value)}`,
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
  const imported = storage.parseImport(storage.exportAll(store.snapshot()));
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
  assert.equal('backgroundImage' in JSON.parse(backend.getItem(`lifeos:backup:${stamp}`)), false);
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

test('Designs: Übernehmen ist ein Schritt und rückgängig-fähig, Foto bleibt gespeichert', async () => {
  const { store } = await freshStore();
  await store.transact('Foto', ['settings', 'backgroundImage'], (d) => {
    d.backgroundImage.dataUrl = TINY_JPEG;
    d.settings.background.usePhoto = true;
  });
  const design = BUILTIN_DESIGNS.find((entry) => entry.id === 'tannenwald');
  await store.transact(`Design: ${design.name}`, ['settings'], (d) => applyDesign(d.settings, design));
  const { settings, backgroundImage } = { settings: store.get('settings'), backgroundImage: store.get('backgroundImage') };
  assert.equal(settings.accent, 'moos');
  assert.equal(settings.background.gradient.type, 'radial');
  assert.equal(settings.background.usePhoto, false);
  assert.equal(backgroundImage.dataUrl, TINY_JPEG);
  assert.ok(isActive(settings, design));
  await store.undo();
  assert.equal(store.get('settings').background.usePhoto, true);
  assert.equal(store.get('settings').accent, 'terrakotta');
});

test('Designs: eigenes Design speichern, in Export und Import, löschen', async () => {
  const { storage, store } = await freshStore();
  await store.transact('Verlauf', ['settings'], (d) => {
    d.settings.background.gradient = { type: 'linear', angle: 45, colors: ['#102030', '#f0e0d0'] };
    d.settings.accent = 'senf';
  });
  const mine = {
    v: 1, id: crypto.randomUUID(), name: 'Abendlicht', createdAt: new Date().toISOString(),
    ...designFromSettings(store.get('settings')),
  };
  await store.transact('Design gespeichert', ['designs'], (d) => { d.designs.push(mine); });
  assert.ok(isActive(store.get('settings'), mine));
  const imported = storage.parseImport(storage.exportAll(store.snapshot()));
  assert.equal(imported.designs[0].name, 'Abendlicht');
  assert.deepEqual(imported.designs[0].background.gradient.colors, ['#102030', '#f0e0d0']);
  await store.transact('Design gelöscht', ['designs'], (d) => { d.designs = []; });
  assert.equal(store.get('designs').length, 0);
  await store.undo();
  assert.equal(store.get('designs').length, 1);
});

test('Designs: ungültige Designs werden abgelehnt', async () => {
  const { store } = await freshStore();
  const base = {
    v: 1, id: 'a', name: 'X', createdAt: new Date().toISOString(), accent: 'moos',
    background: { gradient: { type: 'linear', angle: 0, colors: ['#111111'] }, paper: 'standard', pattern: 'plain' },
  };
  const bad = [
    { ...base, name: '' },
    { ...base, name: 'x'.repeat(41) },
    { ...base, accent: 'neon' },
    { ...base, extra: 1 },
    { ...base, background: { ...base.background, pattern: 'wellen' } },
  ];
  for (const design of bad) {
    await assert.rejects(store.transact('x', ['designs'], (d) => { d.designs.push(design); }), ValidationError);
  }
  await assert.rejects(store.transact('x', ['designs'], (d) => {
    for (let i = 0; i < 21; i += 1) d.designs.push({ ...base, id: String(i) });
  }), ValidationError);
});

// --- Farben und Erscheinungsbild -------------------------------------------

test('Farben: Hex-Eingabe, HSV-Umrechnung', () => {
  assert.equal(normalizeHex('#1a2b3c'), '#1A2B3C');
  assert.equal(normalizeHex('1a2b3c'), '#1A2B3C');
  assert.equal(normalizeHex('#abc'), '#AABBCC');
  for (const bad of ['', '#12', '#12345', '#1234567', 'rot', '#gggggg', 'url(x)']) {
    assert.equal(normalizeHex(bad), null, bad);
  }
  for (const hex of ['#FF0000', '#00FF00', '#3B6FD1', '#808080', '#000000', '#FFFFFF', '#F5F1E8']) {
    const { h, s, v } = hexToHsv(hex);
    assert.equal(hsvToHex(h, s, v), hex);
  }
});

test('Schema folgt der Helligkeit des Verlaufs', () => {
  assert.equal(schemeFor(['#F5F1E8']), 'light');
  assert.equal(schemeFor(['#15140F']), 'dark');
  assert.equal(schemeFor(['#FFE8CC', '#F4A99B']), 'light');
  assert.equal(schemeFor(['#1B1B3A', '#693668']), 'dark');
  assert.equal(schemeFor(['#FFFFFF', '#FFFFFF', '#FFFFFF', '#000000']), 'light');
  assert.equal(schemeFor(['#000000', '#000000', '#000000', '#FFFFFF']), 'dark');
});

test('Verlauf: CSS und Prüfpunkte (jede Farbe und jede Mitte)', () => {
  assert.equal(gradientCss({ type: 'linear', angle: 10, colors: ['#112233'] }), '#112233');
  assert.equal(gradientCss({ type: 'linear', angle: 45, colors: ['#111111', '#222222'] }), 'linear-gradient(45deg, #111111, #222222)');
  assert.match(gradientCss({ type: 'radial', angle: 45, colors: ['#111111', '#222222'] }), /^radial-gradient\(/);
  assert.equal(gradientSamples(['#000000']).length, 1);
  assert.equal(gradientSamples(['#000000', '#FFFFFF']).length, 3);
  assert.equal(gradientSamples(['#000000', '#FFFFFF', '#FF0000', '#00FF00']).length, 7);
  assert.equal(gradientSamples(['#000000', '#FFFFFF'])[2], '#808080');
});

test('Erscheinungsbild: Standard braucht keine Korrektur', () => {
  for (const colors of [['#F5F1E8'], ['#15140F']]) {
    const result = resolveAppearance(bgOf(colors), 'terrakotta');
    assert.equal(result.corrected, false);
    assert.equal(result.warning, false);
    assert.ok(result.ratioAfter >= 4.5);
  }
});

test('Erscheinungsbild: Schwarz-Weiß-Verlauf wird gewarnt und automatisch korrigiert', () => {
  const result = resolveAppearance(bgOf(['#000000', '#FFFFFF']), 'terrakotta');
  assert.equal(result.scheme, 'light');
  assert.equal(result.readable, true);
  assert.ok(result.alpha > 0.9, 'Deckkraft wurde erhöht');
  assert.ok(result.ratioAfter >= 4.5);
  assert.ok(result.worstBefore.ratio < 4.6);
});

test('Erscheinungsbild: Extremfälle bleiben lesbar', () => {
  const gradients = [
    ['#000000'], ['#FFFFFF'], ['#808080'], ['#FF00FF'], ['#FFFF00', '#0000FF', '#FF0000', '#00FF00'],
    ['#000000', '#FFFFFF', '#000000', '#FFFFFF'], ['#777777', '#7A7A7A'],
  ];
  for (const colors of gradients) {
    for (const paper of ['standard', 'creme', '#000000', '#FFFFFF', '#FF00FF']) {
      for (const pattern of ['plain', 'grid']) {
        for (const photo of [false, true]) {
          const result = resolveAppearance(bgOf(colors, { background: { paper, pattern } }), '#FFFF00', { photo });
          assert.equal(result.readable, true, JSON.stringify({ colors, paper, pattern, photo }));
          assert.ok(contrast(result.text.ink, result.surfaces.raised) >= 4.5);
          assert.ok(result.ratioAfter >= 4.5, `${result.ratioAfter}`);
        }
      }
    }
  }
});

test('Papier: Tönung passt sich dem Schema an, Farbton bleibt', () => {
  const light = tintFor('#E6EBEF', 'light');
  const darkTint = tintFor('#E6EBEF', 'dark');
  assert.ok(contrast(light, '#FFFFFF') < 1.25);
  assert.ok(Math.abs(hexToHsl(darkTint).h - hexToHsl('#E6EBEF').h) < 12, 'Farbton bleibt');
  assert.ok(contrast(darkTint, '#000000') < 1.5);
  assert.equal(tintFor('standard', 'light'), '#F5F1E8');
  assert.equal(tintFor('standard', 'dark'), '#15140F');
  const set = derivePaper('#F5F1E8', 'light');
  assert.ok(contrast(set.raised, '#FBF9F3') < 1.02);
  assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080');
});

test('Akzent: freie Farben erreichen auf dem Standardpapier mindestens 6:1', () => {
  for (const color of ['#FFFF00', '#00FFFF', '#000000', '#808080']) {
    assert.ok(contrast(accentFor(color, 'light'), '#F5F1E8') >= 6, color);
    assert.ok(contrast(accentFor(color, 'dark'), '#2A2822') >= 6, color);
  }
  assert.equal(accentFor('terrakotta', 'light'), '#A93818');
});

test('Designs: vier eigenständige Vorgaben, lesbar ohne Korrektur', () => {
  assert.equal(BUILTIN_DESIGNS.length, 4);
  assert.equal(new Set(BUILTIN_DESIGNS.map((d) => d.id)).size, 4);
  assert.equal(new Set(BUILTIN_DESIGNS.map((d) => JSON.stringify(d.background))).size, 4);
  const schemes = new Set();
  for (const design of BUILTIN_DESIGNS) {
    const result = resolveAppearance(design.background, design.accent);
    assert.equal(result.warning, false, design.id);
    assert.equal(result.corrected, false, design.id);
    schemes.add(result.scheme);
    const colors = previewColors(design.background, design.accent);
    assert.ok(colors.backdrop && colors.ink && colors.accent);
    assert.deepEqual(validate({
      v: 1, id: design.id, name: design.name, createdAt: new Date().toISOString(), accent: design.accent, background: design.background,
    }, SCHEMAS.designs.items, design.id), []);
  }
  assert.deepEqual([...schemes].sort(), ['dark', 'light']);
});

test('Designs: einfarbiger Verlauf ignoriert Typ und Winkel beim Vergleich', () => {
  const settings = defaultCollections().settings;
  const notebook = BUILTIN_DESIGNS[0];
  assert.equal(isActive(settings, notebook), true);
  settings.background.gradient.angle = 33;
  settings.background.gradient.type = 'radial';
  assert.equal(isActive(settings, notebook), true);
  settings.background.pattern = 'grid';
  assert.equal(isActive(settings, notebook), false);
});
