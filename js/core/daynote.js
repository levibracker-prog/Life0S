// Die Tagesnotiz oben auf Home: ein Satz, lokal aus den echten Daten gebaut,
// ohne KI und auch offline. Regeln kommen mit den Modulen dazu (Habits,
// Aufgaben). Bis dahin gibt es nur den gestalteten Leer-Zustand.

export function buildDayNote(state) {
  const hasContent = state.dashboard.widgets.length > 0;
  if (!hasContent) {
    return {
      text: 'Noch leer. Sobald du Habits oder Aufgaben hast, steht hier, was heute ansteht.',
      empty: true,
    };
  }
  return {
    text: `${state.dashboard.widgets.length} Widgets auf deinem Home.`,
    empty: false,
  };
}
