import { describe, test, assertEqual } from './kit.js';
import { rowsToRecipes, recipeToPayload, rowToProduct, productToRow } from '../js/lib/rows.js';

const rows = {
  recipes: [{ id: 'r', name: 'Dal', serves: 4, meal: 'dinner', cuisine: 'IN', photo_path: null, bloc_recipe_id: null }],
  ingredients: [
    { id: 'b', recipe_id: 'r', position: 1, name: 'Salt', qty: null, unit: 'to taste', product_id: null },
    { id: 'a', recipe_id: 'r', position: 0, name: 'Lentils', qty: '200', unit: 'g', product_id: 'p1' },
  ],
  steps: [
    { id: 's2', recipe_id: 'r', position: 1, text: 'Season' },
    { id: 's1', recipe_id: 'r', position: 0, text: 'Simmer' },
  ],
  tags: [{ step_id: 's2', ingredient_id: 'b' }, { step_id: 's1', ingredient_id: 'a' }, { step_id: 's2', ingredient_id: 'a' }],
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
});
