// Add ingredient (screen 09): a name, an amount and a unit from the
// controlled list, and optionally a product for its nutrition.
//
// For cup, tbsp and tsp the amount is picked, not typed: a whole-number
// stepper and – ¼ ½ ¾, so a measure is always one a spoon or cup can hold.
// An existing amount that isn't a quarter (a recipe's "⅓ tsp") is kept
// exactly until the picker is touched.
//
// Typing a name lists matching HOUSEHOLD products first, and "Search all
// your products" opens the whole library (views/products.js), so a product is
// only scanned once. Otherwise, as equal second choices: Scan barcode, or
// From label. An ingredient can be saved without a product; it is then
// marked "needs nutrition".
// With Nutrition and barcodes off, the product part is not shown at all, and
// a product already linked stays linked.
//
// · Seasoning (a spice, herb, salt…): never counted, so no product part and
//   no "needs nutrition". A NEW ingredient whose name looks like one starts
//   with the switch on (looksLikeSeasoning) until the switch is touched; a
//   saved ingredient is never changed for the cook.
// · A linked product can be edited, or changed for another, here (an edit
//   changes it in every recipe that uses it). When the amount can't be
//   counted only because the product lacks one measurement (missingMeasure),
//   the sheet asks for it and saves it on the product: the weight of 1 tbsp
//   for tsp, tbsp or cups of a per-100 g product, or the weight of one item
//   for "2 each" against a per-100 g product. Any other unconvertible amount
//   (ml of a per-100 g product) says why, and that no number fixes it.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { openSheet, sheetHead } from '../components/sheet.js';
import * as state from '../state.js';
import { UNITS, nutritionStatus, missingMeasure, gramsBySpoon } from '../lib/units.js';
import { looksLikeSeasoning } from '../lib/cooking.js';
import { toggle } from '../components/toggle.js';
import { toast } from '../components/toast.js';
import { qtyInput, trimNumber, isQuarter } from '../lib/format.js';
import { stepper } from '../components/stepper.js';
import { blankIngredient } from '../lib/ids.js';
import { openScanner } from './scanner.js';
import { openProductForm } from './product.js';
import { openProductSearch, productSummary } from './products.js';

export { productSummary };

const UNIT_CHIPS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'each', 'to taste'];
const QUARTER_UNITS = ['tsp', 'tbsp', 'cup'];
const FRACTIONS = [[0, '–'], [0.25, '¼'], [0.5, '½'], [0.75, '¾']];

