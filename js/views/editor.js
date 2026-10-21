// New / Edit recipe (screens 05, 06, 14, 15), a bottom sheet.
//
// · New recipes start on two tiles: Enter ingredients, or Import from web.
// · The form edits a COPY of the recipe; nothing reaches state.js until
//   Save, and closing with changes asks "Discard changes?".
// · Ingredient and step ids are made when the row is created, so a step can
//   tag an ingredient added in the same unsaved edit.
// · The method editor: free-text steps, one open at a time, "Tap the
//   ingredients this step uses" chips (tags are ingredient ids), arrows to
//   move a step, the bin to delete. Deleting an ingredient removes its tags.
// · With Nutrition and barcodes off (state.nutritionOn), there is no Scan
//   barcode, no "needs nutrition" and no Check ingredients step after an
//   import: the import goes straight to the method.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { flag } from '../components/flag.js';
import { openSheet, sheetHead, confirmSheet } from '../components/sheet.js';
import { stepper } from '../components/stepper.js';
import { toast } from '../components/toast.js';
import { resizePhoto } from '../components/photo.js';
import * as state from '../state.js';
import * as storage from '../storage.js';
import { amountOpts, getAiKey } from '../prefs.js';
import * as claude from '../claude.js';
import { blankRecipe, blankStep } from '../lib/ids.js';
import { validateRecipe } from '../lib/validate.js';
import { removeIngredient, moveStep, toggleTag, stepLine } from '../lib/method.js';
import { formatAmount } from '../lib/format.js';
import { MEALS, mealLabel, splitMealPrefix, displayName } from '../lib/recipes.js';
import { CUISINES, cuisineName } from '../lib/cuisines.js';
import { splitRecipeText, draftFromImport, looksLikeUrl, hostOf, parseIngredientLine, servesFrom, mealFrom } from '../lib/parse.js';
import { openIngredientEditor } from './ingredient.js';
import { openCheckIngredients } from './check.js';
import { openScanner } from './scanner.js';

