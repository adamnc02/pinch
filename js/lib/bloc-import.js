// Settings › Import recipes from BLOC: a one-off bring-across from a BLOC
// backup (bloc-backup-<date>.json).
//
// 🚨 A BLOC backup holds everything: training, diary, body data, settings.
// readBlocBackup keeps ONLY each recipe's name, servings, ingredients and
// per-serving figures, and the food library's name, brand and barcode.
// Nothing else is read, stored or uploaded.
//
// BLOC copies numbers onto its ingredients rather than linking a food:
//   weight-based (barcode / library / manual-weight): `grams` is a weight
//   per item (manual):  `grams` is a COUNT, kcal etc. are for that count
//   nested recipe (recipe): flagged for the person, never imported silently
// so each becomes a Pinch ingredient linked to a product whose nutrition is
// worked back from those numbers.

import { newId as makeId } from './ids.js';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const key = (s) => String(s ?? '').trim().toLowerCase();

export function readBlocBackup(input) {
  let data = input;
  if (typeof input === 'string') {
    try { data = JSON.parse(input); } catch { return { error: 'That file isn’t a BLOC backup (it isn’t JSON).' }; }
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.recipes)) {
    return { error: 'That file has no BLOC recipes in it.' };
  }
  const recipes = data.recipes
    .filter((r) => r && typeof r === 'object' && r.id && r.name && Array.isArray(r.ingredients))
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      servings: num(r.servings) || 1,
      per_serving_kcal: num(r.per_serving_kcal),
      per_serving_p: num(r.per_serving_p),
      per_serving_c: num(r.per_serving_c),
      per_serving_f: num(r.per_serving_f),
      ingredients: r.ingredients.map((i) => ({
        name: String(i?.name ?? ''),
        brand: i?.brand ? String(i.brand) : null,
        grams: num(i?.grams),
        kcal: num(i?.kcal), protein: num(i?.protein), carbs: num(i?.carbs), fats: num(i?.fats),
        per1kcal: i?.per1kcal ?? null, per1p: i?.per1p ?? null, per1c: i?.per1c ?? null, per1f: i?.per1f ?? null,
        source: String(i?.source ?? 'manual-weight'),
      })),
    }));
  const foodLibrary = (Array.isArray(data.foodLibrary) ? data.foodLibrary : [])
    .filter((f) => f && f.name && f.source !== 'recipe')
    .map((f) => ({ name: String(f.name), brand: f.brand ? String(f.brand) : null, barcode: f.barcode ? String(f.barcode) : null }));
  return { recipes, foodLibrary };
}

const per100 = (total, per1, grams) => {
  if (per1 != null && Number.isFinite(Number(per1))) return Math.round(Number(per1) * 1000) / 10;
  return grams > 0 ? Math.round((total / grams) * 1000) / 10 : 0;
};

// mapBlocRecipe(blocRecipe, foodLibrary, householdProducts, newId) →
//   { recipe, newProducts: [product], problems: [{ name, reason }] }
// Product matching, in order: a barcode recovered from foodLibrary by name,
// a household product with that barcode, one with the same name (and
// brand), and only then a new product. Products made earlier in the same
// import are reused too, so two recipes using one food make one product.
export function mapBlocRecipe(bloc, foodLibrary, householdProducts, { newId = makeId, pending = [] } = {}) {
  const problems = [];
  const newProducts = [];
  const all = () => [...householdProducts, ...pending, ...newProducts];

  const ingredients = [];
  for (const i of bloc.ingredients) {
    if (!i.name) continue;
    if (i.source === 'recipe') {
      problems.push({ name: i.name, reason: 'is another BLOC recipe. Add its ingredients here by hand.' });
      continue;
    }
    if (!(i.grams > 0)) {
      problems.push({ name: i.name, reason: 'has no amount in BLOC, so it was left out.' });
      continue;
    }
    const perItem = i.source === 'manual';
    const fact = perItem
      ? { basis: 'item', kcal: r1(i.kcal / i.grams), protein: r1(i.protein / i.grams), carbs: r1(i.carbs / i.grams), fat: r1(i.fats / i.grams) }
      : { basis: '100g', kcal: per100(i.kcal, i.per1kcal, i.grams), protein: per100(i.protein, i.per1p, i.grams),
          carbs: per100(i.carbs, i.per1c, i.grams), fat: per100(i.fats, i.per1f, i.grams) };

    const barcode = foodLibrary.find((f) => key(f.name) === key(i.name) && f.barcode)?.barcode ?? null;
    let product = (barcode && all().find((p) => p.barcode === barcode))
      || all().find((p) => key(p.name) === key(i.name) && key(p.brand) === key(i.brand) && p.basis === fact.basis)
      || null;
    if (!product) {
      product = { id: newId(), name: i.name, brand: i.brand, barcode, gramsPerItem: null, source: 'bloc', ...fact };
      newProducts.push(product);
    }
    ingredients.push({ id: newId(), name: i.name, qty: i.grams, unit: perItem ? 'each' : 'g', productId: product.id });
  }

  return {
    recipe: {
      id: newId(), name: bloc.name, serves: Math.max(1, Math.round(bloc.servings)),
      meal: null, cuisine: null, photoPath: null, blocRecipeId: bloc.id, ingredients, steps: [],
    },
    newProducts,
    problems,
  };
}
const r1 = (v) => Math.round(v * 10) / 10;

// Per serving, from a mapped recipe and its products, before anything is
// saved: what recipe_nutrition will say, for the picker. (After saving, the
// reconciliation shows the view's own figures.)
export function estimatePerServing(recipe, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const i of recipe.ingredients) {
    const p = byId.get(i.productId);
    if (!p || i.qty == null) continue;
    const f = p.basis === 'item' ? i.qty : i.qty / 100;
    for (const k of Object.keys(t)) t[k] += f * p[k];
  }
  for (const k of Object.keys(t)) t[k] = r1(t[k] / recipe.serves);
  return t;
}

// Pinch's per-serving figures beside BLOC's. A difference beyond rounding
// (1 kcal or 1 g, BLOC rounds to whole numbers, and 2 %) is flagged.
export function reconcile(pinch, bloc) {
  const rows = [
    ['kcal', pinch.kcal, bloc.per_serving_kcal],
    ['protein', pinch.protein, bloc.per_serving_p],
    ['carbs', pinch.carbs, bloc.per_serving_c],
    ['fat', pinch.fat, bloc.per_serving_f],
  ].map(([macro, a, b]) => {
    const diff = r1(num(a) - num(b));
    return { macro, pinch: num(a), bloc: num(b), diff, ok: Math.abs(diff) <= Math.max(1, Math.abs(num(b)) * 0.02) };
  });
  return { rows, ok: rows.every((r) => r.ok) };
}
