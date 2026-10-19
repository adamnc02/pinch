// toast('Saved') — a short message above the add button. Errors stay until
// tapped; anything else goes after 3 s.
import { h } from './dom.js';

let el = null;
let timer = null;

export function toast(message, { error = false, ms = 3000 } = {}) {
  if (!el) {
    el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite', onclick: () => el.classList.remove('show') });
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.add('show');
  clearTimeout(timer);
  if (!error) timer = setTimeout(() => el.classList.remove('show'), ms);
}