export function openEditor({ recipeId = null, onSaved, onDeleted } = {}) {
  const original = recipeId ? state.getRecipe(recipeId) : null;
  let draft = structuredClone(original ?? blankRecipe());
  let mode = original ? 'enter' : 'enter';
  let editingStep = null;
  let photoBlob = null;        // a new photo, uploaded on save
  let uploadedPath = null;     // its path once uploaded, so a retried save doesn't upload it again
  let photoPreview = null;
  let removePhoto = false;
  let busy = false;
  let showErrors = false;
  const startJson = JSON.stringify(draft);
  const isDirty = () => JSON.stringify(draft) !== startJson || photoBlob || removePhoto;

  const body = h('div', { class: 'editor' });
  const sheet = openSheet(body, {
    kind: 'bottom', label: original ? 'Edit recipe' : 'New recipe',
    // While a save or an import is in flight the sheet stays open: closing
    // would drop the draft, or leave an import landing on a dead editor.
    beforeClose: async () => {
      if (busy) { toast('Still working \u2014 one moment'); return false; }
      return !isDirty() || confirmSheet({ title: 'Discard changes?', body: 'This recipe hasn\u2019t been saved.', confirm: 'Discard', danger: true });
    },
  });

  // ── rendering ────────────────────────────────────────────────────────────
  function render() {
    const parts = [sheetHead(original ? 'Edit recipe' : 'New recipe', { onClose: () => sheet.close() })];
    if (!original) {
      parts.push(h('div', { class: 'two' },
        tile('enter', 'list-plus', 'Enter ingredients', 'Scan or type'),
        tile('import', 'globe', 'Import from web', 'Paste a link or text')));
    }
    parts.push(...(mode === 'import' ? importForm() : enterForm()));
    clear(body, parts);
  }

  function tile(key, ic, title, sub) {
    return h('button', { class: 'option', type: 'button', 'aria-pressed': String(mode === key), onclick: () => { mode = key; render(); } },
      icon(ic), h('b', {}, title), h('span', {}, sub));
  }

  // ── Enter ingredients ────────────────────────────────────────────────────
  function enterForm() {
    const problems = showErrors ? validateRecipe(draft) : [];
    const err = (field) => problems.find((p) => p.field === field)?.message;
    return [
      field('Recipe name', h('input', {
        // The field shows the name without a "(Meal) " prefix; a stored prefix
        // (a recipe from BLOC) is kept silently on every edit.
        class: 'input', id: 'rn', value: splitMealPrefix(draft.name).title, placeholder: 'e.g. Chana masala', autocomplete: 'off',
        'aria-invalid': err('name') ? 'true' : null,
        oninput: (e) => { draft.name = splitMealPrefix(draft.name).prefix + e.target.value; },
      }), err('name'), 'rn'),
      h('div', { class: 'two' },
        field('Serves', stepper({ value: draft.serves, label: 'servings', onChange: (v) => { draft.serves = v; } })),
        field('Cuisine', cuisineSelect())),
      field('Meal', h('div', { class: 'three', role: 'group', 'aria-label': 'Meal' }, MEALS.map((m) => h('button', {
        class: 'meal', type: 'button', 'aria-pressed': String(draft.meal === m),
        onclick: () => { draft.meal = m; render(); },
      }, mealLabel(m)))), err('meal')),
      photoField(),
      ingredientsField(problems),
      methodField(),
      problems.length ? h('ul', { class: 'problems', role: 'alert' }, problems.map((p) => h('li', {}, p.message))) : null,
      h('button', { class: 'btn primary big', type: 'button', disabled: busy, onclick: save }, busy ? 'Saving…' : 'Save recipe'),
      original ? h('button', { class: 'btn quiet danger-text', type: 'button', onclick: del }, icon('trash'), 'Delete recipe') : null,
    ];
  }

  function field(label, control, error = null, forId = null) {
    return h('div', { class: 'field' },
      forId ? h('label', { for: forId }, label) : h('span', { class: 'label' }, label),
      control,
      error ? h('span', { class: 'field-error' }, error) : null);
  }

  function cuisineSelect() {
    const select = h('select', { 'aria-label': 'Cuisine', onchange: (e) => { draft.cuisine = e.target.value || null; render(); } },
      h('option', { value: '' }, 'No cuisine'),
      CUISINES.map((c) => h('option', { value: c.code, selected: draft.cuisine === c.code }, c.name)));
    return h('div', { class: 'input select' },
      draft.cuisine ? flag(draft.cuisine, 'sm') : null,
      h('span', {}, draft.cuisine ? cuisineName(draft.cuisine) : 'No cuisine'),
      icon('chevron'), select);
  }

  function photoField() {
    const input = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', onchange: pickPhoto });
    const has = (photoPreview || (draft.photoPath && !removePhoto));
    const thumb = h('span', { class: 'photo-thumb', 'aria-hidden': 'true' }, icon('image'));
    if (photoPreview) thumb.replaceChildren(h('img', { src: photoPreview, alt: '' }));
    else if (has) storage.photoUrl(draft.photoPath).then((u) => u && thumb.replaceChildren(h('img', { src: u, alt: '' })));
    return h('div', { class: 'photo-row' },
      h('label', { class: 'photo-drop' }, input, thumb,
        h('span', {}, h('b', {}, has ? 'Change the photo' : 'Add a photo'),
          h('span', {}, has ? 'Shown on the card and the recipe' : 'Optional · the flag is used if you skip this'))),
      has ? h('button', { class: 'btn quiet', type: 'button', onclick: () => { photoBlob = null; photoPreview = null; removePhoto = true; render(); } }, 'Remove') : null);
  }

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      photoBlob = await resizePhoto(file);
      uploadedPath = null;
      photoPreview = URL.createObjectURL(photoBlob);
      removePhoto = false;
      render();
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  function ingredientsField(problems) {
    const nutritionOn = state.get().nutritionOn;
    const needs = nutritionOn ? draft.ingredients.filter((i) => i.qty != null && i.unit !== 'to taste' && !i.productId).length : 0;
    return h('div', { class: 'field' },
      h('div', { class: 'field-head' }, h('span', { class: 'label' }, 'Ingredients'),
        h('span', { class: 'hint' }, draft.ingredients.length ? `${draft.ingredients.length} added` : '')),
      nutritionOn
        ? h('div', { class: 'two' },
          h('button', { class: 'btn primary', type: 'button', onclick: scanNew }, icon('barcode'), 'Scan barcode'),
          h('button', { class: 'btn secondary', type: 'button', onclick: () => editIngredient(null) }, 'Add manually'))
        : h('button', { class: 'btn secondary', type: 'button', onclick: () => editIngredient(null) }, icon('plus'), 'Add ingredient'),
      draft.ingredients.length
        ? h('ul', { class: 'rows' }, draft.ingredients.map((i, n) => {
          const bad = problems.some((p) => p.field === `ingredients.${n}`);
          const missing = nutritionOn && i.qty != null && i.unit !== 'to taste' && !i.productId;
          return h('li', {}, h('button', { class: `row-item ${bad ? 'bad' : ''}`, type: 'button', onclick: () => editIngredient(i.id) },
            h('span', { class: 'txt' }, h('span', {}, i.name || 'Unnamed'), missing ? h('em', {}, 'needs nutrition') : null),
            h('b', {}, formatAmount(i.qty, i.unit, { ...amountOpts(), density: state.densityForIngredient(i) }))));
        }))
        : null,
      needs ? h('button', { class: 'btn quiet', type: 'button', onclick: checkAll }, `Check ingredients · ${needs} need nutrition`) : null);
  }

  function editIngredient(id) {
    const existing = id ? draft.ingredients.find((i) => i.id === id) : null;
    openIngredientEditor({
      ingredient: existing,
      onSave: (ing) => {
        draft.ingredients = existing ? draft.ingredients.map((i) => (i.id === ing.id ? ing : i)) : [...draft.ingredients, ing];
        render();
      },
      onDelete: existing ? () => { draft = removeIngredient(draft, id); render(); } : null,
    });
  }

  function scanNew() {
    openScanner({
      forName: null,
      onProduct: (product) => {
        const ing = { id: crypto.randomUUID(), name: product.name, qty: null, unit: product.basis === '100ml' ? 'ml' : product.basis === 'item' ? 'each' : 'g', productId: product.id };
        openIngredientEditor({ ingredient: ing, isNew: true, onSave: (saved) => { draft.ingredients = [...draft.ingredients, saved]; render(); } });
      },
    });
  }

  function checkAll() {
    openCheckIngredients({
      recipe: draft,
      finishLabel: 'Done',
      onChange: (next) => { draft = next; render(); },
      onFinish: (next) => { draft = next; render(); },
    });
  }

  function methodField() {
    return h('div', { class: 'field method' },
      h('span', { class: 'label' }, 'Method'),
      draft.steps.length ? h('ol', { class: 'msteps' }, draft.steps.map((s, n) => stepItem(s, n))) : null,
      h('button', { class: 'btn secondary', type: 'button', onclick: addStep }, icon('plus'), 'Add step'));
  }

  function stepItem(s, n) {
    if (editingStep !== s.id) {
      const line = stepLine(draft, s, draft.serves, { ...amountOpts(), densityFor: state.densityForIngredient });
      return h('li', {}, h('span', { class: 'n', 'aria-hidden': 'true' }, String(n + 1)),
        h('button', { class: 'body as-button', type: 'button', 'aria-label': `Edit step ${n + 1}`, onclick: () => { editingStep = s.id; render(); focusStep(); } },
          h('p', {}, s.text || h('span', { class: 'hint' }, 'Empty step')), line ? h('p', { class: 'tagged' }, line) : null));
    }
    return h('li', { class: 'editing' }, h('span', { class: 'n', 'aria-hidden': 'true' }, String(n + 1)),
      h('div', { class: 'body' },
        h('textarea', { 'aria-label': `Step ${n + 1}`, 'data-step': s.id, oninput: (e) => { s.text = e.target.value; } }, s.text),
        draft.ingredients.length ? [
          h('span', { class: 'tag-lbl' }, 'Tap the ingredients this step uses'),
          h('div', { class: 'chips', role: 'group', 'aria-label': `Ingredients used in step ${n + 1}` }, draft.ingredients.map((i) => {
            const on = s.ingredientIds.includes(i.id);
            return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(on), onclick: () => { draft = toggleTag(draft, s.id, i.id); render(); } },
              on ? icon('check') : null, i.name || 'Unnamed');
          })),
        ] : null,
        h('div', { class: 'tools' },
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move step up', disabled: n === 0, onclick: () => { draft = moveStep(draft, s.id, -1); render(); } }, icon('arrow-up')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move step down', disabled: n === draft.steps.length - 1, onclick: () => { draft = moveStep(draft, s.id, 1); render(); } }, icon('arrow-down')),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Delete step', onclick: () => { draft = { ...draft, steps: draft.steps.filter((x) => x.id !== s.id) }; editingStep = null; render(); } }, icon('trash')),
          h('button', { class: 'btn quiet', type: 'button', onclick: () => { editingStep = null; render(); } }, 'Done'))));
  }

  function addStep() {
    const s = blankStep();
    draft = { ...draft, steps: [...draft.steps, s] };
    editingStep = s.id;
    render();
    focusStep();
  }
  const focusStep = () => requestAnimationFrame(() => body.querySelector('textarea[data-step]')?.focus());

  // ── Import from web ──────────────────────────────────────────────────────
  let importText = '';
  let importServes = 4;
  let importMeal = 'dinner';
  let importNote = null;

  function importForm() {
    const linkPill = h('div', { class: 'link-found', hidden: !looksLikeUrl(importText) }, icon('link'), 'Link found ', h('span', {}, `· ${hostOf(importText) ?? ''}`));
    const area = h('textarea', {
      id: 'paste', class: 'paste',
      placeholder: 'Paste a link to a recipe, or the whole recipe — title, ingredients and method. Pinch will split it into ingredients and steps for you to check.',
      oninput: (e) => {
        importText = e.target.value;
        linkPill.hidden = !looksLikeUrl(importText);
        linkPill.lastChild.textContent = `· ${hostOf(importText) ?? ''}`;
      },
    }, importText);
    return [
      field('Link or recipe text', area, null, 'paste'),
      linkPill,
      h('div', { class: 'two' },
        field('Serves', stepper({ value: importServes, label: 'servings', onChange: (v) => { importServes = v; } })),
        field('Meal', h('div', { class: 'input select' }, h('span', {}, mealLabel(importMeal)), icon('chevron'),
          h('select', { 'aria-label': 'Meal', onchange: (e) => { importMeal = e.target.value; render(); } },
            MEALS.map((m) => h('option', { value: m, selected: importMeal === m }, mealLabel(m))))))),
      importNote ? h('p', { class: `note ${importNote.error ? 'error' : ''}`, role: 'status' }, importNote.text) : h('p', { class: 'hint' }, 'Pinch reads the ingredients and method, then you check each ingredient.'),
      h('button', { class: 'btn primary big', type: 'button', disabled: busy, onclick: readRecipe }, busy ? 'Reading…' : 'Read recipe'),
    ];
  }

  async function readRecipe() {
    const text = importText.trim();
    if (!text) { importNote = { error: true, text: 'Paste a link or the recipe first.' }; render(); return; }
    busy = true; importNote = null; render();
    try {
      let src;
      if (looksLikeUrl(text)) {
        const res = await storage.callImport({ mode: 'url', url: text });
        if (res?.source === 'jsonld') {
          src = res.recipe;
        } else if (res?.source === 'page') {
          // No recipe data on the page: Claude reads its text, with this
          // device's own key, straight from the browser.
          const key = getAiKey();
          if (!key) {
            importNote = { error: true, text: 'This page has no recipe data Pinch can read on its own. Add your Claude key once in Settings \u203a Import from web, or paste the recipe text here.' };
            return;
          }
          src = await claude.recipeFromPage(key, `${res.title}\n\n${res.text}`);
          if (!src) {
            importNote = { error: true, text: 'No recipe was found on that page. Paste the recipe text instead.' };
            importText = '';
            return;
          }
        } else {
          importNote = { error: true, text: res?.message ?? 'That page couldn\u2019t be read. Paste the recipe text instead.' };
          importText = '';
          return;
        }
      } else {
        const split = splitRecipeText(text);
        src = { name: split.name, recipeYield: split.serves ? String(split.serves) : null, recipeIngredient: split.ingredients, recipeInstructions: split.steps };
      }
      // Serves and Meal come from the recipe when it says; the form's values
      // are used when it doesn't.
      const { recipe, unparsed } = draftFromImport(src, {
        serves: servesFrom(src.recipeYield) ? null : importServes,
        meal: mealFrom(src.recipeCategory) ? null : importMeal,
      });
      if (unparsed.length) await fixUnparsed(recipe, unparsed);
      for (const i of recipe.ingredients) {
        const p = state.matchProduct(i.name);
        if (p) i.productId = p.id;
      }
      if (!recipe.ingredients.length) {
        importNote = { error: true, text: 'No ingredients were found. Check the text has a list of ingredients.' };
        return;
      }
      draft = { ...recipe, id: draft.id };
      mode = 'enter';
      const toMethod = () => requestAnimationFrame(() => body.querySelector('.method')?.scrollIntoView({ block: 'start' }));
      if (!state.get().nutritionOn) { editingStep = null; toMethod(); return; }
      openCheckIngredients({
        recipe: draft,
        finishLabel: 'Next: the method',
        onChange: (next) => { draft = next; render(); },
        onFinish: (next) => { draft = next; editingStep = null; render(); toMethod(); },
      });
    } catch (e) {
      importNote = { error: true, text: e.message };
    } finally {
      busy = false;
      render();
    }
  }

  // Lines the parser couldn't read go to Claude when this device has a key;
  // anything still unread is left as written for the cook to fix in Check
  // ingredients.
  async function fixUnparsed(recipe, ids) {
    const key = getAiKey();
    if (!key) return;
    const lines = ids.map((id) => recipe.ingredients.find((i) => i.id === id)?.sourceLine).filter(Boolean);
    const split = await claude.splitLines(key, lines).catch(() => []);
    for (const out of split) {
      const ing = recipe.ingredients.find((i) => i.sourceLine === out.line);
      if (!ing) continue;
      ing.name = out.name || parseIngredientLine(out.line).name;
      ing.qty = out.qty;
      ing.unit = out.unit;
    }
  }

  // ── save / delete ────────────────────────────────────────────────────────
  async function save() {
    showErrors = true;
    draft.steps = draft.steps.filter((s) => s.text.trim() || s.ingredientIds.length);
    const problems = validateRecipe(draft);
    if (problems.length) { render(); body.querySelector('.problems')?.scrollIntoView({ block: 'center' }); return; }
    busy = true; render();
    const oldPhoto = original?.photoPath ?? null;
    try {
      const clean = { ...draft, ingredients: draft.ingredients.map(({ sourceLine, itemGrams, ...i }) => i) };
      if (photoBlob) clean.photoPath = uploadedPath ??= await storage.uploadPhoto(photoBlob, state.get().householdId, clean.id);
      else if (removePhoto) clean.photoPath = null;
      // The old file goes BEFORE the save: for a recipe that moved household,
      // only the recipe still naming it lets the new household delete it.
      if (oldPhoto && oldPhoto !== clean.photoPath) await storage.removePhoto(oldPhoto);
      await state.saveRecipe(clean);
      busy = false;
      await sheet.close({ force: true });
      toast(original ? 'Saved' : 'Recipe added');
      onSaved?.(clean.id);
    } catch (e) {
      busy = false;
      render();
      toast(e.message, { error: true });
    }
  }

  async function del() {
    const ok = await confirmSheet({ title: `Delete \u201c${displayName(original.name)}\u201d?`, body: 'It goes for everyone in your household. This can’t be undone.', confirm: 'Delete', danger: true });
    if (!ok) return;
    try {
      await state.deleteRecipe(original.id);
      await sheet.close({ force: true });
      toast('Recipe deleted');
      onDeleted?.();
    } catch (e) {
      toast(e.message, { error: true });
    }
  }

  render();
  return sheet;
}