export function openIngredientEditor({ ingredient = null, isNew = false, onSave, onDelete = null, title = null }) {
  const editing = Boolean(ingredient) && !isNew;
  const ing = { seasoning: false, ...structuredClone(ingredient ?? blankIngredient()) };
  let qtyText = qtyInput(ing.qty);
  let error = null;
  // Only a brand-new ingredient follows its name; a saved one keeps its flag.
  let seasoningTouched = editing || Boolean(ingredient?.seasoning);
  if (!seasoningTouched && ing.name) ing.seasoning = looksLikeSeasoning(ing.name);
  let measureText = '';

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
            h('button', { class: 'btn quiet', type: 'button', onclick: browse }, 'Change')),
          h('div', { class: 'linked-acts' },
            h('button', { class: 'btn quiet', type: 'button', onclick: () => editProduct(product) }, icon('pencil'), 'Edit product'),
            h('button', { class: 'btn quiet muted', type: 'button', onclick: () => { ing.productId = null; render(); } }, 'Unlink')),
          measurePrompt(product))
        : suggestBox,
      product || !nutritionOn ? null : h('div', { class: 'field' },
        state.get().products.length
          ? h('button', { class: 'btn quiet start', type: 'button', onclick: browse }, icon('search'), `Search all ${state.get().products.length} of your products`)
          : null,
        h('span', { class: 'label' }, state.get().products.length ? 'Not in your products?' : 'Nutrition'),
        h('div', { class: 'two' },
          h('button', { class: 'btn secondary', type: 'button', onclick: scan }, icon('barcode'), 'Scan barcode'),
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

  // The draft as it stands, with the amount being typed.
  function draftNow() {
    const qty = Number(qtyText.replace(',', '.'));
    return { ...ing, qty: qtyText.trim() && Number.isFinite(qty) && qty > 0 ? qty : null };
  }

  // When the amount can't be counted against the linked product, says why,
  // and asks for the one measurement that would fix it, if there is one.
  function measurePrompt(product) {
    const draft = draftNow();
    const density = state.densityForIngredient(draft);
    if (nutritionStatus(draft, product, density) !== 'unconvertible') return null;
    const need = missingMeasure(draft, product, density);
    return measureBox({
      need, product, unit: ing.unit, qty: draft.qty, name: ing.name.trim() || product.name,
      value: measureText, onInput: (v) => { measureText = v; },
      onSave: (grams) => saveMeasure(product, need, grams),
    });
  }

  async function saveMeasure(product, need, grams) {
    try {
      await state.saveProduct({ ...product, [need === 'spoon' ? 'gramsPerTbsp' : 'gramsPerItem']: grams });
      measureText = '';
      toast('Weight saved');
      render();
    } catch (e) {
      toast(e.message, { error: true });
    }
  }

  function browse() {
    openProductSearch({ forName: ing.name.trim(), onPick: link });
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

// The box shown when a linked product can't count this amount. `need` is
// missingMeasure()'s answer: 'spoon' asks for the weight of 1 tbsp, 'item'
// for the weight of one; null says no number on the product would help.
// Shared by Add ingredient and Check ingredients, where it is the one
// primary action of the row: scanning again can never fix this.
const SPOON_WORDS = { tsp: 'teaspoons', tbsp: 'tablespoons', cup: 'cups' };
export function measureBox({ need, product, unit, qty, name, value = '', onInput, onSave }) {
  const per = { '100g': 'per 100 g', '100ml': 'per 100 ml', item: 'per item' }[product.basis];
  if (!need) {
    return h('div', { class: 'measure' },
      h('b', {}, 'This amount can’t be counted'),
      h('p', {}, `${product.name} is ${per}, and an amount in ${unit} can’t be turned into that. Change the amount’s unit, or link a different product.`));
  }
  const spoon = need === 'spoon';
  let text = value;
  const preview = h('span', { class: 'hint' });
  const showPreview = () => {
    const g = Number(text.replace(',', '.'));
    const grams = spoon ? gramsBySpoon(qty, unit, g) : null;
    preview.textContent = grams ? `${trimNumber(qty, 2)} ${unit} = ${trimNumber(grams, 1)} g` : '';
  };
  const save = () => {
    const grams = Number(text.replace(',', '.'));
    if (!(Number.isFinite(grams) && grams > 0 && (!spoon || grams <= 100))) {
      toast(spoon ? 'Enter the weight of 1 tbsp, above 0 and up to 100 g.' : 'Enter the weight of one, in grams.', { error: true });
      return;
    }
    onSave(grams);
  };
  const one = name.toLowerCase();
  showPreview();
  return h('div', { class: 'measure need' },
    h('b', {}, spoon ? 'How much does 1 tbsp weigh?' : `How much does one ${one} weigh?`),
    h('p', {}, spoon
      ? `${product.name} is per 100 g and this amount is in ${SPOON_WORDS[unit]}. Weigh a level tablespoon, or check the jar.`
      : `${product.name} is ${per}, so this amount can’t be counted until Pinch knows what one weighs.`),
    h('div', { class: 'key-row' },
      spoon ? h('span', { class: 'eq' }, '1 tbsp =') : null,
      h('div', { class: 'unit-in' },
        h('input', {
          class: 'input', inputmode: 'decimal', value: text,
          'aria-label': spoon ? `Grams in 1 tbsp of ${product.name}` : `Weight of one ${one}`,
          placeholder: spoon ? '' : `One ${one} weighs`,
          oninput: (e) => { text = e.target.value; onInput?.(text); showPreview(); },
          onkeydown: (e) => { if (e.key === 'Enter') save(); },
        }),
        h('em', {}, 'g')),
      h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save')),
    preview,
    h('p', { class: 'hint' }, spoon
      ? 'Saved on the product, so every recipe measuring it in tsp, tbsp or cups counts too.'
      : 'Saved on the product, so every recipe using it can count it.'));
}
