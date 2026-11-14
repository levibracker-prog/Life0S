// Lesen und Schreiben der Sammlungen, Migration, Export und Import.
// Schlüssel im Browser: lifeos:<sammlung>. Die Schnittstelle ist async,
// damit der Wechsel auf IndexedDB später keine Aufrufer anfasst.

import {
  BACKUP_LIMIT, SCHEMA_VERSION, STANDARD_PAPER, STORAGE_PREFIX, defaultCollections,
} from '../config.js';
import { schemeFor } from './appearance.js';
import { mix } from './colors.js';
import { COLLECTION_SINCE, EXPORTED, SCHEMAS } from './schemas.js';
import { validate } from './validate.js';

export class StorageError extends Error {}
export class ImportError extends Error {}

// Papiervorgaben von Schema 2. Die Migration braucht sie, auch wenn die App
// inzwischen andere Vorgaben kennt.
const PAPERS_V2 = {
  weiss: '#FBFAF7', creme: '#F6EDD6', salbei: '#E7EDE0', nebel: '#E6EBEF', rose: '#F3E4DE',
  schiefer: '#181D22', tanne: '#131A15', aubergine: '#1B151B', kohle: '#0C0C0B',
};

// Zieht eine Farbe in kleinen Schritten Richtung Weiß oder Schwarz, bis das
// neue Verfahren (Schema aus der Helligkeit) dasselbe Schema wählt, das die
// Einstellung vorher hatte. So sieht ein Bestand nach der Migration gleich aus.
function inScheme(hex, scheme) {
  const target = scheme === 'dark' ? '#000000' : '#FFFFFF';
  for (let step = 0; step <= 20; step += 1) {
    const candidate = step === 0 ? hex : mix(hex, target, step / 20);
    if (schemeFor([candidate]) === scheme) return candidate;
  }
  return target;
}

// Migrationsschritte: Schlüssel n macht aus Version n die Version n+1.
// Sie bekommen alle geladenen Sammlungen und einen Kontext ({ prefersDark }).
export const MIGRATIONS = {
  // 1 -> 2: Hintergrund-Einstellungen und Foto-Sammlung kommen dazu.
  1(data) {
    data.settings.background = {
      paperLight: 'standard', paperDark: 'standard', pattern: 'plain', usePhoto: false, dim: 35,
    };
    data.settings.v = 2;
    data.backgroundImage = data.backgroundImage ?? { v: 1, dataUrl: '', width: 0, height: 0 };
  },

  // 2 -> 3: Es gibt nur noch einen Hintergrund. Hell oder dunkel folgt aus dem
  // Verlauf, die Auswahl Hell/Dunkel/System entfällt. Die bisher wirksame
  // Papierfarbe wird zum einfarbigen Verlauf und zur Papiertönung, damit die
  // App gleich aussieht. Nicht mehr gebrauchte Werte bleiben unter
  // settings.migrated erhalten.
  2(data, context) {
    const { settings } = data;
    const old = settings.background;
    const wantsDark = settings.theme === 'dark' || (settings.theme === 'system' && context.prefersDark);
    const scheme = wantsDark ? 'dark' : 'light';
    const chosen = wantsDark ? old.paperDark : old.paperLight;

    let color = STANDARD_PAPER[scheme];
    let paper = 'standard';
    if (chosen !== 'standard') {
      color = chosen.startsWith('#') ? chosen.toUpperCase() : (PAPERS_V2[chosen] ?? color);
      color = inScheme(color, scheme);
      paper = color;
    }
    settings.background = {
      gradient: { type: 'linear', angle: 160, colors: [color] },
      paper,
      pattern: old.pattern,
      usePhoto: old.usePhoto,
      dim: old.dim,
    };
    settings.migrated = {
      fromVersion: 2, theme: settings.theme, paperLight: old.paperLight, paperDark: old.paperDark,
    };
    delete settings.theme;
    settings.v = 3;
    data.designs = data.designs ?? [];
  },
};

