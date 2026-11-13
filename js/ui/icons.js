// Eigener Icon-Satz, Strichstärke 1,75. Die Pfade sind feste Konstanten,
// deshalb ist innerHTML hier unbedenklich.

const PATHS = {
  home: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z"/>',
  explore: '<circle cx="12" cy="12" r="8"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  agent: '<path d="M5 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-6l-4 3.5V16H7a2 2 0 0 1-2-2z"/><path d="M9 9.5h6M9 12.5h3.5"/>',
  progress: '<path d="M5 19.5V12M12 19.5V5M19 19.5v-9"/>',
  profile: '<circle cx="12" cy="9" r="3.5"/><path d="M5 19.5c1-3.5 4-5 7-5s6 1.5 7 5"/>',
  undo: '<path d="M9 7 5 11l4 4"/><path d="M5 11h8a5 5 0 0 1 0 10h-2"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7"/>',
};

export function icon(name, size = 24) {
  const path = PATHS[name];
  if (!path) throw new Error(`Unbekanntes Icon: ${name}`);
  const holder = document.createElement('span');
  holder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
  return holder.firstChild;
}
