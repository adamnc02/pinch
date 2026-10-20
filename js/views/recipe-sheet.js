// The recipe sheet (screens 03 / 04), centred over a scrim.
//
// · The servings stepper rescales every amount live, one serving at a time,
//   minimum 1. It opens at the recipe's own servings and saves nothing.
// · Ingredients | Method flips the content like a card (rotateY, ~450 ms);
//   the header stays still. With prefers-reduced-motion it cross-fades.
// · Per-serving nutrition comes only from pinch.recipe_nutrition, so it does
//   not change with the stepper.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { flag } from '../components/flag.js';
import { openSheet } from '../components/sheet.js';
import * as state from '../state.js';
import { onPrefs, amountOpts } from '../prefs.js';
import { scaleRecipe } from '../lib/scale.js';
import { formatAmount, trimNumber } from '../lib/format.js';
import { stepLine } from '../lib/method.js';
import { mealLabel } from '../lib/recipes.js';
import { cuisineName } from '../lib/cuisines.js';
import { photoUrl } from '../storage.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function openRecipeSheet(id, { onEdit, onCheck, onClose }) {
  let recipe = state.getRecipe(id);
  if (!recipe) return null;
  let servings = recipe.serves;
  let tab = 'ingredients';

  const hero = h('div', { class: 'hero' });
  const servingsOut = h('span', { class: 'mult', 'aria-live': 'polite' });
  const recipeServes = h('small');
  const minus = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Fewer servings', onclick: () => step(-1) }, icon('minus'));
  const plus = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'More servings', onclick: () => step(1) }, icon('plus'));
  const tabs = h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Recipe' });
  const face = h('div', { class: 'face', role: 'tabpanel' });
  const flip = h('div', { class: 'flip' }, face);

  const content = h('div', { class: 'recipe' },
    hero,
    h('div', { class: 'sheet-body' },
      h('div', { class: 'scaler' },
        h('div', {}, h('div', { class: 'lbl' }, 'Serves'), h('div', { class: 'val' }, recipeServes)),
        h('div', { class: 'ctrl' }, minus, servingsOut, plus)),
      tabs,
      flip));

  const sheet = openSheet(content, {
    kind: 'centre', label: recipe.name, className: 'sheet-recipe',
    onClose: () => { unsub(); unprefs(); onClose?.(); },
  });

  function step(d) {
    servings = Math.max(1, Math.min(99, servings + d));
    renderAmounts();
  }

  function renderHero() {
    const tags = [mealLabel(recipe.meal), cuisineName(recipe.cuisine)].filter(Boolean).join(' · ');
    const media = recipe.photoPath ? h('div', { class: 'ph', 'aria-hidden': 'true' }, icon('image', { size: 34, stroke: 1.5 })) : h('div', { class: 'hero-flag' }, flag(recipe.cuisine, 'lg'));
    hero.className = `hero ${recipe.photoPath ? '' : 'flagged'}`;
    clear(hero,
      media,
      h('div', { class: 'fade', 'aria-hidden': 'true' }),
      h('div', { class: 'tags' }, tags),
      h('button', { class: 'icon-btn close', type: 'button', 'aria-label': 'Close', onclick: () => sheet.close() }, icon('x')),
      h('div', { class: 'title-row' },
        h('button', { class: 'icon-btn edit', type: 'button', 'aria-label': 'Edit recipe', onclick: () => onEdit(recipe.id) }, icon('pencil')),
        h('h2', {}, recipe.name)));
    if (recipe.photoPath) {
      photoUrl(recipe.photoPath).then((url) => {
        if (!url) return;
        const img = h('img', { class: 'hero-img', src: url, alt: '' });
        img.addEventListener('load', () => media.replaceWith(img));
      });
    }
  }

  function renderTabs() {
    clear(tabs, [['ingredients', 'Ingredients'], ['method', 'Method']].map(([key, label]) => h('button', {
      type: 'button', role: 'tab', 'aria-selected': String(tab === key), 'aria-pressed': String(tab === key),
      onclick: () => switchTab(key),
    }, label)));
  }

  function amountFor(i) {
    return formatAmount(i.qty, i.unit, { ...amountOpts(), density: state.densityForIngredient(i) });
  }

  function ingredientsFace() {
    const scaled = scaleRecipe(recipe, servings);
    if (!scaled.ingredients.length) return [h('p', { class: 'hint pad' }, 'No ingredients yet. Tap the pencil to add some.')];
    return [
      h('ul', { class: 'ings' }, scaled.ingredients.map((i) => h('li', {}, h('span', {}, i.name), h('b', {}, amountFor(i))))),
      nutritionBlock(),
    ];
  }

  function nutritionBlock() {
    const n = state.get().nutrition[recipe.id];
    const missing = recipe.ingredients.filter((i) => ['no_product', 'unconvertible'].includes(state.get().ingredientStatus[i.id]));
    if (!n) return null;
    const fmt = (v, unit) => `${trimNumber(Math.round(v), 0)}${unit}`;
    return h('div', { class: 'nutrition' },
      h('div', { class: 'nut-head' }, h('span', {}, 'Per serving'), h('span', { class: 'hint' }, `recipe serves ${recipe.serves}`)),
      n.counted
        ? h('div', { class: 'macros' },
          h('div', {}, h('b', {}, fmt(n.kcal, '')), h('span', {}, 'kcal')),
          h('div', {}, h('b', {}, fmt(n.protein, ' g')), h('span', {}, 'protein')),
          h('div', {}, h('b', {}, fmt(n.carbs, ' g')), h('span', {}, 'carbs')),
          h('div', {}, h('b', {}, fmt(n.fat, ' g')), h('span', {}, 'fat')))
        : null,
      missing.length
        ? h('button', { class: 'needs', type: 'button', onclick: () => onCheck(recipe.id) },
          h('span', {}, `${missing.length} ${missing.length === 1 ? 'needs' : 'need'} nutrition`),
          h('span', { class: 'which' }, missing.map((i) => i.name).join(', ')),
          icon('chevron-right'))
        : null);
  }

  function methodFace() {
    if (!recipe.steps.length) return [h('p', { class: 'hint pad' }, 'No method yet. Tap the pencil to add the steps.')];
    const opts = { ...amountOpts(), densityFor: state.densityForIngredient };
    return [h('ol', { class: 'steps' }, recipe.steps.map((s, n) => {
      const line = stepLine(recipe, s, servings, opts);
      return h('li', {}, h('span', { class: 'n', 'aria-hidden': 'true' }, String(n + 1)),
        h('div', {}, h('p', {}, s.text), line ? h('p', { class: 'tagged' }, line) : null));
    }))];
  }

  function renderFace() {
    clear(face, tab === 'ingredients' ? ingredientsFace() : methodFace());
  }

  function renderAmounts() {
    servingsOut.textContent = String(servings);
    recipeServes.textContent = `recipe serves ${recipe.serves}`;
    minus.disabled = servings <= 1;
    renderFace();
  }

  async function switchTab(next) {
    if (next === tab) return;
    tab = next;
    renderTabs();
    if (reduced()) {
      await face.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-in' }).finished.catch(() => {});
      renderFace();
      face.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
      return;
    }
    const dir = next === 'method' ? 1 : -1;
    await face.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${90 * dir}deg)` }], { duration: 225, easing: 'ease-in' }).finished.catch(() => {});
    renderFace();
    face.animate([{ transform: `rotateY(${-90 * dir}deg)` }, { transform: 'rotateY(0deg)' }], { duration: 225, easing: 'ease-out' });
  }

  function renderAll() {
    renderHero();
    renderTabs();
    renderAmounts();
  }

  const unsub = state.subscribe(() => {
    const fresh = state.getRecipe(id);
    if (!fresh) { sheet.close({ force: true }); return; }
    if (fresh !== recipe && fresh.serves !== recipe.serves) servings = fresh.serves;
    recipe = fresh;
    sheet.sheet.setAttribute('aria-label', recipe.name);
    renderAll();
  });
  const unprefs = onPrefs(() => renderAmounts());
  renderAll();
  return sheet;
}
