// Konstanten und Standardwerte. Alles, was sich ohne Logikänderung
// anpassen lässt, steht hier und nirgends sonst.

export const SCHEMA_VERSION = 2;
export const STORAGE_PREFIX = 'lifeos:';
export const UNDO_LIMIT = 20;
export const BACKUP_LIMIT = 3;
export const TOAST_MS = 6000;

// Das Rückgängig-Protokoll darf nicht beliebig wachsen, weil ein Eintrag
// mit Foto bis zu ~0,8 Mio. Zeichen groß ist (LocalStorage: rund 5 Mio.).
export const UNDO_BYTES_LIMIT = 1_500_000;

// Hintergrundfoto: wird beim Hochladen verkleinert und als JPEG gespeichert.
export const IMAGE_MAX_SIDE = 1600;
export const IMAGE_FALLBACK_SIDES = [1600, 1280, 1024];
export const IMAGE_QUALITIES = [0.82, 0.72, 0.62, 0.52];
export const IMAGE_MAX_BYTES = 600_000;
export const IMAGE_MAX_DATAURL_CHARS = 820_000;
export const IMAGE_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const IMAGE_MAX_PIXELS = 80_000_000;

// Akzentfarben mit je einem Wert für hellen und dunklen Hintergrund.
// Beide Werte erreichen mindestens 4,5:1 gegen --paper (tools/kontrast.mjs).
export const ACCENTS = [
  { id: 'terrakotta', name: 'Terrakotta', light: '#A93818', dark: '#EE7B54' },
  { id: 'tinte', name: 'Tinte', light: '#2F4A7A', dark: '#8FB0E8' },
  { id: 'moos', name: 'Moos', light: '#46663A', dark: '#9CC084' },
  { id: 'senf', name: 'Senf', light: '#7D5600', dark: '#E0B040' },
  { id: 'pflaume', name: 'Pflaume', light: '#7A2F5E', dark: '#D68AB9' },
  { id: 'schiefer', name: 'Schiefer', light: '#3A5559', dark: '#8DB5BA' },
];

// Papierfarben je Theme. "standard" nimmt die Werte aus css/style.css.
export const PAPERS = {
  light: [
    { id: 'standard', name: 'Papier', color: '#F5F1E8' },
    { id: 'weiss', name: 'Weiß', color: '#FBFAF7' },
    { id: 'creme', name: 'Creme', color: '#F6EDD6' },
    { id: 'salbei', name: 'Salbei', color: '#E7EDE0' },
    { id: 'nebel', name: 'Nebel', color: '#E6EBEF' },
    { id: 'rose', name: 'Rosé', color: '#F3E4DE' },
  ],
  dark: [
    { id: 'standard', name: 'Tinte', color: '#15140F' },
    { id: 'schiefer', name: 'Schiefer', color: '#181D22' },
    { id: 'tanne', name: 'Tanne', color: '#131A15' },
    { id: 'aubergine', name: 'Aubergine', color: '#1B151B' },
    { id: 'kohle', name: 'Kohle', color: '#0C0C0B' },
  ],
};

export const PATTERNS = [
  { id: 'plain', name: 'Blanko' },
  { id: 'grid', name: 'Kariert' },
  { id: 'lined', name: 'Liniert' },
  { id: 'dots', name: 'Punkte' },
];

// Wie stark ein Muster-Strich zur Tintenfarbe hin mischt (muss zu
// --pattern-line in css/style.css passen) und wie deckend das "Blatt"
// über einem Foto ist. Beides geht in die Kontrastprüfung ein.
export const PATTERN_SHARE = 0.06;
// Ein Strich mischt 6 % Tinte ein. Beim karierten Muster überlagern sich an den
// Kreuzungen zwei Striche, dort ist der Anteil entsprechend höher.
export const PATTERN_SHARE_BY_PATTERN = {
  plain: 0,
  grid: 1 - (1 - PATTERN_SHARE) ** 2,
  lined: PATTERN_SHARE,
  dots: PATTERN_SHARE,
};
export const SHEET_ALPHA = 0.96;
export const DIM_MIN = 0;
export const DIM_MAX = 80;

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

export function defaultBackground() {
  return {
    paperLight: 'standard',
    paperDark: 'standard',
    pattern: 'plain',
    usePhoto: false,
    dim: 35,
  };
}

export function defaultCollections(now = new Date()) {
  return {
    meta: {
      v: 1,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now.toISOString(),
      ageGroup: 'unset',
    },
    settings: {
      v: 2,
      theme: 'system',
      accent: 'terrakotta',
      density: 'normal',
      fontScale: 1,
      navItems: [...MOVABLE_SCREENS],
      enabledModules: [],
      reminders: [],
      background: defaultBackground(),
    },
    backgroundImage: { v: 1, dataUrl: '', width: 0, height: 0 },
    dashboard: { v: 1, widgets: [] },
    undoLog: [],
  };
}
