// Send to Listly: a recipe's ingredients, scaled, onto one of the
// household's Listly shopping lists. Opened from a card's long-press menu
// and from the basket on the recipe sheet (starting at that sheet's
// servings).
//
// · Servings stepper, the shop (Listly's lists, in Listly's order; the last
//   one used on this device, else the starred one, else the first), and the
//   items, each ticked or not.
// · Unticked to begin with: "to taste" lines, and anything already on that
//   list and not yet ticked off there. Changing the shop re-checks the
//   second; a box the cook has touched keeps their choice.
// · One insert for every item (lib/shopping.js has the wording and Listly's
//   id and position rules; storage.addListlyItems the write).

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { openSheet, sheetHead, confirmSheet } from '../components/sheet.js';
import { stepper } from '../components/stepper.js';
import { toast } from '../components/toast.js';
import * as state from '../state.js';
import * as storage from '../storage.js';
import { getPrefs, setPref } from '../prefs.js';
import { displayName } from '../lib/recipes.js';
import { openEditor } from './editor.js';
import { shoppingLines, alreadyOn, appendPosition, listlyId, sortLists } from '../lib/shopping.js';

export function openSendToListly(recipeId, { servings: startServings } = {}) {
  const recipe = state.getRecipe(recipeId);
  if (!recipe) return null;
  let servings = startServings ?? recipe.serves;
  let lists = null;            // null while loading
  let listId = null;
  let items = [];              // the chosen list's items
  let listError = null;
  let busy = false;
  const touched = new Map();   // line key → the cook's own tick
  let onList = new Set();

  const body = h('div', { class: 'send-listly' });
  const sheet = openSheet(body, {
    kind: 'bottom', label: 'Send to Listly',
    beforeClose: () => { if (busy) { toast('Still adding — one moment'); return false; } return true; },
  });

  // Made once, so a tap on − or + keeps its focus through the re-render.
  const servingsStepper = stepper({ value: servings, min: 1, max: 99, label: 'servings', onChange: (v) => { servings = v; render(); } });
  const lines = () => shoppingLines(recipe, servings);
  const ticked = (l) => (touched.has(l.key) ? touched.get(l.key) : !l.toTaste && !onList.has(l.key));
  const list = () => lists?.find((l) => l.id === listId) ?? null;

  async function loadLists() {
    try {
      lists = sortLists(await storage.listlyLists(state.get().householdId));
      const remembered = getPrefs().listlyList;
      listId = (lists.find((l) => l.id === remembered) ?? lists.find((l) => l.is_default) ?? lists[0])?.id ?? null;
      if (listId) await loadItems();
    } catch (e) {
      lists = [];
      listError = e.message;
    }
    render();
  }

  async function loadItems() {
    const id = listId;
    try {
      const got = await storage.listlyItems(id);
      if (id !== listId) return;
      items = got;
      onList = alreadyOn(lines(), items);
    } catch (e) {
      items = [];
      onList = new Set();
      toast(e.message, { error: true });
    }
  }

  async function pickList(id) {
    if (id === listId || busy) return;
    listId = id;
    onList = new Set();
    render();
    await loadItems();
    render();
  }

  function render() {
    const all = lines();
    const chosen = all.filter(ticked);
    const target = list();
    clear(body,
      sheetHead('Send to Listly', { onClose: () => sheet.close() }),
      h('p', { class: 'hint' }, `${displayName(recipe.name)} · amounts for ${servings} serving${servings === 1 ? '' : 's'}`),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Servings'), servingsStepper),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Shop'), shops()),
      h('div', { class: 'field' },
        h('div', { class: 'field-head' }, h('span', { class: 'label' }, 'Items'),
          all.length ? h('span', { class: 'pick-all' },
            h('button', { class: 'btn quiet', type: 'button', onclick: () => { all.forEach((l) => touched.set(l.key, true)); render(); } }, 'All'),
            h('button', { class: 'btn quiet', type: 'button', onclick: () => { all.forEach((l) => touched.set(l.key, false)); render(); } }, 'None')) : null),
        all.length
          ? h('ul', { class: 'picks' }, all.map((l) => h('li', {}, h('label', { class: 'pick' },
            h('input', { type: 'checkbox', checked: ticked(l), onchange: (e) => { touched.set(l.key, e.target.checked); render(); } }),
            h('span', { class: 'txt' }, h('b', {}, l.text),
              onList.has(l.key) && target ? h('span', {}, `Already on ${target.name}`) : l.toTaste ? h('span', {}, 'To taste') : null)))))
          : h('p', { class: 'hint' }, 'This recipe has no ingredients yet.')),
      h('div', { class: 'sticky' },
        h('button', { class: 'btn primary big', type: 'button', disabled: busy || !target || !chosen.length, onclick: () => send(chosen) },
          icon('basket'),
          busy ? 'Adding…' : target ? `Add ${chosen.length} item${chosen.length === 1 ? '' : 's'} to ${target.name}` : 'Add to Listly')));
  }

  function shops() {
    if (lists == null) return h('p', { class: 'hint' }, 'Loading your Listly lists…');
    if (listError) return h('p', { class: 'note error', role: 'alert' }, listError);
    if (!lists.length) return h('p', { class: 'note' }, 'Your household has no Listly lists yet. Make one in Listly, then come back.');
    return h('div', { class: 'chips wrap', role: 'group', 'aria-label': 'Shop' }, lists.map((l) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(l.id === listId), onclick: () => pickList(l.id),
    }, l.name)));
  }

  async function send(chosen) {
    const target = list();
    if (!target || !chosen.length) return;
    busy = true; render();
    try {
      const start = appendPosition(items.map((i) => i.position));
      await storage.addListlyItems(state.get().householdId, target.id,
        chosen.map((l, n) => ({ id: listlyId(), text: l.text, done: false, position: start + n })));
      setPref('listlyList', target.id);
      busy = false;
      await sheet.close({ force: true });
      toast(`Added ${chosen.length} item${chosen.length === 1 ? '' : 's'} to ${target.name}`);
    } catch (e) {
      busy = false;
      render();
      toast(e.message, { error: true });
    }
  }

  render();
  loadLists();
  return sheet;
}

