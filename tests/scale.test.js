import { describe, test, assertEqual, assertTrue } from './kit.js';
import { scaleRecipe } from '../js/lib/scale.js';

const recipe = () => ({
  id: 'r1', name: 'Carbonara', serves: 4,
  ingredients: [
    { id: 'a', name: 'Spaghetti', qty: 400, unit: 'g' },
    { id: 'b', name: 'Pepper', qty: null, unit: 'to taste' },
    { id: 'c', name: 'Egg yolks', qty: 4, unit: 'each' },
  ],
  steps: [{ id: 's', text: 'Boil', ingredientIds: ['a'] }],
});

describe('scaleRecipe', () => {
  test('multiplies by servings ÷ serves', () => {
    const out = scaleRecipe(recipe(), 6);
    assertEqual(out.ingredients.map((i) => i.qty), [600, null, 6]);
  });
  test('serves is what the recipe makes, and never changes', () => {
    assertEqual(scaleRecipe(recipe(), 1).serves, 4);
  });
  test('qty null stays null', () => {
    assertEqual(scaleRecipe(recipe(), 8).ingredients[1].qty, null);
  });
  test('never mutates its input', () => {
    const r = recipe();
    const before = structuredClone(r);
    const out = scaleRecipe(r, 2);
    assertEqual(r, before);
    assertTrue(out.ingredients !== r.ingredients && out.steps[0].ingredientIds !== r.steps[0].ingredientIds, 'new arrays');
  });
  test('the same servings gives the same amounts', () => {
    assertEqual(scaleRecipe(recipe(), 4).ingredients.map((i) => i.qty), [400, null, 4]);
  });
});
