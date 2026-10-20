// Settings › Import recipes from BLOC: choose the backup, tick recipes,
// give each a meal (and a cuisine — BLOC has neither), import, then see the
// reconciliation: Pinch's per-serving figures from recipe_nutrition beside
// BLOC's. Re-running is safe: a recipe already imported (same
// bloc_recipe_id) is offered as a replacement, never duplicated.
//
// 🚨 Only `recipes` and `foodLibrary` are read from the file (see
// lib/bloc-import.js). The rest of the backup never leaves this function.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { openSheet, sheetHead } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import * as state from '../state.js';
import { readBlocBackup, mapBlocRecipe, estimatePerServing, reconcile } from '../lib/bloc-import.js';
import { MEALS, mealLabel } from '../lib/recipes.js';
import { CUISINES } from '../lib/cuisines.js';
import { trimNumber } from '../lib/format.js';

export function openBlocImport() {
  let backup = null;
  let picks = new Map();   // bloc id → { meal, cuisine }
  let results = null;
  let busy = false;
  let error = null;

  const body = h('div', { class: 'bloc-import' });
  const sheet = openSheet(body, { kind: 'bottom', label: 'Import from BLOC' });
  const existing = () => new Map(state.get().recipes.filter((r) => r.blocRecipeId).map((r) => [r.blocRecipeId, r]));

  function render() {
    const head = sheetHead('Import from BLOC', { onBack: () => sheet.close(), onClose: () => sheet.close() });
    if (results) return clear(body, head, resultsView());
    if (!backup) {
      const input = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', onchange: pick });
      return clear(body, head,
        h('p', { class: 'hint' }, 'In BLOC, open Settings \u203a My data \u203a Backup \u203a Export and choose Local file. Then choose that file here. Pinch reads only its recipes and food library; nothing else in the file is kept.'),
        h('label', { class: 'photo-drop' }, input, icon('upload'), h('span', {}, h('b', {}, 'Choose a BLOC backup'), h('span', {}, 'bloc-backup-….json'))),
        error ? h('p', { class: 'field-error', role: 'alert' }, error) : null);
    }
    const already = existing();
    const n = picks.size;
    clear(body, head,
      h('p', { class: 'hint' }, `${backup.recipes.length} recipes in this backup. Tick the ones to bring across and give each a meal. Recipes you import here are locked in BLOC, which then reads them from Pinch.`),
      h('ul', { class: 'bloc-list' }, backup.recipes.map((r) => {
        const on = picks.has(r.id);
        const pick = picks.get(r.id);
        return h('li', { class: on ? 'on' : '' },
          h('label', { class: 'bloc-row' },
            h('input', { type: 'checkbox', checked: on, onchange: (e) => { if (e.target.checked) picks.set(r.id, { meal: null, cuisine: null }); else picks.delete(r.id); render(); } }),
            h('span', { class: 'txt' }, h('b', {}, r.name),
              h('span', {}, `Serves ${trimNumber(r.servings, 1)} · ${Math.round(r.per_serving_kcal)} kcal a serving${already.has(r.id) ? ' · already imported, will be replaced' : ''}`))),
          on ? h('div', { class: 'two' },
            h('div', { class: 'input select' }, h('span', {}, pick.meal ? mealLabel(pick.meal) : 'Meal…'), icon('chevron'),
              h('select', { 'aria-label': `Meal for ${r.name}`, onchange: (e) => { pick.meal = e.target.value || null; render(); } },
                h('option', { value: '' }, 'Meal…'), MEALS.map((m) => h('option', { value: m, selected: pick.meal === m }, mealLabel(m))))),
            h('div', { class: 'input select' }, h('span', {}, pick.cuisine ? CUISINES.find((c) => c.code === pick.cuisine).name : 'No cuisine'), icon('chevron'),
              h('select', { 'aria-label': `Cuisine for ${r.name}`, onchange: (e) => { pick.cuisine = e.target.value || null; render(); } },
                h('option', { value: '' }, 'No cuisine'), CUISINES.map((c) => h('option', { value: c.code, selected: pick.cuisine === c.code }, c.name))))) : null);
      })),
      error ? h('p', { class: 'field-error', role: 'alert' }, error) : null,
      h('button', { class: 'btn primary big', type: 'button', disabled: busy || !n, onclick: run },
        busy ? 'Importing…' : n ? `Import ${n} recipe${n > 1 ? 's' : ''}` : 'Tick a recipe'));
  }

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const out = readBlocBackup(await file.text());
    if (out.error) { error = out.error; render(); return; }
    if (!out.recipes.length) { error = 'That backup has no recipes.'; render(); return; }
    backup = out;
    error = null;
    render();
  }

  async function run() {
    const chosen = backup.recipes.filter((r) => picks.has(r.id));
    const noMeal = chosen.filter((r) => !picks.get(r.id).meal);
    if (noMeal.length) { error = `Choose a meal for ${noMeal.map((r) => r.name).join(', ')}.`; render(); return; }
    busy = true; error = null; render();
    const already = existing();
    const pending = [];
    const mapped = chosen.map((r) => {
      const m = mapBlocRecipe(r, backup.foodLibrary, state.get().products, { pending });
      pending.push(...m.newProducts);
      const prior = already.get(r.id);
      m.recipe = { ...m.recipe, ...picks.get(r.id), ...(prior ? { id: prior.id, steps: prior.steps.filter((s) => !s.ingredientIds.length), photoPath: prior.photoPath } : {}) };
      return { bloc: r, ...m };
    });
    try {
      for (const p of pending) await state.saveProduct(p);
      for (const m of mapped) await state.saveRecipe(m.recipe);
      results = mapped.map((m) => ({ ...m, estimate: estimatePerServing(m.recipe, [...state.get().products]) }));
    } catch (err) {
      error = err.message;
    }
    busy = false;
    render();
  }

  function resultsView() {
    const rows = results.map((m) => {
      const n = state.get().nutrition[m.recipe.id];
      const pinch = n ? { kcal: n.kcal, protein: n.protein, carbs: n.carbs, fat: n.fat } : m.estimate;
      const rec = reconcile(pinch, m.bloc);
      return h('li', { class: rec.ok ? '' : 'mismatch' },
        h('b', {}, m.recipe.name),
        h('table', { class: 'recon' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Pinch'), h('th', {}, 'BLOC'))),
          h('tbody', {}, rec.rows.map((r) => h('tr', { class: r.ok ? '' : 'off' },
            h('td', {}, r.macro), h('td', {}, trimNumber(r.pinch, 1)), h('td', {}, trimNumber(r.bloc, 1)))))),
        rec.ok ? h('p', { class: 'hint' }, 'Matches BLOC within rounding.') : h('p', { class: 'field-error' }, 'Differs from BLOC. Check the highlighted figures and the ingredients’ products.'),
        m.problems.length ? h('ul', { class: 'problems' }, m.problems.map((p) => h('li', {}, `${p.name} ${p.reason}`))) : null);
    });
    return [
      h('p', {}, `Imported ${results.length} recipe${results.length > 1 ? 's' : ''}. Per serving:`),
      h('ul', { class: 'recon-list' }, rows),
      h('button', { class: 'btn primary big', type: 'button', onclick: () => { sheet.close(); toast('BLOC recipes imported'); } }, 'Done'),
    ];
  }

  render();
  return sheet;
}