// The long-press menu on a Home card: Send to Listly, Edit recipe, and
// Delete recipe (asked first; the same delete as the editor's).
export function openCardMenu(recipeId) {
  const recipe = state.getRecipe(recipeId);
  if (!recipe) return null;
  const name = displayName(recipe.name);
  const s = openSheet(h('div', { class: 'card-menu' },
    sheetHead(name, { onClose: () => s.close() }),
    h('div', { class: 'list' },
      h('button', { class: 'row', type: 'button', onclick: async () => { await s.close(); openSendToListly(recipeId); } },
        icon('basket'), h('span', { class: 'txt' }, h('b', {}, 'Send to Listly'), h('span', {}, 'Add its ingredients to a shopping list')),
        h('span', { class: 'end' }, icon('chevron-right'))),
      h('button', { class: 'row', type: 'button', onclick: async () => { await s.close(); openEditor({ recipeId }); } },
        icon('pencil'), h('span', { class: 'txt' }, h('b', {}, 'Edit recipe')),
        h('span', { class: 'end' }, icon('chevron-right'))),
      h('button', { class: 'row danger-text', type: 'button', onclick: async () => { await s.close(); deleteFromMenu(recipeId, name); } },
        icon('trash'), h('span', { class: 'txt' }, h('b', {}, 'Delete recipe')))),
  ),
  { kind: 'bottom', label: name, className: 'sheet-menu' });
  return s;
}

async function deleteFromMenu(recipeId, name) {
  const ok = await confirmSheet({ title: `Delete \u201c${name}\u201d?`, body: DELETE_WARNING, confirm: 'Delete', danger: true });
  if (!ok) return;
  try {
    await state.deleteRecipe(recipeId);
    toast('Recipe deleted');
  } catch (e) {
    toast(e.message, { error: true });
  }
}

const DELETE_WARNING = 'It goes for everyone in your household, in Pinch and in BLOC. This can\u2019t be undone.';
