import { describe, test, assertEqual } from './kit.js';
import { cuisinesInUse, filterRecipes, sortRecipes } from '../js/lib/recipes.js';

// Only the fields these functions need. Real recipes have more.
const r = (name, cuisine, meal = 'dinner') => ({ id: name, name, cuisine, meal });

describe('cuisinesInUse', () => {
  test('no recipes gives no cuisines', () => {
    assertEqual(cuisinesInUse([]), []);
  });

  test('returns the cuisine codes, not the recipes', () => {
    assertEqual(cuisinesInUse([r('Carbonara', 'IT')]), ['IT']);
  });

  test('lists each cuisine once, in the order it first appears', () => {
    const recipes = [r('Carbonara', 'IT'), r('Katsu curry', 'JP'), r('Risotto', 'IT'), r('Pad kra pao', 'TH'), r('Ramen', 'JP')];
    assertEqual(cuisinesInUse(recipes), ['IT', 'JP', 'TH']);
  });

  test('gives the same order every time it runs', () => {
    const recipes = [r('Chana masala', 'IN'), r('Croque madame', 'FR'), r('Dal', 'IN')];
    assertEqual(cuisinesInUse(recipes), cuisinesInUse(recipes));
    assertEqual(cuisinesInUse(recipes), ['IN', 'FR']);
  });

  test('a recipe with no cuisine adds no chip', () => {
    assertEqual(cuisinesInUse([r('Toast', null), r('Dal', 'IN')]), ['IN']);
  });

  test('does not change the array it was given', () => {
    const recipes = [r('Risotto', 'IT'), r('Carbonara', 'IT')];
    const before = structuredClone(recipes);
    cuisinesInUse(recipes);
    assertEqual(recipes, before);
  });
});

describe('filterRecipes', () => {
  const all = [r('Carbonara', 'IT', 'dinner'), r('Muesli', 'CH', 'breakfast'), r('Risotto', 'IT', 'lunch')];
  test('All (value null) returns every recipe, as a copy', () => {
    const out = filterRecipes(all, { mode: 'meal', value: null });
    assertEqual(out.map((x) => x.name), ['Carbonara', 'Muesli', 'Risotto']);
    assertEqual(out === all, false);
  });
  test('by meal', () => {
    assertEqual(filterRecipes(all, { mode: 'meal', value: 'breakfast' }).map((x) => x.name), ['Muesli']);
  });
  test('by cuisine keeps order', () => {
    assertEqual(filterRecipes(all, { mode: 'cuisine', value: 'IT' }).map((x) => x.name), ['Carbonara', 'Risotto']);
  });
  test('a cuisine with no recipes gives none', () => {
    assertEqual(filterRecipes(all, { mode: 'cuisine', value: 'JP' }), []);
  });
});

describe('sortRecipes', () => {
  test('alphabetical, ignoring case', () => {
    assertEqual(sortRecipes([r('risotto'), r('Bircher'), r('carbonara')]).map((x) => x.name), ['Bircher', 'carbonara', 'risotto']);
  });
});
