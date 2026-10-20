import { describe, test, assertEqual } from './kit.js';
import { densityFor } from '../js/lib/densities.js';
import { cuisineFromText, cuisineName } from '../js/lib/cuisines.js';

describe('densityFor', () => {
  test('whole-name match, case and space insensitive, then the product name', () => {
    assertEqual(densityFor(' Plain Flour '), 0.53);
    assertEqual(densityFor('Mystery', 'Caster sugar'), 0.84);
    assertEqual(densityFor('Plain flour, sifted'), null);
  });
});

describe('cuisines', () => {
  test('words on a page become a code', () => {
    assertEqual([cuisineFromText('Indian'), cuisineFromText('Italian, Vegetarian'), cuisineFromText('jp'), cuisineFromText('Fusion')], ['IN', 'IT', 'JP', null]);
  });
  test('names', () => assertEqual([cuisineName('CH'), cuisineName(null)], ['Switzerland', '']));
});
