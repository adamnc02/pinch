// Add ingredient (screen 09): a name, an amount and a unit from the
// controlled list, and optionally a product for its nutrition.
//
// Typing a name lists matching HOUSEHOLD products first, so a product is
// only scanned once. Otherwise: Scan barcode, or From label. An ingredient
// can be saved without a product; it is then marked "needs nutrition".

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { openSheet, sheetHead } from '../components/sheet.js';
import * as state from '../state.js';
import { UNITS } from '../lib/units.js';
import { qtyInput, trimNumber } from '../lib/format.js';
import { blankIngredient } from '../lib/ids.js';
import { openScanner } from './scanner.js';
import { openProductForm } from './product.js';

const UNIT_CHIPS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'each', 'to taste'];

export const productSummary = (p) => {
  const per = { '100g': 'per 100 g', '100ml': 'per 100 ml', item: 'per item' }[p.basis];
  return [p.brand, p.gramsPerItem && p.basis !== 'item' ? `${trimNumber(p.gramsPerItem, 1)} g each` : null, `${trimNumber(p.kcal ?? 0, 1)} kcal ${per}`]
    .filter(Boolean).join(' · ');
};

export function openIngredientEditor({ ingredient = null, isNew = false, onSave, onDelete = null, title = null }) {
  const editing = Boolean(ingredient) && !isNew;
  const ing = structuredClone(ingredient ?? blankIngredient());
  let qtyText = qtyInput(ing.qty);
  let error = null;

  const body = h('div', { class: 'ingredient' });
  const sheet = openSheet(body, { kind: 'bottom', label: title ?? (editing ? 'Edit ingredient' : 'Add ingredient') });

  function render() {
    const product = state.getProduct(ing.productId);
    const suggestions = product ? [] : state.searchProducts(ing.name, 4);
    const nameInput = h('input', {
      id: 'in', class: 'input', value: ing.name, placeholder: 'e.g. Chickpeas', autocomplete: 'off', autofocus: !ing.name,
      oninput: (e) => { ing.name = e.target.value; renderSuggestions(); },
    });
    const suggestBox = h('div', { class: 'field' });
    function renderSuggestions() {
      const list = state.getProduct(ing.productId) ? [] : state.searchProducts(ing.name, 4);
      clear(suggestBox, list.length ? [
        h('span', { class: 'label' }, 'Nutrition · from your products'),
        list.map((p) => h('button', { class: 'suggest', type: 'button', onclick: () => link(p) },
          h('span', { class: 'pk' }, icon('package')),
          h('span', { class: 'txt' }, h('b', {}, p.name), h('span', {}, productSummary(p))),
          h('span', { class: 'go' }, 'Use'))),
      ] : []);
    }

    clear(body,
      sheetHead(title ?? (editing ? 'Edit ingredient' : 'Add ingredient'), { onBack: () => sheet.close(), onClose: () => sheet.close() }),
      h('div', { class: 'field' }, h('label', { for: 'in' }, 'Ingredient'), nameInput),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Amount'),
        h('div', { class: 'amount' },
          h('input', {
            class: 'input', inputmode: 'decimal', 'aria-label': 'Quantity', value: qtyText, placeholder: '—',
            disabled: ing.unit === 'to taste',
            oninput: (e) => { qtyText = e.target.value; },
          }),
          h('div', { class: 'unit-chips', role: 'group', 'aria-label': 'Unit' }, UNIT_CHIPS.map((u) => h('button', {
            class: 'chip', type: 'button', 'aria-pressed': String(ing.unit === u),
            onclick: () => { ing.unit = u; if (u === 'to taste') qtyText = ''; render(); },
          }, u))))),
      product
        ? h('div', { class: 'field' }, h('span', { class: 'label' }, 'Nutrition'),
          h('div', { class: 'suggest linked' }, h('span', { class: 'pk' }, icon('check')),
            h('span', { class: 'txt' }, h('b', {}, product.name), h('span', {}, productSummary(product))),
            h('button', { class: 'btn quiet', type: 'button', onclick: () => { ing.productId = null; render(); } }, 'Unlink')))
        : suggestBox,
      product ? null : h('div', { class: 'field' }, h('span', { class: 'label' }, suggestions.length ? 'Not there?' : 'Nutrition'),
        h('div', { class: 'two' },
          h('button', { class: 'btn primary', type: 'button', onclick: scan }, icon('barcode'), 'Scan barcode'),
          h('button', { class: 'btn secondary', type: 'button', onclick: fromLabel }, icon('keyboard'), 'From label')),
        h('p', { class: 'hint' }, 'You can add it without nutrition. It’s marked “needs nutrition” until a product is linked.')),
      error ? h('p', { class: 'field-error', role: 'alert' }, error) : null,
      h('div', { class: 'actions-end' },
        h('button', { class: 'btn primary big', type: 'button', onclick: save }, editing ? 'Save ingredient' : 'Add ingredient'),
        onDelete ? h('button', { class: 'btn quiet danger-text', type: 'button', onclick: () => { onDelete(); sheet.close(); } }, icon('trash'), 'Delete ingredient') : null));
    renderSuggestions();
  }

  function link(p) {
    ing.productId = p.id;
    if (!ing.name.trim()) ing.name = p.name;
    if (!qtyText && ing.unit === 'g' && p.basis === '100ml') ing.unit = 'ml';
    render();
  }

  function scan() {
    openScanner({ forName: ing.name || null, onProduct: link });
  }

  function fromLabel() {
    openProductForm({ initial: { name: ing.name }, onSaved: link });
  }

  function save() {
    const name = ing.name.trim();
    const qty = ing.unit === 'to taste' || qtyText.trim() === '' ? null : Number(qtyText.replace(',', '.'));
    if (!name) { error = 'Give the ingredient a name.'; render(); return; }
    if (qty !== null && !(Number.isFinite(qty) && qty > 0)) { error = 'The amount must be a number above 0, or empty.'; render(); return; }
    if (!UNITS.includes(ing.unit)) { error = 'Choose a unit.'; render(); return; }
    onSave({ ...ing, name, qty });
    sheet.close();
  }

  render();
  return sheet;
}
