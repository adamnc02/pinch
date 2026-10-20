import { describe, test, assertEqual } from './kit.js';
import { densityFor } from '../js/lib/densities.js';
import { cuisineFromText, cuisineName } from '../js/lib/cuisines.js';

describe('densityFor', () => {
  test('whole-name match, case and space insensitive, then the product name', () => {
    assertEqual(densityFor(' Plain Flour '), 0.53);
    assertEqual(densityFor('Mystery', 'Caster sugar'), 0.84);
  });
  test('then the longest table name found as whole words in the name', () => {
    assertEqual(densityFor('Plain flour, sifted'), 0.53);
    assertEqual(densityFor("Flahavan's porridge oats"), 0.36);
    assertEqual(densityFor('Coconut milk (tinned)'), 0.97);
    assertEqual(densityFor('Crunchy peanut butter'), 1.08);
  });
  test('a word match needs whole words', () => {
    assertEqual(densityFor('Oatcakes'), null);
    assertEqual(densityFor('Chicken breast'), null);
  });
  test('the ingredient\'s own words win over the product\'s', () => {
    assertEqual(densityFor('Self-raising flour', 'Tesco plain flour'), 0.53);
    assertEqual(densityFor('Topping', 'Grated mozzarella'), 0.47);
  });
  test('a learned density in the live table is used', () => {
    assertEqual(densityFor('freekeh', null, { freekeh: 0.62 }), 0.62);
  });
});

describe('cuisines', () => {
  test('words on a page become a code', () => {
    assertEqual([cuisineFromText('Indian'), cuisineFromText('Italian, Vegetarian'), cuisineFromText('jp'), cuisineFromText('Fusion')], ['IN', 'IT', 'JP', null]);
  });
  test('names', () => assertEqual([cuisineName('CH'), cuisineName(null)], ['Switzerland', '']));
});
