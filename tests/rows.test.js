import { describe, test, assertEqual } from './kit.js';
import { rowsToRecipes, recipeToPayload, rowToProduct, productToRow } from '../js/lib/rows.js';

const rows = {
  recipes: [{ id: 'r', name: 'Dal', serves: 4, meal: 'dinner', cuisine: 'IN', photo_path: null, bloc_recipe_id: null }],
  ingredients: [
    { id: 'b', recipe_id: 'r', position: 1, name: 'Salt', qty: null, unit: 'to taste', product_id: null, seasoning: true },
    { id: 'a', recipe_id: 'r', position: 0, name: 'Lentils', qty: '200', unit: 'g', product_id: 'p1' },
  ],
  steps: [
    { id: 's2', recipe_id: 'r', position: 1, text: 'Season' },
    { id: 's1', recipe_id: 'r', position: 0, text: 'Simmer' },
  ],
  tags: [{ step_id: 's2', ingredient_id: 'b' }, { step_id: 's1', ingredient_id: 'a' }, { step_id: 's2', ingredient_id: 'a' }],
  cooking: [
    { id: 'c2', recipe_id: 'r', position: 1, method: 'other', name: 'Pressure cooker', minutes: 15, temp_c: null, note: null },
    { id: 'c1', recipe_id: 'r', position: 0, method: 'hob', name: null, minutes: '40', temp_c: null, note: 'Lid on' },
  ],
};

describe('rowsToRecipes', () => {
  test('orders by position and nests', () => {
    const [r] = rowsToRecipes(rows);
    assertEqual(r.ingredients.map((i) => i.id), ['a', 'b']);
    assertEqual(r.steps.map((s) => s.id), ['s1', 's2']);
  });
  test('numeric strings become numbers; null stays null', () => {
    const [r] = rowsToRecipes(rows);
    assertEqual(r.ingredients.map((i) => i.qty), [200, null]);
  });
  test('seasoning comes back true or false, never missing', () => {
    const [r] = rowsToRecipes(rows);
    assertEqual(r.ingredients.map((i) => i.seasoning), [false, true]);
  });
  test('cooking options are ordered by position, minutes as numbers', () => {
    const [r] = rowsToRecipes(rows);
    assertEqual(r.cooking.map((c) => [c.id, c.method, c.minutes, c.tempC, c.note]), [['c1', 'hob', 40, null, 'Lid on'], ['c2', 'other', 15, null, null]]);
    assertEqual(rowsToRecipes({ recipes: rows.recipes })[0].cooking, []);
  });
  test('tags come back in ingredient-list order', () => {
    const [r] = rowsToRecipes(rows);
    assertEqual(r.steps[1].ingredientIds, ['a', 'b']);
  });
});

describe('recipeToPayload', () => {
  test('round-trips order and tags exactly', () => {
    const [r] = rowsToRecipes(rows);
    const p = recipeToPayload(r, 'hh');
    assertEqual(p.household_id, 'hh');
    assertEqual(p.ingredients.map((i) => [i.id, i.position, i.qty, i.product_id]), [['a', 0, 200, 'p1'], ['b', 1, null, null]]);
    assertEqual(p.steps.map((s) => [s.id, s.position, s.ingredient_ids]), [['s1', 0, ['a']], ['s2', 1, ['a', 'b']]]);
  });
  test('seasoning and cooking options go into the payload', () => {
    const [r] = rowsToRecipes(rows);
    const p = recipeToPayload(r, 'hh');
    assertEqual(p.ingredients.map((i) => i.seasoning), [false, true]);
    assertEqual(p.cooking, [
      { id: 'c1', position: 0, method: 'hob', name: null, minutes: 40, temp_c: null, note: 'Lid on' },
      { id: 'c2', position: 1, method: 'other', name: 'Pressure cooker', minutes: 15, temp_c: null, note: null },
    ]);
  });
  test('a recipe with no cooking sends an empty list (which clears it), and a name only for Other', () => {
    const base = { id: 'x', name: 'Toast', serves: 1, meal: 'breakfast', ingredients: [], steps: [] };
    assertEqual(recipeToPayload(base, 'hh').cooking, []);
    const p = recipeToPayload({ ...base, cooking: [{ id: 'k', method: 'grill', name: 'stale', minutes: 3, tempC: null, note: '  ' }] }, 'hh');
    assertEqual([p.cooking[0].name, p.cooking[0].note], [null, null]);
  });
  test('empty strings become null', () => {
    const p = recipeToPayload({ id: 'x', name: ' Toast ', serves: 1, meal: 'breakfast', cuisine: '', photoPath: '', ingredients: [], steps: [] }, 'hh');
    assertEqual([p.name, p.cuisine, p.photo_path, p.bloc_recipe_id], ['Toast', null, null, null]);
  });
});

describe('products', () => {
  test('row ↔ product', () => {
    const row = { id: 'p', name: 'Oats', brand: '', barcode: '50', basis: '100g', kcal: '370', protein: 13, carbs: 60, fat: 7, grams_per_item: null };
    const p = rowToProduct(row);
    assertEqual([p.kcal, p.gramsPerItem], [370, null]);
    assertEqual(productToRow({ ...p, brand: '  ' }, 'hh').brand, null);
  });
  test('the spoon weight goes both ways, and only on a per-100 g product', () => {
    const p = rowToProduct({ id: 'p', name: 'Peanut butter', basis: '100g', kcal: 597, protein: 25, carbs: 13, fat: 50, grams_per_tbsp: '16' });
    assertEqual([p.gramsPerTbsp, productToRow(p, 'hh').grams_per_tbsp], [16, 16]);
    assertEqual(productToRow({ ...p, basis: '100ml' }, 'hh').grams_per_tbsp, null);
    assertEqual(rowToProduct({ ...p, grams_per_tbsp: null }).gramsPerTbsp, null);
  });
});
