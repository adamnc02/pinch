// New product (screen 10): a product typed in from its label, or a scanned
// one being corrected. Nutrition per 100 g, per 100 ml or per item, as the
// four BLOC uses (kcal, protein, carbs, fat), and an optional weight of one
// item so "2 tins" can become grams. Saved to the household's products.
// Opened with an existing product (`initial.id`), it edits that product for
// every recipe that links it, and says so.

import { h, clear } from '../components/dom.js';
import { openSheet, sheetHead } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import * as state from '../state.js';
import { trimNumber } from '../lib/format.js';

export function openProductForm({ initial = {}, onSaved, onClose, title = 'New product' }) {
  const p = { name: '', brand: '', barcode: '', basis: '100g', kcal: null, protein: null, carbs: null, fat: null, gramsPerItem: null, source: 'label', ...initial };
  const text = (v) => (v == null ? '' : trimNumber(Number(v), 2));
  const vals = { kcal: text(p.kcal), protein: text(p.protein), carbs: text(p.carbs), fat: text(p.fat), gramsPerItem: text(p.gramsPerItem) };
  let error = null;
  let busy = false;

  const body = h('div', { class: 'product' });
  const sheet = openSheet(body, { kind: 'bottom', label: title, onClose });

  const input = (key, attrs = {}) => h('input', { class: 'input', value: p[key] ?? '', oninput: (e) => { p[key] = e.target.value; }, ...attrs });
  const macro = (key, label, unit) => h('div', { class: 'field' }, h('label', { for: `m-${key}` }, label),
    h('div', { class: 'unit-in' }, h('input', { id: `m-${key}`, class: 'input', inputmode: 'decimal', value: vals[key], oninput: (e) => { vals[key] = e.target.value; } }), h('em', {}, unit)));

  function render() {
    clear(body,
      sheetHead(title, { onBack: () => sheet.close(), onClose: () => sheet.close() }),
      h('div', { class: 'field' }, h('label', { for: 'pn' }, 'Product name'), input('name', { id: 'pn', autofocus: !p.name })),
      h('div', { class: 'two' },
        h('div', { class: 'field' }, h('label', { for: 'pb' }, 'Brand'), input('brand', { id: 'pb', placeholder: 'Optional' })),
        h('div', { class: 'field' }, h('label', { for: 'pc' }, 'Barcode'), input('barcode', { id: 'pc', placeholder: 'Optional', inputmode: 'numeric' }))),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Nutrition per'),
        h('div', { class: 'seg sm', role: 'group', 'aria-label': 'Nutrition per' }, [['100g', '100 g'], ['100ml', '100 ml'], ['item', 'Item']].map(([b, label]) => h('button', {
          type: 'button', 'aria-pressed': String(p.basis === b), onclick: () => { p.basis = b; render(); },
        }, label)))),
      h('div', { class: 'macro-grid' }, macro('kcal', 'Energy', 'kcal'), macro('protein', 'Protein', 'g'), macro('carbs', 'Carbs', 'g'), macro('fat', 'Fat', 'g')),
      p.basis === '100ml' ? null : h('div', { class: 'field' }, h('label', { for: 'm-gramsPerItem' }, 'Weight of one item'),
        h('div', { class: 'unit-in' }, h('input', { id: 'm-gramsPerItem', class: 'input', inputmode: 'decimal', value: vals.gramsPerItem, placeholder: 'Optional', oninput: (e) => { vals.gramsPerItem = e.target.value; } }), h('em', {}, 'g')),
        h('p', { class: 'hint' }, p.basis === 'item' ? 'Lets an amount in grams be counted against this item.' : 'Lets “2 tins” become grams. Use the drained weight if the recipe drains it.')),
      p.id ? h('p', { class: 'hint' }, 'Changes this product in every recipe that uses it.') : null,
      error ? h('p', { class: 'field-error', role: 'alert' }, error) : null,
      h('button', { class: 'btn primary big', type: 'button', disabled: busy, onclick: save }, busy ? 'Saving…' : 'Save product'));
  }

  async function save() {
    const num = (s) => (String(s).trim() === '' ? null : Number(String(s).replace(',', '.')));
    const macros = { kcal: num(vals.kcal), protein: num(vals.protein), carbs: num(vals.carbs), fat: num(vals.fat) };
    const gramsPerItem = p.basis === '100ml' ? null : num(vals.gramsPerItem);
    const barcode = String(p.barcode ?? '').replace(/\s/g, '');
    if (!String(p.name).trim()) error = 'Give the product a name.';
    else if (Object.values(macros).some((v) => v == null || !Number.isFinite(v) || v < 0)) error = 'Fill in all four values from the label (0 is fine).';
    else if (gramsPerItem != null && !(gramsPerItem > 0)) error = 'The weight of one item must be above 0, or empty.';
    else if (barcode && !/^\d{6,14}$/.test(barcode)) error = 'A barcode is 6 to 14 digits.';
    else if (barcode && state.productByBarcode(barcode) && state.productByBarcode(barcode).id !== p.id) error = 'That barcode is already one of your products.';
    else error = null;
    if (error) { render(); return; }
    busy = true; render();
    try {
      const saved = await state.saveProduct({ ...p, ...macros, gramsPerItem, barcode: barcode || null, name: p.name.trim(), brand: p.brand?.trim() || null });
      sheet.close();
      toast('Product saved');
      onSaved?.(saved);
    } catch (e) {
      busy = false;
      error = e.message;
      render();
    }
  }

  render();
  return sheet;
}
