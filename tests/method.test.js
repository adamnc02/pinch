import { describe, test, assertEqual } from './kit.js';
import { stepLine, removeIngredient, moveStep, toggleTag, suggestTags } from '../js/lib/method.js';

const recipe = () => ({
  id: 'r', name: 'Carbonara', serves: 4,
  ingredients: [
    { id: 'sp', name: 'Spaghetti', qty: 400, unit: 'g' },
    { id: 'yo', name: 'Egg yolks', qty: 4, unit: 'each' },
    { id: 'pe', name: 'Black pepper', qty: 2 / 3, unit: 'tbsp' },
    { id: 'sa', name: 'Salt', qty: null, unit: 'to taste' },
  ],
  steps: [
    { id: 's1', text: 'Boil', ingredientIds: ['sp', 'sa'] },
    { id: 's2', text: 'Whisk', ingredientIds: ['pe', 'yo', 'gone'] },
    { id: 's3', text: 'Serve', ingredientIds: [] },
  ],
});

describe('stepLine', () => {
  test('scaled amounts in ingredient-list order, unknown ids ignored', () => {
    const r = recipe();
    assertEqual(stepLine(r, r.steps[1], 6), 'Egg yolks 6 · Black pepper 1 tbsp');
  });
  test('follows the stepper', () => {
    const r = recipe();
    assertEqual(stepLine(r, r.steps[0], 2), 'Spaghetti 200 g · Salt to taste');
  });
  test('follows the display mode', () => {
    const r = { ...recipe(), ingredients: [{ id: 'm', name: 'Milk', qty: 250, unit: 'ml' }], steps: [{ id: 's', text: '', ingredientIds: ['m'] }] };
    assertEqual(stepLine(r, r.steps[0], 4, { mode: 'cups' }), 'Milk 1 cup');
  });
  test('a step with no tags is blank', () => {
    const r = recipe();
    assertEqual(stepLine(r, r.steps[2], 4), '');
  });
  test('survives renaming and reordering ingredients (tags are ids)', () => {
    const r = recipe();
    const moved = { ...r, ingredients: [{ ...r.ingredients[1], name: 'Yolks' }, r.ingredients[0], r.ingredients[2], r.ingredients[3]] };
    assertEqual(stepLine(moved, moved.steps[1], 4), 'Yolks 4 · Black pepper ≈ ¾ tbsp');
  });
});

describe('removeIngredient', () => {
  test('leaves no dangling id on any step', () => {
    const out = removeIngredient(recipe(), 'sp');
    assertEqual(out.ingredients.map((i) => i.id), ['yo', 'pe', 'sa']);
    assertEqual(out.steps[0].ingredientIds, ['sa']);
  });
  test('never mutates its input', () => {
    const r = recipe();
    const before = structuredClone(r);
    removeIngredient(r, 'yo');
    assertEqual(r, before);
  });
});

describe('moveStep', () => {
  test('down and up', () => {
    assertEqual(moveStep(recipe(), 's1', 1).steps.map((s) => s.id), ['s2', 's1', 's3']);
    assertEqual(moveStep(recipe(), 's3', -1).steps.map((s) => s.id), ['s1', 's3', 's2']);
  });
  test('at either end nothing moves', () => {
    assertEqual(moveStep(recipe(), 's1', -1).steps.map((s) => s.id), ['s1', 's2', 's3']);
    assertEqual(moveStep(recipe(), 's3', 1).steps.map((s) => s.id), ['s1', 's2', 's3']);
  });
  test('never mutates its input', () => {
    const r = recipe();
    const before = structuredClone(r);
    const out = moveStep(r, 's1', 1);
    assertEqual(r, before);
    assertEqual(out.steps === r.steps, false);
  });
});

describe('toggleTag and suggestTags', () => {
  test('toggle on and off', () => {
    const on = toggleTag(recipe(), 's3', 'sp');
    assertEqual(on.steps[2].ingredientIds, ['sp']);
    assertEqual(toggleTag(on, 's3', 'sp').steps[2].ingredientIds, []);
  });
  test('suggests the ingredients a step names', () => {
    const ings = [{ id: 'o', name: 'Onion' }, { id: 'c', name: 'Chickpeas, tinned' }, { id: 'g', name: 'Garam masala' }];
    assertEqual(suggestTags(ings, 'Fry the onions, then add the chickpeas.'), ['o', 'c']);
    assertEqual(suggestTags(ings, 'Stir in the masala.'), ['g']);
  });
});
