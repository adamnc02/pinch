// Home (screens 01 / 02): the wordmark and Settings, By meal | By cuisine,
// the chip row, the card grid between two edge fades, and the add button.
// Only the grid scrolls. One click listener handles every card.
// A long press (500 ms without moving), or a right-click / the context-menu
// key, opens the card's menu instead (Send to Listly), and the click that
// ends the press is swallowed so the recipe doesn't also open.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { flag } from '../components/flag.js';
import * as state from '../state.js';
import { getPrefs, setPref } from '../prefs.js';
import { cuisinesInUse, filterRecipes, sortRecipes, MEALS, mealLabel, displayName } from '../lib/recipes.js';
import { cuisineName } from '../lib/cuisines.js';
import { photoUrl } from '../storage.js';
import { openRecipe } from '../router.js';
import { openCardMenu } from './listly.js';

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10;

let filter = { mode: getPrefs().homeMode === 'cuisine' ? 'cuisine' : 'meal', value: null };
let els = null;

export function mountHome(root, { onAdd, onSettings }) {
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Group recipes' });
  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter' });
  const grid = h('div', { class: 'grid' });
  const notice = h('div', { class: 'notice', hidden: true });
  els = { seg, chips, grid, notice };

  clear(root,
    h('header', { class: 'app-header' },
      h('h1', { class: 'wordmark' }, 'Pinch'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Settings', onclick: onSettings }, icon('gear', { size: 22, stroke: 1.7 }))),
    h('div', { class: 'filters' }, seg, chips),
    h('div', { class: 'scroll' },
      grid,
      h('div', { class: 'edge-fade edge-fade-top', 'aria-hidden': 'true' }),
      h('div', { class: 'edge-fade edge-fade-bottom', 'aria-hidden': 'true' })),
    h('button', { class: 'fab', type: 'button', 'aria-label': 'Add recipe', onclick: onAdd }, icon('plus')));

  let press = null;
  const cancelPress = () => { if (press) clearTimeout(press.timer); if (press && !press.fired) press = null; };
  const menuFor = (p) => { p.fired = performance.now(); navigator.vibrate?.(10); openCardMenu(p.id); };
  grid.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('[data-recipe]');
    if (!card || e.button !== 0) return;
    const id = card.dataset.recipe;
    const p = { id, x: e.clientX, y: e.clientY, fired: 0 };
    p.timer = setTimeout(() => menuFor(p), LONG_PRESS_MS);
    press = p;
  });
  grid.addEventListener('pointermove', (e) => {
    if (press && !press.fired && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE) cancelPress();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => grid.addEventListener(t, cancelPress));
  grid.addEventListener('scroll', cancelPress, { passive: true });
  grid.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('[data-recipe]');
    if (!card) return;
    e.preventDefault();
    if (press?.fired && performance.now() - press.fired < 1500) return;   // the timer already opened it
    if (press) clearTimeout(press.timer);
    press = { id: card.dataset.recipe, fired: 0 };
    menuFor(press);
  });
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-recipe]');
    // Only the click that ends the press itself: a stale one never swallows a later tap or Enter.
    if (press?.fired && performance.now() - press.fired < 1500) { press = null; e.preventDefault(); return; }
    press = null;
    if (card) openRecipe(card.dataset.recipe);
  });
  state.subscribe(render);
  render();
}

function setFilter(next) {
  filter = next;
  if (next.mode !== getPrefs().homeMode) setPref('homeMode', next.mode);
  render();
}

function render() {
  if (!els) return;
  const s = state.get();
  const { seg, chips, grid, notice } = els;

  clear(seg,
    ['meal', 'cuisine'].map((mode) => h('button', {
      type: 'button', 'aria-pressed': String(filter.mode === mode),
      onclick: () => filter.mode !== mode && setFilter({ mode, value: null }),
    }, mode === 'meal' ? 'By meal' : 'By cuisine')));

  // A cuisine chip only exists for a cuisine in use; if the chosen one
  // disappears (its last recipe deleted), fall back to All.
  const cuisines = cuisinesInUse(sortRecipes(s.recipes));
  if (filter.mode === 'cuisine' && filter.value && !cuisines.includes(filter.value)) filter = { ...filter, value: null };
  const values = filter.mode === 'meal' ? MEALS : cuisines;
  clear(chips,
    h('button', { class: 'chip', type: 'button', 'aria-pressed': String(filter.value == null), onclick: () => setFilter({ ...filter, value: null }) }, 'All'),
    values.map((v) => h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(filter.value === v),
      onclick: () => setFilter({ ...filter, value: v }),
    }, filter.mode === 'cuisine' ? [flag(v, 'sm'), cuisineName(v)] : mealLabel(v))));

  notice.hidden = !(s.status === 'offline' || s.status === 'error');
  if (!notice.hidden) {
    clear(notice, s.status === 'offline'
      ? 'You’re offline. These are the recipes Pinch last saw; changes need a connection.'
      : s.error ?? 'Pinch couldn’t load your recipes.',
    h('button', { class: 'btn quiet', type: 'button', onclick: () => state.reload() }, 'Try again'));
  }

  const shown = filterRecipes(sortRecipes(s.recipes), filter);
  if (s.status === 'loading' && !s.recipes.length) {
    clear(grid, notice, Array.from({ length: 4 }, () => h('div', { class: 'card skeleton', 'aria-hidden': 'true' })));
    return;
  }
  if (!shown.length) {
    clear(grid, notice, h('div', { class: 'empty' },
      h('p', {}, s.recipes.length ? 'No recipes here yet.' : 'No recipes yet.'),
      h('p', { class: 'hint' }, s.recipes.length ? 'Choose All, or add one with the + button.' : 'Add your first with the + button.')));
    return;
  }
  clear(grid, notice, shown.map(card));
}

function card(r) {
  const meta = [mealLabel(r.meal), cuisineName(r.cuisine)].filter(Boolean).join(' · ');
  const media = h('div', { class: `media ${r.photoPath ? 'photo' : 'flagged'}` });
  if (r.photoPath) {
    media.append(icon('image', { size: 26, stroke: 1.6 }));
    photoUrl(r.photoPath).then((url) => {
      if (!url) return;
      const img = h('img', { src: url, alt: '', loading: 'lazy', decoding: 'async' });
      img.addEventListener('load', () => media.replaceChildren(img));
    });
  } else {
    media.append(flag(r.cuisine, 'lg'));
  }
  return h('button', { class: 'card', type: 'button', dataset: { recipe: r.id }, 'aria-label': `${displayName(r.name)}, ${meta}` },
    media,
    h('div', { class: 'body' }, h('div', { class: 'text' }, h('h3', {}, displayName(r.name)), h('p', {}, meta))));
}
