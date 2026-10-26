// Check ingredients (screen 13): after an import, and from a recipe whose
// ingredients need nutrition.
//
// · "N of M have nutrition" counts the ingredients that will be counted.
// · One row is open at a time: rename (the pencil opens Add ingredient),
//   delete, the amount with a unit switch, then what the row still needs:
//   - no product: Your products (the library, views/products.js) and Scan,
//     as equal choices, plus From the label;
//   - a linked product that can't count this amount: a two-step track
//     (Product ✓ → the missing measurement) and measureBox() as the row's
//     ONE primary action — the weight of 1 tbsp, or of one item. Scan is not
//     offered once a product is linked: scanning again links the same
//     product and can never fix an amount (Change picks another product).
// · The footer moves on to the next row that needs something ("Next: …"),
//   whatever that is; it never assumes the next step is a scan.
// · The unit switch CONVERTS the stored amount, under the cups-only rule:
//   the ingredient's own unit plus cup, and an amount in cups can go to g
//   or ml. g ↔ cup needs a density; without one that option is disabled,
//   with the reason. g ↔ ml is never offered.
// · "To taste" rows and seasonings are listed as not counted. An open row
//   can be marked a seasoning (it then needs nothing) or unmarked.
// · A linked product can be edited from its row (Edit product).
//
// Works on a draft: onChange(recipe) after every edit, onFinish(recipe) at
// the end. With `saveOnFinish`, the finish button saves the recipe itself.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { openSheet, sheetHead, confirmSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import * as state from '../state.js';
import { amountOpts } from '../prefs.js';
import { convert, unitOptions, nutritionStatus, missingMeasure } from '../lib/units.js';
import { formatAmount, qtyInput, quarters, isQuarter, trimNumber } from '../lib/format.js';
import { removeIngredient } from '../lib/method.js';
import { openIngredientEditor, productSummary, measureBox } from './ingredient.js';
import { openProductSearch } from './products.js';
import { displayName } from '../lib/recipes.js';
import { openScanner } from './scanner.js';
import { openProductForm } from './product.js';

