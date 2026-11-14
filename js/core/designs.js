// Designs bündeln Hintergrund (Verlauf, Papier, Muster) und Akzentfarbe.
// Die vier mitgelieferten stehen hier, eigene liegen in der Sammlung "designs".
// Ein Foto gehört nicht zum Design: Es ist zu groß, um es mehrfach zu speichern.

export const BUILTIN_DESIGNS = [
  {
    id: 'notizbuch',
    name: 'Notizbuch',
    note: 'Warmes Papier, wie am Anfang.',
    accent: 'terrakotta',
    background: {
      gradient: { type: 'linear', angle: 160, colors: ['#F5F1E8'] },
      paper: 'standard',
      pattern: 'plain',
    },
  },
  {
    id: 'morgenrot',
    name: 'Morgenrot',
    note: 'Heller Himmel, der nach unten dunkler wird.',
    accent: 'pflaume',
    background: {
      gradient: { type: 'linear', angle: 190, colors: ['#FFE8CC', '#F4A99B', '#6F5A9E'] },
      paper: 'creme',
      pattern: 'plain',
    },
  },
  {
    id: 'tannenwald',
    name: 'Tannenwald',
    note: 'Dunkles Grün mit Punkten auf dem Papier.',
    accent: 'moos',
    background: {
      gradient: { type: 'radial', angle: 0, colors: ['#2B5A45', '#12261E', '#0A130F'] },
      paper: 'standard',
      pattern: 'dots',
    },
  },
  {
    id: 'schulheft',
    name: 'Schulheft',
    note: 'Blasses Blau, kariertes Papier.',
    accent: 'tinte',
    background: {
      gradient: { type: 'linear', angle: 135, colors: ['#F1F6FB', '#D3E3F3'] },
      paper: 'weiss',
      pattern: 'grid',
    },
  },
];

// Übernimmt ein Design in die Einstellungen (Entwurf aus store.transact).
// Foto bleibt gespeichert, wird aber ausgeschaltet, sonst wäre das Design nicht zu sehen.
export function applyDesign(settings, design) {
  settings.accent = design.accent;
  const photoSettings = { dim: settings.background.dim };
  settings.background = {
    gradient: structuredClone(design.background.gradient),
    paper: design.background.paper,
    pattern: design.background.pattern,
    usePhoto: false,
    ...photoSettings,
  };
}

// Das Design, das die aktuellen Einstellungen beschreiben (ohne Foto).
export function designFromSettings(settings) {
  return {
    accent: settings.accent,
    background: {
      gradient: structuredClone(settings.background.gradient),
      paper: settings.background.paper,
      pattern: settings.background.pattern,
    },
  };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Gilt das Design gerade? Vergleich ohne Winkel bei einfarbigem Verlauf und
// ohne Groß-/Kleinschreibung bei Farben.
export function isActive(settings, design) {
  const normalise = (gradient) => ({
    type: gradient.colors.length === 1 ? 'linear' : gradient.type,
    angle: gradient.colors.length === 1 || gradient.type === 'radial' ? 0 : gradient.angle,
    colors: gradient.colors.map((c) => c.toUpperCase()),
  });
  return !settings.background.usePhoto
    && settings.accent === design.accent
    && settings.background.paper.toUpperCase() === design.background.paper.toUpperCase()
    && settings.background.pattern === design.background.pattern
    && same(normalise(settings.background.gradient), normalise(design.background.gradient));
}
