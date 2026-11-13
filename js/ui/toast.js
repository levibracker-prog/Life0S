// Kurze Meldungen über der Navigation. Es gibt immer nur eine.

import { TOAST_MS } from '../config.js';
import { h } from './dom.js';

let area;
let timer;

function ensureArea() {
  if (!area) {
    area = h('div', { class: 'toast-area', role: 'status', 'aria-live': 'polite' });
    document.body.append(area);
  }
  return area;
}

export function showToast(message, { actionLabel, onAction, error = false } = {}) {
  clearTimeout(timer);
  const container = ensureArea();
  container.replaceChildren();

  const toast = h('div', { class: error ? 'toast toast--error' : 'toast' },
    h('span', { class: 'toast__text' }, message));
  if (actionLabel) {
    toast.append(h('button', {
      type: 'button',
      class: 'toast__action',
      onClick: () => {
        toast.remove();
        onAction?.();
      },
    }, actionLabel));
  }
  container.append(toast);
  timer = setTimeout(() => toast.remove(), error ? TOAST_MS * 2 : TOAST_MS);
}
