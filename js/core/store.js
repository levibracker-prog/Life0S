// Zustand im Speicher plus alle Änderungen über eine einzige Stelle:
// transact(). Dort wird validiert, gespeichert, ein Rückgängig-Eintrag
// geschrieben und ein Ereignis ausgelöst. Module schreiben nie direkt.

import { UNDO_BYTES_LIMIT, UNDO_LIMIT } from '../config.js';
import { EXPORTED, SCHEMAS } from './schemas.js';
import { validate } from './validate.js';

export class ValidationError extends Error {
  constructor(errors) {
    super(`Ungültige Änderung: ${errors[0]}`);
    this.errors = errors;
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

// Begrenzt das Protokoll nach Anzahl und nach Größe. Der neueste Eintrag
// bleibt immer, damit die letzte Änderung rückgängig zu machen ist.
function trimLog(log) {
  const trimmed = log.slice(-UNDO_LIMIT);
  while (trimmed.length > 1 && JSON.stringify(trimmed).length > UNDO_BYTES_LIMIT) trimmed.shift();
  return trimmed;
}

const sameData = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createStore(storage) {
  let state = {};
  const listeners = new Set();

  const emit = (event) => listeners.forEach((fn) => fn(event));

  function setState(name, value) {
    state[name] = deepFreeze(structuredClone(value));
  }

  async function init() {
    const { data, problems } = await storage.loadAll();
    state = {};
    for (const [name, value] of Object.entries(data)) setState(name, value);
    emit({ kind: 'load', collections: Object.keys(state) });
    return problems;
  }

  // Gibt die Sammlung schreibgeschützt zurück. Ändern geht nur über transact().
  const get = (name) => state[name];

  const subscribe = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };

  // transact('Dichte: Kompakt', ['settings'], (draft) => { draft.settings.density = 'compact'; })
  // Gibt den Rückgängig-Eintrag zurück, oder null, wenn sich nichts geändert hat.
  async function transact(label, names, mutate, { undoable = true } = {}) {
    const draft = {};
    for (const name of names) draft[name] = structuredClone(state[name]);
    mutate(draft);

    const changed = names.filter((name) => !sameData(draft[name], state[name]));
    if (!changed.length) return null;

    const errors = changed.flatMap((name) => validate(draft[name], SCHEMAS[name], name));
    if (errors.length) throw new ValidationError(errors);

    const entry = {
      v: 1,
      id: crypto.randomUUID(),
      label,
      at: new Date().toISOString(),
      before: Object.fromEntries(changed.map((name) => [name, state[name]])),
    };
    const log = undoable ? trimLog([...state.undoLog, entry]) : state.undoLog;

    await writeAll(changed.map((name) => [name, draft[name]]), undoable ? log : null);

    for (const name of changed) setState(name, draft[name]);
    if (undoable) setState('undoLog', log);
    emit({ kind: 'change', label, collections: changed, entry: undoable ? entry : null });
    return undoable ? entry : null;
  }

  // Schreibt mehrere Sammlungen. Schlägt eine fehl, werden die schon
  // geschriebenen auf den alten Stand zurückgesetzt.
  async function writeAll(pairs, undoLog) {
    const written = [];
    try {
      for (const [name, value] of pairs) {
        await storage.save(name, value);
        written.push(name);
      }
      if (undoLog) await storage.save('undoLog', undoLog);
    } catch (err) {
      for (const name of written) {
        try {
          await storage.save(name, state[name]);
        } catch {
          // Der Speicher ist dann ohnehin defekt. Der erste Fehler wird gemeldet.
        }
      }
      throw err;
    }
  }

  // Die Sammlungen, die in Export und Import gehören.
  const snapshot = () => Object.fromEntries(EXPORTED.map((name) => [name, state[name]]));

  const lastUndoEntry = () => state.undoLog[state.undoLog.length - 1] ?? null;

  async function undo() {
    const entry = lastUndoEntry();
    if (!entry) return null;
    const names = Object.keys(entry.before);
    const log = state.undoLog.slice(0, -1);
    await writeAll(names.map((name) => [name, entry.before[name]]), log);
    for (const name of names) setState(name, entry.before[name]);
    setState('undoLog', log);
    emit({ kind: 'undo', label: entry.label, collections: names });
    return entry;
  }

  // Nach einem Import: Zustand aus dem Speicher neu laden.
  const reload = init;

  return { init, get, snapshot, subscribe, transact, undo, lastUndoEntry, reload };
}
