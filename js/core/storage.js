// Lesen und Schreiben der Sammlungen, Migration, Export und Import.
// Schlüssel im Browser: lifeos:<sammlung>. Die Schnittstelle ist async,
// damit der Wechsel auf IndexedDB später keine Aufrufer anfasst.

import { BACKUP_LIMIT, SCHEMA_VERSION, STORAGE_PREFIX, defaultCollections } from '../config.js';
import { EXPORTED, SCHEMAS } from './schemas.js';
import { validate } from './validate.js';

export class StorageError extends Error {}
export class ImportError extends Error {}

// Migrationsschritte: Schlüssel n macht aus Version n die Version n+1
// und bekommt alle geladenen Sammlungen als Objekt.
export const MIGRATIONS = {};

export function createStorage(
  backend = globalThis.localStorage,
  { migrations = MIGRATIONS, targetVersion = SCHEMA_VERSION } = {},
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
  function makeBackup(collections) {
    const stamp = new Date().toISOString();
    writeRaw(`${STORAGE_PREFIX}backup:${stamp}`, JSON.stringify(collections));
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

  function migrate(data, problems) {
    const from = data.meta?.schemaVersion;
    if (!Number.isInteger(from) || from >= targetVersion) {
      if (Number.isInteger(from) && from > targetVersion) {
        problems.push('Die Daten stammen aus einer neueren Version von LifeOS. Ändern ist riskant.');
      }
      return;
    }
    const backupStamp = makeBackup(data);
    const working = structuredClone(data);
    try {
      for (let version = from; version < targetVersion; version += 1) {
        const step = migrations[version];
        if (!step) throw new Error(`Migrationsschritt ${version} fehlt`);
        step(working);
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
    const data = {};
    for (const name of EXPORTED) {
      if (!(name in file.collections)) throw new ImportError(`In der Datei fehlt "${name}".`);
      const errors = validate(file.collections[name], SCHEMAS[name], name);
      if (errors.length) throw new ImportError(`Die Datei ist beschädigt: ${errors[0]}`);
      data[name] = file.collections[name];
    }
    // Ältere Exporte durchlaufen dieselbe Migration wie lokale Daten.
    const problems = [];
    migrate(data, problems);
    if (problems.length) throw new ImportError(problems[0]);
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
