// An iOS-style switch: toggle({ on, label, onChange }) → <button role="switch">.
// onChange(next) may return a Promise; the switch is disabled until it
// settles, and flips back if it rejects.
import { h } from './dom.js';

export function toggle({ on, label, onChange }) {
  const btn = h('button', { class: 'toggle', type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': label },
    h('span', { class: 'knob', 'aria-hidden': 'true' }));
  btn.addEventListener('click', async () => {
    const next = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', String(next));
    btn.disabled = true;
    try { await onChange?.(next); } catch { btn.setAttribute('aria-checked', String(!next)); } finally { btn.disabled = false; }
  });
  return btn;
}
