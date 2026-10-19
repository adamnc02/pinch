import { describe, test, assertEqual } from './kit.js';
import { cuisinesInUse } from '../js/lib/recipes.js';

// Only the fields cuisinesInUse needs. Real recipes have more.
const r = (name, cuisine) => ({ id: name, name, cuisine });

describe('cuisinesInUse', () => {
  test('no recipes gives no cuisines', () => {
    assertEqual(cuisinesInUse([]), []);
  });

  test('returns the cuisine codes, not the recipes', () => {
    assertEqual(cuisinesInUse([r('Carbonara', 'IT')]), ['IT']);
  });

  test('lists each cuisine once, in the order it first appears', () => {
    const recipes = [
      r('Carbonara', 'IT'),
      r('Katsu curry', 'JP'),
      r('Risotto', 'IT'),
      r('Pad kra pao', 'TH'),
      r('Ramen', 'JP'),
    ];
    assertEqual(cuisinesInUse(recipes), ['IT', 'JP', 'TH']);
  });

  test('gives the same order every time it runs', () => {
    const recipes = [r('Chana masala', 'IN'), r('Croque madame', 'FR'), r('Dal', 'IN')];
    assertEqual(cuisinesInUse(recipes), cuisinesInUse(recipes));
    assertEqual(cuisinesInUse(recipes), ['IN', 'FR']);
  });

  test('does not change the array it was given', () => {
    const recipes = [r('Risotto', 'IT'), r('Carbonara', 'IT')];
    const before = structuredClone(recipes);
    cuisinesInUse(recipes);
    assertEqual(recipes, before);
  });
});
