// Add ingredient (screen 09): a name, an amount and a unit from the
// controlled list, and optionally a product for its nutrition.
//
// For cup, tbsp and tsp the amount is picked, not typed: a whole-number
// stepper and – ¼ ½ ¾, so a measure is always one a spoon or cup can hold.
// An existing amount that isn't a quarter (a recipe's "⅓ tsp") is kept
// exactly until the picker is touched.
//
// Typing a name lists matching HOUSEHOLD products first, so a product is
// only scanned once. Otherwise: Scan barcode, or From label. An ingredient
// can be saved without a product; it is then marked "needs nutrition".
// With Nutrition and barcodes off, the product part is not shown at all, and
// a product already linked stays linked.
//
// · Seasoning (a spice, herb, salt…): never counted, so no product part and
//   no "needs nutrition". A NEW ingredient whose name looks like one starts
//   with the switch on (looksLikeSeasoning) until the switch is touched; a
//   saved ingredient is never changed for the cook.
// · A linked product can be edited here (it changes in every recipe that
//   uses it). When the amount can't be counted only because the product has
//   no weight of one item ("2 each" against a per-100 g product), the sheet
//   asks for that weight and saves it on the product.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { openSheet, sheetHead } from '../components/sheet.js';
import * as state from '../state.js';
import { UNITS, isWeight, nutritionStatus } from '../lib/units.js';
import { looksLikeSeasoning } from '../lib/cooking.js';
import { toggle } from '../components/toggle.js';
import { toast } from '../components/toast.js';
import { qtyInput, trimNumber, isQuarter } from '../lib/format.js';
import { stepper } from '../components/stepper.js';
import { blankIngredient } from '../lib/ids.js';
import { openScanner } from './scanner.js';
import { openProductForm } from './product.js';

const UNIT_CHIPS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'each', 'to taste'];
const QUARTER_UNITS = ['tsp', 'tbsp', 'cup'];
const FRACTIONS = [[0, '–'], [0.25, '¼'], [0.5, '½'], [0.75, '¾']];

export const productSummary = (p) => {
  const per = { '100g': 'per 100 g', '100ml': 'per 100 ml', item: 'per item' }[p.basis];
  return [p.brand, p.gramsPerItem && p.basis !== 'item' ? `${trimNumber(p.gramsPerItem, 1)} g each` : null, `${trimNumber(p.kcal ?? 0, 1)} kcal ${per}`]
    .filter(Boolean).join(' · ');
};

