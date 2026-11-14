// Schemas der gespeicherten Sammlungen. Jedes Modul ergänzt später seine
// eigenen Sammlungen hier oder über registry.addModule.

import {
  ACCENTS, AGE_GROUPS, DENSITIES, DIM_MAX, DIM_MIN, FONT_SCALES, IMAGE_MAX_DATAURL_CHARS,
  MOVABLE_SCREENS, PAPERS, PATTERNS, THEMES,
} from '../config.js';

const isoTime = { type: 'string', max: 40, min: 10 };
const id = { type: 'string', min: 1, max: 64 };

const accent = {
  type: 'string',
  max: 12,
  // Vorgabe-ID oder frei gewählte Farbe im Format #rrggbb
  pattern: new RegExp(`^(${ACCENTS.map((a) => a.id).join('|')}|#[0-9a-fA-F]{6})$`),
};

const paperIds = [...new Set([...PAPERS.light, ...PAPERS.dark].map((p) => p.id))];
const paper = {
  type: 'string',
  max: 12,
  // Vorgabe-ID oder frei gewählte Farbe im Format #rrggbb
  pattern: new RegExp(`^(${paperIds.join('|')}|#[0-9a-fA-F]{6})$`),
};

const background = {
  type: 'object',
  required: ['paperLight', 'paperDark', 'pattern', 'usePhoto', 'dim'],
  props: {
    paperLight: paper,
    paperDark: paper,
    pattern: { type: 'string', enum: PATTERNS.map((p) => p.id) },
    usePhoto: { type: 'boolean' },
    dim: { type: 'number', integer: true, min: DIM_MIN, max: DIM_MAX },
  },
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
    required: ['v', 'theme', 'accent', 'density', 'fontScale', 'navItems', 'enabledModules', 'reminders', 'background'],
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
      background,
    },
  },
  // Das Foto liegt getrennt von settings, damit jede Einstellungsänderung
  // nicht das ganze Bild neu schreibt.
  backgroundImage: {
    type: 'object',
    required: ['v', 'dataUrl', 'width', 'height'],
    props: {
      v: { type: 'number', integer: true, min: 1 },
      dataUrl: {
        type: 'string',
        max: IMAGE_MAX_DATAURL_CHARS,
        pattern: /^(data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2})?$/,
      },
      width: { type: 'number', integer: true, min: 0, max: 4000 },
      height: { type: 'number', integer: true, min: 0, max: 4000 },
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
export const EXPORTED = ['meta', 'settings', 'backgroundImage', 'dashboard'];
