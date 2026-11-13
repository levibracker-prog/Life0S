// Modale Dialoge auf Basis von <dialog>. Escape und Klick daneben
// zählen als "Abbrechen", außer der Dialog ist als notwendig markiert.

import { h } from './dom.js';

function openDialog({ title, text, buttons, dismissible }) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'dialog-title' },
      h('h2', { class: 'dialog__title', id: 'dialog-title' }, title),
      h('p', { class: 'dialog__text' }, text),
      h('div', { class: 'dialog__actions' },
        buttons.map(({ label, value, kind }) => h('button', {
          type: 'button',
          class: `button${kind ? ` button--${kind}` : ''}`,
          onClick: () => dialog.close(String(value)),
        }, label))));

    dialog.addEventListener('cancel', (event) => {
      if (!dismissible) event.preventDefault();
    });
    dialog.addEventListener('click', (event) => {
      if (dismissible && event.target === dialog) dialog.close('');
    });
    dialog.addEventListener('close', () => {
      const answer = dialog.returnValue;
      dialog.remove();
      resolve(answer);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

export async function confirmDialog({ title, text, confirmLabel, danger = false }) {
  const answer = await openDialog({
    title,
    text,
    dismissible: true,
    buttons: [
      { label: confirmLabel, value: 'ja', kind: danger ? 'danger' : 'primary' },
      { label: 'Abbrechen', value: '' },
    ],
  });
  return answer === 'ja';
}

// Die Altersfrage hat keinen Abbrechen-Knopf: Ohne Antwort bleibt der
// Ernährungsschutz aktiv (ageGroup "unset" wird wie "minor" behandelt).
export function askAgeGroup() {
  return openDialog({
    title: 'Eine Frage vorab',
    text: 'Bist du unter 18? Das entscheidet, ob LifeOS bei Ernährung Zielvorgaben zeigt. Du kannst es später im Profil ändern.',
    dismissible: false,
    buttons: [
      { label: 'Unter 18', value: 'minor' },
      { label: '18 oder älter', value: 'adult' },
    ],
  });
}