export function openCheckIngredients({ recipe, onChange, onFinish, finishLabel = 'Save recipe', saveOnFinish = false }) {
  let draft = structuredClone(recipe);
  const skipped = new Set();
  let open = null;
  let busy = false;
  let dirty = false;
  let finished = false;

  const body = h('div', { class: 'check' });
  // From the editor every change already reached its draft (onChange). From a
  // saved recipe (saveOnFinish) changes exist only here until the save.
  const sheet = openSheet(body, {
    kind: 'bottom', label: 'Check ingredients',
    beforeClose: async () => {
      if (busy) return false;
      if (!saveOnFinish || !dirty || finished) return true;
      return confirmSheet({ title: 'Discard changes?', body: 'Your changes to these ingredients haven\u2019t been saved.', confirm: 'Discard', danger: true });
    },
  });

  const product = (i) => state.getProduct(i.productId);
  const status = (i) => nutritionStatus(i, product(i), state.densityForIngredient(i));
  const counted = () => draft.ingredients.filter((i) => status(i) !== 'not_counted');
  const needing = () => draft.ingredients.filter((i) => ['no_product', 'unconvertible'].includes(status(i)));

  function update(next) {
    draft = next;
    dirty = true;
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
    const nextTarget = left.find((i) => i.id !== open && !skipped.has(i.id)) ?? null;
    const finishText = busy ? 'Saving…' : left.length ? `${finishLabel} · ${left.length} later` : finishLabel;

    clear(body,
      sheetHead('Check ingredients', { onClose: () => sheet.close() }),
      h('div', { class: 'progress' },
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(all.length), 'aria-valuenow': String(done) },
          h('i', { style: { width: `${all.length ? (done / all.length) * 100 : 100}%` } })),
        h('div', { class: 'lbl' }, h('span', {}, `${displayName(draft.name) || 'Recipe'} · ${draft.ingredients.length} ingredients`),
          h('span', {}, h('b', {}, `${done} of ${all.length}`), ' have nutrition'))),
      h('ul', { class: 'checks' }, draft.ingredients.map((i) => (i.id === open ? activeRow(i) : row(i)))),
      nextTarget
        ? h('div', { class: 'sticky two' },
          h('button', { class: 'btn secondary big', type: 'button', disabled: busy, onclick: finish }, finishText),
          h('button', { class: 'btn secondary big', type: 'button', onclick: () => { open = nextTarget.id; render(); } }, `Next: ${nextTarget.name}`, icon('chevron-right')))
        : h('div', { class: 'sticky' },
          h('button', { class: `btn ${left.length ? 'secondary' : 'primary'} big`, type: 'button', disabled: busy, onclick: finish }, finishText)));
  }

  // What a row with a linked product still needs, in a few words.
  function needText(i, p) {
    const need = missingMeasure(i, p, state.densityForIngredient(i));
    return need === 'spoon' ? 'needs the weight of 1 tbsp' : need === 'item' ? 'needs the weight of one' : `can’t be counted in ${i.unit}`;
  }

  function row(i) {
    const s = status(i);
    const p = product(i);
    const sub = s === 'not_counted' ? (i.seasoning ? 'Seasoning · not counted' : 'To taste · not counted')
      : s === 'ok' ? p.name
        : s === 'unconvertible' ? `${p.name} · ${needText(i, p)}`
          : 'Needs a product';
    return h('li', {},
      h('span', { class: `status ${s === 'ok' ? 'done' : s === 'not_counted' ? 'skip' : s === 'unconvertible' ? 'half' : 'todo'}`, 'aria-hidden': 'true' }, s === 'ok' ? icon('check') : null),
      h('button', { class: 'txt as-button', type: 'button', onclick: () => { open = i.id; render(); } }, h('b', {}, i.name), h('span', {}, sub)),
      h('span', { class: 'amt' }, i.unit === 'to taste' ? '' : formatAmount(i.qty, i.unit, { ...amountOpts(), density: state.densityForIngredient(i) })));
  }

  function activeRow(i) {
    const s = status(i);
    const p = product(i);
    const density = state.densityForIngredient(i);
    const opts = i.qty == null ? [] : unitOptions(i.unit, density);
    const need = s === 'unconvertible' ? missingMeasure(i, p, density) : null;
    const sub = [
      s === 'ok' ? 'Counted' : s === 'unconvertible' ? null
        : s === 'not_counted' ? (i.seasoning ? 'Seasoning · not counted' : 'Not counted') : 'Needs a product',
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
      sub ? h('p', { class: 'sub' }, sub) : null,
      i.qty == null ? null : h('div', { class: 'qty' }, qtyEl,
        opts.length > 1 ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Unit' }, opts.map((o) => h('button', {
          type: 'button', 'aria-pressed': String(o.unit === i.unit), disabled: !o.ok, title: o.reason ?? null,
          onclick: () => switchUnit(i, o.unit, density),
        }, o.unit))) : h('span', { class: 'unit-only' }, i.unit)),
      i.qty == null ? null : conversionLine(i, density, opts),
      i.seasoning
        ? h('div', { class: 'more' },
          h('button', { class: 'btn quiet', type: 'button', onclick: () => setIng(i.id, { seasoning: false }) }, 'Not a seasoning'))
        : p ? [
          s === 'unconvertible' ? track(need, i.unit) : null,
          h('div', { class: 'suggest linked' }, h('span', { class: 'pk' }, icon('check')),
            h('span', { class: 'txt' }, h('b', {}, p.name), h('span', {}, productSummary(p))),
            h('button', { class: 'btn quiet', type: 'button', onclick: () => browse(i) }, 'Change')),
          s === 'unconvertible' ? measureBox({
            need, product: p, unit: i.unit, qty: i.qty, name: i.name,
            onSave: (grams) => saveMeasure(p, need, grams),
          }) : null,
          h('div', { class: 'more' },
            h('button', { class: 'btn quiet', type: 'button', onclick: () => editProduct(p) }, icon('pencil'), 'Edit product'),
            h('button', { class: 'btn quiet', type: 'button', onclick: () => markSeasoning(i) }, icon('leaf'), 'Seasoning'),
            s === 'ok' ? null : skipButton(i)),
        ] : [
          h('div', { class: 'acts' },
            h('button', { class: 'btn secondary', type: 'button', onclick: () => browse(i) }, icon('search'), 'Your products'),
            h('button', { class: 'btn secondary', type: 'button', onclick: () => scanFor(i) }, icon('barcode'), 'Scan')),
          h('div', { class: 'more' },
            h('button', { class: 'btn quiet', type: 'button', onclick: () => openProductForm({ initial: { name: i.name }, onSaved: (prod) => linkTo(i, prod) }) }, 'From the label'),
            h('button', { class: 'btn quiet', type: 'button', onclick: () => markSeasoning(i) }, icon('leaf'), 'Seasoning'),
            skipButton(i)),
        ]);
  }

  const skipButton = (i) => h('button', { class: 'btn quiet muted', type: 'button', onclick: () => { skipped.add(i.id); open = nextOpen(); render(); } }, 'Skip for now');

  // Product ✓ → the measurement still missing. Says which step is the blocker.
  function track(need, unit) {
    const second = need === 'spoon' ? 'Weight of 1 tbsp' : need === 'item' ? 'Weight of one' : `Amount in ${unit}`;
    return h('ol', { class: 'track', 'aria-label': 'What this ingredient needs' },
      h('li', { class: 'done' }, h('span', { class: 'dot', 'aria-hidden': 'true' }, icon('check')), 'Product', h('span', { class: 'visually-hidden' }, ' (done)')),
      h('li', { class: 'now' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), second, h('span', { class: 'visually-hidden' }, ' (needed)')));
  }

  // Saves the measurement on the product; every recipe using it re-reads it.
  async function saveMeasure(p, need, grams) {
    try {
      await state.saveProduct({ ...p, [need === 'spoon' ? 'gramsPerTbsp' : 'gramsPerItem']: grams });
      toast('Weight saved');
      open = nextOpen();
      render();
    } catch (e) {
      toast(e.message, { error: true });
    }
  }

  function browse(i) {
    open = i.id;
    openProductSearch({ forName: i.name, onPick: (prod) => linkTo(i, prod) });
  }

  function markSeasoning(i) {
    setIng(i.id, { seasoning: true });
    open = nextOpen();
    render();
  }

  // Edits the product itself (every recipe using it follows); this row's
  // status re-reads it on render.
  function editProduct(p) {
    openProductForm({ initial: p, title: 'Edit product', onSaved: () => { open = nextOpen(); render(); } });
  }

  // "Same as 375 ml · about 200 g (flour density)", and the reason when an
  // option is disabled.
  function conversionLine(i, density, opts) {
    const others = opts.filter((o) => o.unit !== i.unit);
    const parts = others.map((o) => {
      if (!o.ok) return h('span', {}, `${o.unit}: ${o.reason.toLowerCase()}`);
      // A stored cup is a metric cup, so the line says what the switch would store.
      const r = convert(i.qty, i.unit, o.unit, { density, cup: 'metric' });
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
        finished = true;
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
