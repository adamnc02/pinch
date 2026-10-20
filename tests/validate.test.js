import { describe, test, assertEqual } from './kit.js';
import { validateRecipe } from '../js/lib/validate.js';

const ok = () => ({
  id: 'r', name: 'Dal', serves: 4, meal: 'dinner', cuisine: 'IN',
  ingredients: [{ id: 'a', name: 'Lentils', qty: 200, unit: 'g' }, { id: 'b', name: 'Salt', qty: null, unit: 'to taste' }],
  steps: [{ id: 's', text: 'Simmer', ingredientIds: ['a'] }],
});
const fields = (r) => validateRecipe(r).map((p) => p.field);

describe('validateRecipe', () => {
  test('a good recipe has no problems', () => assertEqual(validateRecipe(ok()), []));
  test('reports every problem at once', () => {
    assertEqual(fields({ ...ok(), name: ' ', serves: 0, meal: null }), ['name', 'serves', 'meal']);
  });
  test('serves must be a whole number', () => assertEqual(fields({ ...ok(), serves: 2.5 }), ['serves']));
  test('qty is a positive number or null', () => {
    const r = ok();
    r.ingredients[0].qty = 0;
    assertEqual(fields(r), ['ingredients.0']);
    r.ingredients[0].qty = NaN;
    assertEqual(fields(r), ['ingredients.0']);
  });
  test('the unit must be on the controlled list', () => {
    const r = ok();
    r.ingredients[0].unit = 'pinch';
    assertEqual(fields(r), ['ingredients.0']);
  });
  test('every tag points at an ingredient of the same recipe', () => {
    const r = ok();
    r.steps[0].ingredientIds = ['a', 'elsewhere'];
    assertEqual(fields(r), ['steps.0']);
  });
});
