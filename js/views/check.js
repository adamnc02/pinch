// Check ingredients (screen 13): after an import, and from a recipe whose
// ingredients need nutrition.
//
// · "N of M have nutrition" counts the ingredients that will be counted.
// · One row is open at a time: rename (the pencil opens Add ingredient),
//   delete, the amount with a unit switch, Scan / Products, From the label /
//   Skip for now.
// · The unit switch CONVERTS the stored amount, under the cups-only rule:
//   the ingredient's own unit plus cup, and an amount in cups can go to g
//   or ml. g ↔ cup needs a density; without one that option is disabled,
//   with the reason. g ↔ ml is never offered.
// · "To taste" rows are listed as not counted.
//
// Works on a draft: onChange(recipe) after every edit, onFinish(recipe) at
// the end. With `saveOnFinish`, the finish button saves the recipe itself.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { openSheet, sheetHead } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import * as state from '../state.js';
import { amountOpts } from '../prefs.js';
import { convert, unitOptions, nutritionStatus } from '../lib/units.js';
import { formatAmount, qtyInput, quarters, isQuarter, trimNumber } from '../lib/format.js';
import { removeIngredient } from '../lib/method.js';
import { openIngredientEditor, productSummary } from './ingredient.js';
import { openScanner } from './scanner.js';
import { openProductForm } from './product.js';

