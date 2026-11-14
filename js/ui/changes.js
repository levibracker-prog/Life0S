// Gemeinsame Hilfen für Ansichten, die Einstellungen ändern: jede Änderung
// läuft über store.transact und zeigt einen Toast mit "Rückgängig".

import { showToast } from './toast.js';

export function reportError(err) {
  showToast(err.message || 'Das hat nicht geklappt.', { error: true });
}

export async function undoLast({ store }) {
  try {
    const entry = await store.undo();
    if (entry) showToast(`Rückgängig gemacht: ${entry.label}`);
  } catch (err) {
    reportError(err);
  }
}

export function makeChange(ctx) {
  return async function change(label, collections, mutate) {
    try {
      const entry = await ctx.store.transact(label, collections, mutate);
      if (entry) showToast(label, { actionLabel: 'Rückgängig', onAction: () => undoLast(ctx) });
      return entry;
    } catch (err) {
      reportError(err);
      return null;
    }
  };
}