export function createStorage(
  backend = globalThis.localStorage,
  {
    migrations = MIGRATIONS,
    targetVersion = SCHEMA_VERSION,
    // Gebraucht nur für Bestände mit Thema "System" aus Schema 2.
    prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  } = {},
) {
  const key = (name) => `${STORAGE_PREFIX}${name}`;

  function readRaw(name) {
    try {
      return backend.getItem(key(name));
    } catch (err) {
      throw new StorageError('Der Speicher des Browsers ist nicht lesbar.', { cause: err });
    }
  }

  function writeRaw(storageKey, text) {
    try {
      backend.setItem(storageKey, text);
    } catch (err) {
      throw new StorageError(
        'Speichern fehlgeschlagen. Möglicherweise ist der Speicher voll oder gesperrt.',
        { cause: err },
      );
    }
  }

  function allKeys() {
    const keys = [];
    for (let i = 0; i < backend.length; i += 1) keys.push(backend.key(i));
    return keys;
  }

  async function save(name, data) {
    writeRaw(key(name), JSON.stringify(data));
  }

  // Legt eine Kopie aller Sammlungen unter lifeos:backup:<zeit> ab
  // und behält nur die letzten BACKUP_LIMIT.
  // Das Hintergrundfoto bleibt draußen: Drei Kopien davon würden den
  // Browser-Speicher sprengen.
  function makeBackup(collections) {
    const stamp = new Date().toISOString();
    const { backgroundImage, ...withoutImage } = collections;
    writeRaw(`${STORAGE_PREFIX}backup:${stamp}`, JSON.stringify(withoutImage));
    const backups = allKeys().filter((k) => k.startsWith(`${STORAGE_PREFIX}backup:`)).sort();
    for (const old of backups.slice(0, Math.max(0, backups.length - BACKUP_LIMIT))) {
      backend.removeItem(old);
    }
    return stamp;
  }

  // Liest alle Sammlungen. Kaputte oder ungültige Sammlungen werden
  // unter lifeos:defekt:<name>:<zeit> aufgehoben und durch Standardwerte
  // ersetzt, damit die App startet. Die Liste "problems" geht an die UI.
  async function loadAll() {
    const defaults = defaultCollections();
    const data = {};
    const problems = [];
    const stamp = new Date().toISOString();

    for (const name of Object.keys(defaults)) {
      const raw = readRaw(name);
      if (raw === null) {
        data[name] = defaults[name];
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = undefined;
      }
      if (parsed === undefined) {
        writeRaw(`${STORAGE_PREFIX}defekt:${name}:${stamp}`, raw);
        data[name] = defaults[name];
        problems.push(`Die Daten "${name}" waren beschädigt und wurden zurückgesetzt. Eine Kopie liegt im Browser-Speicher.`);
        continue;
      }
      data[name] = parsed;
    }

    migrate(data, problems);

    for (const name of Object.keys(defaults)) {
      const errors = validate(data[name], SCHEMAS[name], name);
      if (errors.length) {
        writeRaw(`${STORAGE_PREFIX}defekt:${name}:${stamp}`, JSON.stringify(data[name]));
        data[name] = defaults[name];
        problems.push(`Die Daten "${name}" waren ungültig (${errors[0]}) und wurden zurückgesetzt.`);
      }
    }
    return { data, problems };
  }

  function migrate(data, problems, { backup = true } = {}) {
    const from = data.meta?.schemaVersion;
    if (!Number.isInteger(from) || from >= targetVersion) {
      if (Number.isInteger(from) && from > targetVersion) {
        problems.push('Die Daten stammen aus einer neueren Version von LifeOS. Ändern ist riskant.');
      }
      return;
    }
    const backupStamp = backup ? makeBackup(data) : 'keines';
    const working = structuredClone(data);
    try {
      for (let version = from; version < targetVersion; version += 1) {
        const step = migrations[version];
        if (!step) throw new Error(`Migrationsschritt ${version} fehlt`);
        step(working, { prefersDark });
        working.meta.schemaVersion = version + 1;
      }
    } catch (err) {
      problems.push(`Die Datenmigration ist fehlgeschlagen (${err.message}). Die Daten bleiben unverändert, Backup: ${backupStamp}.`);
      return;
    }
    Object.assign(data, working);
  }

  async function saveAll(collections) {
    for (const [name, value] of Object.entries(collections)) await save(name, value);
  }

  function exportAll(collections) {
    const payload = {};
    for (const name of EXPORTED) payload[name] = collections[name];
    return JSON.stringify({
      app: 'lifeos',
      exportVersion: 1,
      schemaVersion: targetVersion,
      exportedAt: new Date().toISOString(),
      collections: payload,
    }, null, 2);
  }

  // Prüft den Text einer Importdatei und gibt die Sammlungen zurück.
  // Wirft ImportError mit einer Meldung, die der Nutzer lesen kann.
  function parseImport(text) {
    let file;
    try {
      file = JSON.parse(text);
    } catch {
      throw new ImportError('Die Datei ist kein gültiges JSON.');
    }
    if (!file || file.app !== 'lifeos' || typeof file.collections !== 'object' || file.collections === null) {
      throw new ImportError('Die Datei stammt nicht aus LifeOS.');
    }
    if (!Number.isInteger(file.schemaVersion) || file.schemaVersion > targetVersion) {
      throw new ImportError('Die Datei stammt aus einer neueren Version von LifeOS.');
    }
    // Ältere Exporte durchlaufen dieselbe Migration wie lokale Daten, deshalb
    // wird erst migriert und dann gegen das aktuelle Schema geprüft.
    const isOlder = file.schemaVersion < targetVersion;
    const defaults = defaultCollections();
    const data = {};
    for (const name of EXPORTED) {
      if (name in file.collections) data[name] = file.collections[name];
      else if (isOlder && file.schemaVersion < COLLECTION_SINCE[name]) data[name] = defaults[name];
      else throw new ImportError(`In der Datei fehlt "${name}".`);
    }
    if (data.meta && typeof data.meta === 'object') data.meta.schemaVersion = file.schemaVersion;
    const problems = [];
    try {
      migrate(data, problems, { backup: false });
    } catch (err) {
      throw new ImportError(`Die Datei ist beschädigt: ${err.message}`);
    }
    if (problems.length) throw new ImportError(problems[0]);
    for (const name of EXPORTED) {
      const errors = validate(data[name], SCHEMAS[name], name);
      if (errors.length) throw new ImportError(`Die Datei ist beschädigt: ${errors[0]}`);
    }
    return data;
  }

  // Ersetzt die Daten durch den Import. Vorher entsteht ein Backup.
  async function importAll(current, imported) {
    makeBackup(current);
    await saveAll(imported);
    // Alte Rückgängig-Einträge passen nicht mehr zu den neuen Daten.
    await save('undoLog', []);
  }

  async function wipe() {
    for (const k of allKeys().filter((entry) => entry.startsWith(STORAGE_PREFIX))) {
      backend.removeItem(k);
    }
  }

  return { save, saveAll, loadAll, exportAll, parseImport, importAll, wipe, makeBackup };
}