export function openIngredientEditor({ ingredient = null, isNew = false, onSave, onDelete = null, title = null }) {
  const editing = Boolean(ingredient) && !isNew;
  const ing = { seasoning: false, ...structuredClone(ingredient ?? blankIngredient()) };
  let qtyText = qtyInput(ing.qty);
  let error = null;
  // Only a brand-new ingredient follows its name; a saved one keeps its flag.
  let seasoningTouched = editing || Boolean(ingredient?.seasoning);
  if (!seasoningTouched && ing.name) ing.seasoning = looksLikeSeasoning(ing.name);
  let itemGramsText = '';

  const body = h('div', { class: 'ingredient' });
  const sheet = openSheet(body, { kind: 'bottom', label: title ?? (editing ? 'Edit ingredient' : 'Add ingredient') });

  function render() {
    // With nutrition off, or for a seasoning, there is no product part.
    const nutritionOn = state.get().nutritionOn && !ing.seasoning;
    const product = state.getProduct(ing.productId);
    const suggestions = product || !nutritionOn ? [] : state.searchProducts(ing.name, 4);
    const seasoningSwitch = toggle({ on: ing.seasoning, label: 'Seasoning', onChange: (on) => { seasoningTouched = true; ing.seasoning = on; render(); } });
    const nameInput = h('input', {
      id: 'in', class: 'input', value: ing.name, placeholder: 'e.g. Chickpeas', autocomplete: 'off', autofocus: !ing.name,
      oninput: (e) => {
        ing.name = e.target.value;
        if (!seasoningTouched && looksLikeSeasoning(ing.name) !== ing.seasoning) {
          ing.seasoning = !ing.seasoning;
          // Re-render keeps the caret: the name input is rebuilt with the same value.
          const at = e.target.selectionStart;
          render();
          const el = body.querySelector('#in');
          el?.focus(); el?.setSelectionRange(at, at);
          return;
        }
        renderSuggestions();
      },
    });
    const suggestBox = h('div', { class: 'field' });
    function renderSuggestions() {
      const list = state.getProduct(ing.productId) || !state.get().nutritionOn || ing.seasoning ? [] : state.searchProducts(ing.name, 4);
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
        QUARTER_UNITS.includes(ing.unit)
          ? h('div', { class: 'amount picked' }, quarterPicker(), unitChips())
          : h('div', { class: 'amount' },
            h('input', {
              class: 'input', inputmode: 'decimal', 'aria-label': 'Quantity', value: qtyText, placeholder: '—',
              disabled: ing.unit === 'to taste',
              oninput: (e) => { qtyText = e.target.value; },
            }),
            unitChips())),
      h('div', { class: 'list' },
        h('div', { class: 'row' }, icon('leaf'),
          h('span', { class: 'txt' }, h('b', {}, 'Seasoning'), h('span', {}, 'A spice, herb or salt. Not counted for nutrition, and never asks for a barcode.')),
          seasoningSwitch)),
      !nutritionOn ? null
        : product
        ? h('div', { class: 'field' }, h('span', { class: 'label' }, 'Nutrition'),
          h('div', { class: 'suggest linked' }, h('span', { class: 'pk' }, icon('check')),
            h('span', { class: 'txt' }, h('b', {}, product.name), h('span', {}, productSummary(product))),
            h('button', { class: 'btn quiet', type: 'button', onclick: () => editProduct(product) }, 'Edit'),
            h('button', { class: 'btn quiet', type: 'button', onclick: () => { ing.productId = null; render(); } }, 'Unlink')),
          itemWeightPrompt(product))
        : suggestBox,
      product || !nutritionOn ? null : h('div', { class: 'field' }, h('span', { class: 'label' }, suggestions.length ? 'Not there?' : 'Nutrition'),
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

  function unitChips() {
    return h('div', { class: 'unit-chips', role: 'group', 'aria-label': 'Unit' }, UNIT_CHIPS.map((u) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(ing.unit === u),
      onclick: () => { ing.unit = u; if (u === 'to taste') qtyText = ''; render(); },
    }, u)));
  }

  // The current amount as whole + quarter. A typed amount that isn't a
  // quarter shows its nearest quarter in the picker and stays as typed
  // until a button is pressed.
  function quarterPicker() {
    const typed = Number(qtyText.replace(',', '.'));
    const qty = qtyText.trim() !== '' && Number.isFinite(typed) && typed > 0 ? typed : 0;
    const exact = qty === 0 || isQuarter(qty);
    const snapped = Math.round(qty * 4) / 4;
    const whole = Math.floor(snapped + 1e-9);
    const frac = snapped - whole;
    const set = (w, f) => { const v = w + f; qtyText = v > 0 ? trimNumber(v, 2) : ''; render(); };
    return h('div', { class: 'quarter-pick-wrap' },
      h('div', { class: 'quarter-pick' },
        stepper({ value: whole, min: 0, max: 50, label: ing.unit, onChange: (w) => set(w, frac) }),
        h('div', { class: 'chips', role: 'group', 'aria-label': 'Part' }, FRACTIONS.map(([f, glyph]) => h('button', {
          class: 'chip', type: 'button', 'aria-pressed': String(exact && Math.abs(frac - f) < 1e-6),
          'aria-label': f ? glyph : 'No part', onclick: () => set(whole, f),
        }, glyph)))),
      exact ? null : h('p', { class: 'hint' }, `Now ${trimNumber(qty, 2)} ${ing.unit}, kept as it is unless you pick.`));
  }

  // "2 each" against a per-100 g product (or grams against a per-item one)
  // counts once the product knows what one item weighs.
  function needsItemWeight(product) {
    const qty = Number(qtyText.replace(',', '.'));
    const draft = { ...ing, qty: qtyText.trim() && Number.isFinite(qty) && qty > 0 ? qty : null };
    if (nutritionStatus(draft, product, state.densityForIngredient(draft)) !== 'unconvertible') return false;
    return (ing.unit === 'each' && product.basis === '100g') || (isWeight(ing.unit) && product.basis === 'item');
  }

  function itemWeightPrompt(product) {
    if (!needsItemWeight(product)) return null;
    const one = ing.name.trim() || product.name;
    return h('div', { class: 'item-weight' },
      h('p', {}, `${product.name} is per ${product.basis === 'item' ? 'item' : '100 g'}, so this amount can’t be counted until Pinch knows what one weighs.`),
      h('div', { class: 'key-row' },
        h('div', { class: 'unit-in' },
          h('input', { class: 'input', inputmode: 'decimal', 'aria-label': `Weight of one ${one}`, placeholder: `One ${one.toLowerCase()} weighs`, value: itemGramsText,
            oninput: (e) => { itemGramsText = e.target.value; } }),
          h('em', {}, 'g')),
        h('button', { class: 'btn primary', type: 'button', onclick: () => saveItemWeight(product) }, 'Save')),
      h('p', { class: 'hint' }, 'Saved on the product, so every recipe using it can count it.'));
  }

  async function saveItemWeight(product) {
    const grams = Number(itemGramsText.replace(',', '.'));
    if (!(Number.isFinite(grams) && grams > 0)) { toast('Enter the weight of one, in grams.', { error: true }); return; }
    try {
      await state.saveProduct({ ...product, gramsPerItem: grams });
      itemGramsText = '';
      toast('Weight saved');
      render();
    } catch (e) {
      toast(e.message, { error: true });
    }
  }

  function editProduct(product) {
    openProductForm({ initial: product, title: 'Edit product', onSaved: () => render() });
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
