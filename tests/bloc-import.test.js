import { describe, test, assertEqual, assertTrue } from './kit.js';
import { readBlocBackup, mapBlocRecipe, estimatePerServing, reconcile } from '../js/lib/bloc-import.js';

// A made-up BLOC backup in BLOC's real shape (state.recipes + state.foodLibrary
// + everything else, which must be dropped).
const backup = {
  diary: { '2026-10-01': [{ name: 'secret' }] }, bodyweight: [80], settings: { coach: true },
  recipes: [{
    id: 'recipe_1700000000000', name: 'Overnight oats', servings: 2,
    per_serving_kcal: 330, per_serving_p: 14, per_serving_c: 47, per_serving_f: 9,
    ingredients: [
      { name: 'Oats', brand: 'Flahavan', grams: 80, kcal: 296, protein: 10.4, carbs: 48, fats: 6.4, source: 'barcode' },
      { name: 'Milk', brand: null, grams: 200, kcal: 100, protein: 7.2, carbs: 9.6, fats: 3.6, source: 'library' },
      { name: 'Banana', brand: null, grams: 2, kcal: 210, protein: 2.6, carbs: 46, fats: 0.6, source: 'manual' },
      { name: 'Nut butter blend', grams: 1, kcal: 50, protein: 2, carbs: 1, fats: 4, source: 'recipe' },
    ],
  }],
  foodLibrary: [{ name: 'Oats', brand: 'Flahavan', barcode: '5011051000000', per100kcal: 370 }, { name: 'Overnight oats', source: 'recipe' }],
};

describe('readBlocBackup', () => {
  test('keeps recipes and the food library, nothing else', () => {
    const out = readBlocBackup(JSON.stringify(backup));
    assertEqual(Object.keys(out), ['recipes', 'foodLibrary']);
    assertEqual(out.foodLibrary.map((f) => f.name), ['Oats']);
    assertTrue(!JSON.stringify(out).includes('secret'), 'no diary data survives');
  });
  test('a file without recipes is refused', () => {
    assertTrue(Boolean(readBlocBackup('{"diary":{}}').error));
    assertTrue(Boolean(readBlocBackup('not json').error));
  });
});

describe('mapBlocRecipe', () => {
  let n = 0;
  const newId = () => `id${++n}`;
  const { recipes, foodLibrary } = readBlocBackup(backup);
  test('weight-based → grams against a per-100 g product; per item → each', () => {
    const { recipe, newProducts } = mapBlocRecipe(recipes[0], foodLibrary, [], { newId });
    assertEqual(recipe.ingredients.map((i) => [i.name, i.qty, i.unit]), [['Oats', 80, 'g'], ['Milk', 200, 'g'], ['Banana', 2, 'each']]);
    assertEqual(newProducts.map((p) => [p.name, p.basis, p.kcal]), [['Oats', '100g', 370], ['Milk', '100g', 50], ['Banana', 'item', 105]]);
    assertEqual(recipe.blocRecipeId, 'recipe_1700000000000');
  });
  test('the barcode is recovered from the food library by name', () => {
    const { newProducts } = mapBlocRecipe(recipes[0], foodLibrary, [], { newId });
    assertEqual(newProducts[0].barcode, '5011051000000');
  });
  test('a household product with that barcode is reused, not duplicated', () => {
    const existing = [{ id: 'mine', name: 'Porridge oats', brand: null, barcode: '5011051000000', basis: '100g' }];
    const { recipe, newProducts } = mapBlocRecipe(recipes[0], foodLibrary, existing, { newId });
    assertEqual(recipe.ingredients[0].productId, 'mine');
    assertEqual(newProducts.map((p) => p.name), ['Milk', 'Banana']);
  });
  test('a nested recipe is flagged, never imported silently', () => {
    const { problems } = mapBlocRecipe(recipes[0], foodLibrary, [], { newId });
    assertEqual(problems.map((p) => p.name), ['Nut butter blend']);
  });
});

describe('reconcile', () => {
  const { recipes, foodLibrary } = readBlocBackup(backup);
  test('a faithful mapping reconciles within rounding', () => {
    const m = mapBlocRecipe({ ...recipes[0], ingredients: recipes[0].ingredients.slice(0, 3) }, foodLibrary, []);
    const est = estimatePerServing(m.recipe, m.newProducts);
    assertEqual(est.kcal, 303);
    const r = reconcile(est, { per_serving_kcal: 303, per_serving_p: 10, per_serving_c: 52, per_serving_f: 5 });
    assertEqual(r.ok, true);
  });
  test('a real difference is flagged', () => {
    const r = reconcile({ kcal: 330, protein: 14, carbs: 47, fat: 9 }, { per_serving_kcal: 400, per_serving_p: 14, per_serving_c: 47, per_serving_f: 9 });
    assertEqual([r.ok, r.rows[0].ok, r.rows[0].diff], [false, false, -70]);
  });
});
