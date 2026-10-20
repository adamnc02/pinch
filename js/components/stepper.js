// A − / N / + stepper. stepper({ value, min, max, label, onChange, className })
import { h } from './dom.js';
import { icon } from './icons.js';

export function stepper({ value, min = 1, max = 100, label = 'servings', onChange, className = 'stepper' }) {
  let v = value;
  const out = h('b', { 'aria-live': 'polite' }, String(v));
  const minus = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Fewer ${label}` }, icon('minus'));
  const plus = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `More ${label}` }, icon('plus'));
  const sync = () => { out.textContent = String(v); minus.disabled = v <= min; plus.disabled = v >= max; };
  minus.addEventListener('click', () => { if (v > min) { v -= 1; sync(); onChange?.(v); } });
  plus.addEventListener('click', () => { if (v < max) { v += 1; sync(); onChange?.(v); } });
  sync();
  const el = h('div', { class: className }, minus, out, plus);
  el.setValue = (n) => { v = n; sync(); };
  return el;
}
