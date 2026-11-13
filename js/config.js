// Konstanten und Standardwerte. Alles, was sich ohne Logikänderung
// anpassen lässt, steht hier und nirgends sonst.

export const SCHEMA_VERSION = 1;
export const STORAGE_PREFIX = 'lifeos:';
export const UNDO_LIMIT = 20;
export const BACKUP_LIMIT = 3;
export const TOAST_MS = 6000;

// Akzentfarben mit je einem Wert für hellen und dunklen Hintergrund.
// Beide Werte erreichen mindestens 4,5:1 gegen --paper (tools/kontrast.mjs).
export const ACCENTS = [
  { id: 'terrakotta', name: 'Terrakotta', light: '#B63E1A', dark: '#EE7B54' },
  { id: 'tinte', name: 'Tinte', light: '#2F4A7A', dark: '#8FB0E8' },
  { id: 'moos', name: 'Moos', light: '#46663A', dark: '#9CC084' },
  { id: 'senf', name: 'Senf', light: '#8A5F00', dark: '#E0B040' },
  { id: 'pflaume', name: 'Pflaume', light: '#7A2F5E', dark: '#D68AB9' },
  { id: 'schiefer', name: 'Schiefer', light: '#3A5559', dark: '#8DB5BA' },
];

export const THEMES = [
  { id: 'system', name: 'System' },
  { id: 'light', name: 'Hell' },
  { id: 'dark', name: 'Dunkel' },
];

export const DENSITIES = [
  { id: 'normal', name: 'Normal' },
  { id: 'compact', name: 'Kompakt' },
];

export const FONT_SCALES = [
  { id: 0.9, name: 'Klein' },
  { id: 1, name: 'Normal' },
  { id: 1.15, name: 'Groß' },
  { id: 1.3, name: 'Sehr groß' },
];

// Bereiche der Bottom-Bar. Der Agent sitzt immer in der Mitte und
// steht deshalb nicht in navItems.
export const SCREENS = {
  home: 'Home',
  explore: 'Explore',
  agent: 'Agent',
  progress: 'Progress',
  profile: 'Profil',
};
export const MOVABLE_SCREENS = ['home', 'explore', 'progress', 'profile'];

export const AGE_GROUPS = ['unset', 'minor', 'adult'];

export function defaultCollections(now = new Date()) {
  return {
    meta: {
      v: 1,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now.toISOString(),
      ageGroup: 'unset',
    },
    settings: {
      v: 1,
      theme: 'system',
      accent: 'terrakotta',
      density: 'normal',
      fontScale: 1,
      navItems: [...MOVABLE_SCREENS],
      enabledModules: [],
      reminders: [],
    },
    dashboard: { v: 1, widgets: [] },
    undoLog: [],
  };
}