export function openCheckIngredients({ recipe, onChange, onFinish, finishLabel = 'Save recipe', saveOnFinish = false }) {
  let draft = structuredClone(recipe);
  const skipped = new Set();
  let open = null;
  let busy = false;

  const body = h('div', { class: 'check' });
  const sheet = openSheet(body, { kind: 'bottom', label: 'Check ingredients' });

  const product = (i) => state.getProduct(i.productId);
  const status = (i) => nutritionStatus(i, product(i), state.densityForIngredient(i));
  const counted = () => draft.ingredients.filter((i) => status(i) !== 'not_counted');
  const needing = () => draft.ingredients.filter((i) => ['no_product', 'unconvertible'].includes(status(i)));

  function update(next) {
    draft = next;
    onChange?.(draft);
    render();
  }
  const setIng = (id, patch) => update({ ...draft, ingredients: draft.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  function nextOpen() {
    const list = needing();
    return (list.find((i) => !skipped.has(i.id)) ?? null)?.id ?? null;
  }

  function render() {
    if (open && !draft.ingredients.some((i) => i.id === open)) open = null;
    if (open == null) open = nextOpen();
    const all = counted();
    const done = all.filter((i) => status(i) === 'ok').length;
    const left = needing();
    const scanTarget = left.find((i) => i.id !== open && !skipped.has(i.id)) ?? left.find((i) => i.id === open) ?? null;

    clear(body,
      sheetHead('Check ingredients', { onClose: () => sheet.close() }),
      h('div', { class: 'progress' },
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(all.length), 'aria-valuenow': String(done) },
          h('i', { style: { width: `${all.length ? (done / all.length) * 100 : 100}%` } })),
        h('div', { class: 'lbl' }, h('span', {}, `${draft.name || 'Recipe'} · ${draft.ingredients.length} ingredients`),
          h('span', {}, h('b', {}, `${done} of ${all.length}`), ' have nutrition'))),
      h('ul', { class: 'checks' }, draft.ingredients.map((i) => (i.id === open ? activeRow(i) : row(i)))),
      h('div', { class: 'sticky' },
        scanTarget ? h('button', { class: 'btn primary big', type: 'button', onclick: () => scanFor(scanTarget) }, icon('barcode'), `Scan next: ${scanTarget.name}`) : null,
        h('button', { class: `btn ${scanTarget ? 'quiet' : 'primary big'}`, type: 'button', disabled: busy, onclick: finish },
          left.length ? `${finishLabel} · ${left.length} can be finished later` : finishLabel)));
  }

  function row(i) {
    const s = status(i);
    const p = product(i);
    const sub = s === 'not_counted' ? 'To taste · not counted'
      : s === 'ok' ? p.name
        : s === 'unconvertible' ? `${p.name} · this amount can’t be counted against it`
          : 'Needs nutrition';
    return h('li', {},
      h('span', { class: `status ${s === 'ok' ? 'done' : s === 'not_counted' ? 'skip' : 'todo'}`, 'aria-hidden': 'true' }, s === 'ok' ? icon('check') : null),
      h('button', { class: 'txt as-button', type: 'button', onclick: () => { open = i.id; render(); } }, h('b', {}, i.name), h('span', {}, sub)),
      h('span', { class: 'amt' }, i.unit === 'to taste' ? '' : formatAmount(i.qty, i.unit, { ...amountOpts(), density: state.densityForIngredient(i) })));
  }

  function activeRow(i) {
    const s = status(i);
    const p = product(i);
    const density = state.densityForIngredient(i);
    const opts = i.qty == null ? [] : unitOptions(i.unit, density);
    const sub = [
      s === 'ok' ? `Linked · ${productSummary(p)}` : s === 'unconvertible' ? `${p.name} is ${p.basis === 'item' ? 'per item' : `per ${p.basis.replace('100', '100 ')}`}, so this amount can’t be counted` : s === 'not_counted' ? 'Not counted' : 'Needs nutrition',
      i.sourceLine ? `imported as “${i.sourceLine}”` : null,
    ].filter(Boolean).join(' · ');

    const qtyEl = h('input', {
      class: 'val', inputmode: 'decimal', 'aria-label': 'Amount', value: i.unit === 'cup' && i.qty != null && isQuarter(i.qty) ? quarters(i.qty) : qtyInput(i.qty),
      onchange: (e) => {
        const v = e.target.value.trim();
        const glyph = { '¼': 0.25, '½': 0.5, '¾': 0.75 };
        const m = v.match(/^(\d*)([¼½¾])$/);
        const n = m ? Number(m[1] || 0) + glyph[m[2]] : Number(v.replace(',', '.'));
        if (v === '') setIng(i.id, { qty: null, unit: 'to taste' });
        else if (Number.isFinite(n) && n > 0) setIng(i.id, { qty: n });
        else e.target.value = qtyInput(i.qty);
      },
    });

    return h('li', { class: 'active' },
      h('div', { class: 'top' }, h('h4', {}, i.name),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Rename', onclick: () => editFull(i) }, icon('pencil')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete ingredient', onclick: () => { update(removeIngredient(draft, i.id)); open = null; render(); } }, icon('trash'))),
      h('p', { class: 'sub' }, sub),
      i.qty == null ? null : h('div', { class: 'qty' }, qtyEl,
        opts.length > 1 ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Unit' }, opts.map((o) => h('button', {
          type: 'button', 'aria-pressed': String(o.unit === i.unit), disabled: !o.ok, title: o.reason ?? null,
          onclick: () => switchUnit(i, o.unit, density),
        }, o.unit))) : h('span', { class: 'unit-only' }, i.unit)),
      i.qty == null ? null : conversionLine(i, density, opts),
      h('div', { class: 'acts' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => scanFor(i) }, icon('barcode'), 'Scan'),
        h('button', { class: 'btn secondary', type: 'button', onclick: () => editFull(i) }, icon('search'), 'Products')),
      h('div', { class: 'more' },
        h('button', { class: 'btn quiet', type: 'button', onclick: () => openProductForm({ initial: { name: i.name }, onSaved: (prod) => linkTo(i, prod) }) }, 'From the label'),
        h('button', { class: 'btn quiet muted', type: 'button', onclick: () => { skipped.add(i.id); open = nextOpen(); render(); } }, 'Skip for now')));
  }

  // "Same as 375 ml · about 200 g (flour density)", and the reason when an
  // option is disabled.
  function conversionLine(i, density, opts) {
    const others = opts.filter((o) => o.unit !== i.unit);
    const parts = others.map((o) => {
      if (!o.ok) return h('span', {}, `${o.unit}: ${o.reason.toLowerCase()}`);
      const r = convert(i.qty, i.unit, o.unit, { density, cup: amountOpts().cup });
      if (r.error) return null;
      const text = formatAmount(r.qty, o.unit);
      const exact = o.unit === 'g' || i.unit === 'g' || i.unit === 'kg' ? 'about' : 'Same as';
      return h('span', {}, `${exact} `, h('b', {}, text.replace(/^≈ /, '')), density && (o.unit === 'g' || i.unit === 'g' || i.unit === 'kg') ? ` (${i.name.toLowerCase()} density)` : '');
    }).filter(Boolean);
    if (!parts.length) return null;
    return h('p', { class: 'conv' }, parts.flatMap((p, n) => (n ? [' · ', p] : [p])));
  }

  function switchUnit(i, to, density) {
    if (to === i.unit) return;
    const r = convert(i.qty, i.unit, to, { density, cup: 'metric' });
    if (r.error) { toast(r.error, { error: true }); return; }
    // Into cups the stored amount snaps to a quarter (shown with ≈ until
    // then); into g or ml it rounds like any metric amount.
    const qty = to === 'cup' ? Math.max(0.25, Math.round(r.qty * 4) / 4) : Number(trimNumber(r.qty, r.qty < 10 ? 1 : 0));
    setIng(i.id, { qty, unit: to });
  }

  function linkTo(i, prod) {
    setIng(i.id, { productId: prod.id });
    open = nextOpen();
    render();
  }

  function scanFor(i) {
    open = i.id;
    openScanner({ forName: i.name, onProduct: (prod) => linkTo(i, prod) });
  }

  function editFull(i) {
    openIngredientEditor({
      ingredient: i,
      title: 'Edit ingredient',
      onSave: (ing) => setIng(i.id, ing),
      onDelete: () => { update(removeIngredient(draft, i.id)); open = null; render(); },
    });
  }

  async function finish() {
    if (saveOnFinish) {
      busy = true; render();
      try {
        await state.saveRecipe({ ...draft, ingredients: draft.ingredients.map(({ sourceLine, itemGrams, ...x }) => x) });
        toast('Saved');
      } catch (e) {
        busy = false; render();
        toast(e.message, { error: true });
        return;
      }
    }
    await sheet.close({ force: true });
    onFinish?.(draft);
  }

  render();
  return sheet;
}
