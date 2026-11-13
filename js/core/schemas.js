// Schemas der gespeicherten Sammlungen. Jedes Modul ergänzt später seine
// eigenen Sammlungen hier oder über registry.addModule.

import { ACCENTS, AGE_GROUPS, FONT_SCALES, MOVABLE_SCREENS, THEMES, DENSITIES } from '../config.js';

const isoTime = { type: 'string', max: 40, min: 10 };
const id = { type: 'string', min: 1, max: 64 };

const accent = {
  type: 'string',
  max: 12,
  // Vorgabe-ID oder frei gewählte Farbe im Format #rrggbb
  pattern: new RegExp(`^(${ACCENTS.map((a) => a.id).join('|')}|#[0-9a-fA-F]{6})$`),
};

export const SCHEMAS = {
  meta: {
    type: 'object',
    required: ['v', 'schemaVersion', 'createdAt', 'ageGroup'],
    props: {
      v: { type: 'number', integer: true, min: 1 },
      schemaVersion: { type: 'number', integer: true, min: 1 },
      createdAt: isoTime,
      ageGroup: { type: 'string', enum: AGE_GROUPS },
    },
  },
  settings: {
    type: 'object',
    required: ['v', 'theme', 'accent', 'density', 'fontScale', 'navItems', 'enabledModules', 'reminders'],
    props: {
      v: { type: 'number', integer: true, min: 1 },
      theme: { type: 'string', enum: THEMES.map((t) => t.id) },
      accent,
      density: { type: 'string', enum: DENSITIES.map((d) => d.id) },
      fontScale: { type: 'number', enum: FONT_SCALES.map((f) => f.id) },
      navItems: {
        type: 'array', min: MOVABLE_SCREENS.length, max: MOVABLE_SCREENS.length, unique: true,
        items: { type: 'string', enum: MOVABLE_SCREENS },
      },
      enabledModules: { type: 'array', max: 50, items: id },
      reminders: { type: 'array', max: 200, items: { type: 'object', props: {}, loose: true } },
    },
  },
  dashboard: {
    type: 'object',
    required: ['v', 'widgets'],
    props: {
      v: { type: 'number', integer: true, min: 1 },
      // Der Inhalt der Widgets wird in Schritt 3 genauer beschrieben.
      widgets: { type: 'array', max: 100, items: { type: 'object', props: {}, loose: true } },
    },
  },
  undoLog: {
    type: 'array',
    max: 50,
    items: {
      type: 'object',
      required: ['v', 'id', 'label', 'at', 'before'],
      props: {
        v: { type: 'number', integer: true, min: 1 },
        id,
        label: { type: 'string', max: 200 },
        at: isoTime,
        before: { type: 'object', props: {}, loose: true },
      },
    },
  },
};

// Sammlungen, die in Export und Import landen. Das Rückgängig-Protokoll
// bleibt bewusst draußen: Es gehört zum Gerät, nicht zu den Daten.
export const EXPORTED = ['meta', 'settings', 'dashboard'];
