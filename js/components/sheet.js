// Sheets: openSheet(content, { kind, label, onClose, beforeClose }).
//
// · kind 'centre' — the recipe sheet: full width minus 16px, centred.
//   kind 'bottom' — Add recipe, Settings and their sub-screens: a bottom
//   sheet with a grab handle. kind 'camera' — full screen, no scrim.
// · role="dialog", aria-modal, focus trapped inside, Esc and a scrim tap
//   close the top sheet. Sheets stack: opening one over another hides the
//   one beneath (inert) until it closes, so a sub-screen's Back returns to
//   exactly where the cook was.
// · beforeClose() may return false (or a Promise of false) to keep it open,
//   e.g. "Discard changes?".

import { h } from './dom.js';
import { icon } from './icons.js';

const stack = [];
let root = null;

function layers() {
  if (!root) {
    root = document.getElementById('layers') ?? document.body.appendChild(h('div', { id: 'layers' }));
  }
  return root;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openSheet(content, { kind = 'bottom', label = '', onClose, beforeClose, className = '' } = {}) {
  const opener = document.activeElement;
  const sheet = h('div', {
    class: `sheet sheet-${kind} ${className}`.trim(),
    role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabindex: '-1',
  });
  if (kind === 'bottom') sheet.append(h('div', { class: 'grabber', 'aria-hidden': 'true' }));
  sheet.append(content);
  const scrim = kind === 'camera' ? null : h('div', { class: 'scrim', 'aria-hidden': 'true' });
  const layer = h('div', { class: `layer layer-${kind}` }, scrim, kind === 'centre' ? h('div', { class: 'sheet-wrap' }, sheet) : sheet);

  const prev = stack.at(-1);
  if (prev) { prev.layer.inert = true; prev.layer.classList.add('covered'); }
  else { document.getElementById('app')?.setAttribute('inert', ''); }

  const handle = {
    layer, sheet, closed: false,
    async close({ force = false } = {}) {
      if (handle.closed) return true;
      if (!force && beforeClose && (await beforeClose()) === false) return false;
      handle.closed = true;
      const i = stack.indexOf(handle);
      if (i >= 0) stack.splice(i, 1);
      layer.classList.add('leaving');
      setTimeout(() => layer.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
      const top = stack.at(-1);
      if (top) { top.layer.inert = false; top.layer.classList.remove('covered'); }
      else document.getElementById('app')?.removeAttribute('inert');
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      onClose?.();
      return true;
    },
  };
  scrim?.addEventListener('click', () => handle.close());
  stack.push(handle);
  layers().append(layer);
  requestAnimationFrame(() => {
    layer.classList.add('open');
    const first = sheet.querySelector('[autofocus]') ?? sheet;
    first.focus({ preventScroll: true });
  });
  return handle;
}

export const topSheet = () => stack.at(-1) ?? null;
export const sheetCount = () => stack.length;
export async function closeAllSheets() {
  for (const s of [...stack].reverse()) await s.close({ force: true });
}

document.addEventListener('keydown', (e) => {
  const top = stack.at(-1);
  if (!top) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    top.close();
  } else if (e.key === 'Tab') {
    const items = [...top.sheet.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) { e.preventDefault(); top.sheet.focus(); return; }
    const first = items[0];
    const last = items.at(-1);
    if (e.shiftKey && (document.activeElement === first || document.activeElement === top.sheet)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// The bottom-sheet header: optional Back, a title, Close.
export function sheetHead(title, { onBack, onClose, closeLabel = 'Close' } = {}) {
  return h('div', { class: 'bs-head' },
    onBack ? h('button', { class: 'icon-btn back', type: 'button', 'aria-label': 'Back', onclick: onBack }, icon('arrow-left')) : null,
    h('h2', {}, title),
    onClose ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': closeLabel, onclick: onClose }, icon('x')) : null);
}

// A small centred question. Resolves true for the confirm button.
export function confirmSheet({ title, body = '', confirm = 'OK', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    let answer = false;
    const content = h('div', { class: 'confirm' },
      h('h2', {}, title),
      body ? h('p', {}, body) : null,
      h('div', { class: 'two' },
        h('button', { class: 'btn secondary', type: 'button', onclick: () => s.close() }, cancel),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', autofocus: true, onclick: () => { answer = true; s.close(); } }, confirm)));
    const s = openSheet(content, { kind: 'centre', label: title, className: 'sheet-confirm', onClose: () => resolve(answer) });
  });
}
