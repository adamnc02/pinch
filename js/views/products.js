// Your products: the household's whole product library, searched by name,
// brand or barcode, to link to an ingredient. Opened from Add ingredient
// ("Search all your products", or Change on a linked product) and from
// Check ingredients ("Your products"), so a product already in the
// household is found again rather than scanned again.
//
// Empty search: the products matching the ingredient's name first, then
// every product A–Z. Not there: Scan barcode or New product, both of which
// add to the library and link the result.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { openSheet, sheetHead } from '../components/sheet.js';
import * as state from '../state.js';
import { trimNumber } from '../lib/format.js';
import { openScanner } from './scanner.js';
import { openProductForm } from './product.js';

export const productSummary = (p) => {
  const per = { '100g': 'per 100 g', '100ml': 'per 100 ml', item: 'per item' }[p.basis];
  return [
    p.brand,
    p.gramsPerItem && p.basis !== 'item' ? `${trimNumber(p.gramsPerItem, 1)} g each` : null,
    p.gramsPerTbsp && p.basis === '100g' ? `1 tbsp = ${trimNumber(p.gramsPerTbsp, 1)} g` : null,
    `${trimNumber(p.kcal ?? 0, 1)} kcal ${per}`,
  ].filter(Boolean).join(' · ');
};

export function openProductSearch({ forName = '', onPick }) {
  let query = '';
  const body = h('div', { class: 'products' });
  const sheet = openSheet(body, { kind: 'bottom', label: 'Your products' });
  const list = h('div', { class: 'product-results' });

  const pick = async (p) => {
    await sheet.close();
    onPick(p);
  };

  const rowFor = (p) => h('button', { class: 'suggest', type: 'button', onclick: () => pick(p) },
    h('span', { class: 'pk' }, icon('package')),
    h('span', { class: 'txt' }, h('b', {}, p.name), h('span', {}, productSummary(p))),
    h('span', { class: 'go' }, 'Use'));

  function renderList() {
    const all = [...state.get().products].sort((a, b) => a.name.localeCompare(b.name));
    const q = query.trim();
    if (!all.length) {
      clear(list, h('p', { class: 'hint pad' }, 'No products yet. Scan one, or add it from the label.'));
      return;
    }
    if (q) {
      const found = state.searchProducts(q, Infinity);
      clear(list,
        h('span', { class: 'label' }, found.length ? `${found.length} match “${q}”` : `Nothing matches “${q}”`),
        found.map(rowFor));
      return;
    }
    const matching = forName ? state.searchProducts(forName, 6) : [];
    const ids = new Set(matching.map((p) => p.id));
    clear(list,
      matching.length ? [h('span', { class: 'label' }, `Matching “${forName}”`), matching.map(rowFor)] : null,
      h('span', { class: 'label' }, `All products · ${all.length}`),
      all.filter((p) => !ids.has(p.id)).map(rowFor));
  }

  clear(body,
    sheetHead('Your products', { onBack: () => sheet.close(), onClose: () => sheet.close() }),
    forName ? h('p', { class: 'hint' }, `For: ${forName}`) : null,
    h('div', { class: 'search-in' }, icon('search'),
      h('input', {
        class: 'input', type: 'search', placeholder: 'Name, brand or barcode', 'aria-label': 'Search your products',
        autocomplete: 'off', enterkeyhint: 'search',
        oninput: (e) => { query = e.target.value; renderList(); },
      })),
    list,
    h('div', { class: 'sticky two' },
      h('button', { class: 'btn secondary', type: 'button', onclick: () => openScanner({ forName: forName || null, onProduct: pick }) }, icon('barcode'), 'Scan barcode'),
      h('button', { class: 'btn secondary', type: 'button', onclick: () => openProductForm({ initial: { name: forName }, onSaved: pick }) }, icon('keyboard'), 'New product')));
  renderList();
  return sheet;
}
