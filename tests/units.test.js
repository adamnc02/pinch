import { describe, test, assertEqual, assertTrue } from './kit.js';
import { convert, unitOptions, nutritionStatus } from '../js/lib/units.js';

const near = (a, b) => Math.abs(a - b) < 1e-6;

describe('convert', () => {
  test('volume is fixed arithmetic', () => {
    assertEqual(convert(3, 'tsp', 'tbsp').qty, 1);
    assertEqual(convert(1, 'l', 'ml').qty, 1000);
    assertEqual(convert(1, 'cup', 'ml').qty, 250);
  });
  test('a stored cup is 250 ml; converting INTO cups follows the cup size', () => {
    assertEqual(convert(250, 'ml', 'cup').qty, 1);
    assertTrue(near(convert(236.6, 'ml', 'cup', { cup: 'us' }).qty, 1));
    assertTrue(near(convert(1, 'cup', 'cup', { cup: 'us' }).qty, 250 / 236.6));
  });
  test('g ↔ cup needs a density', () => {
    assertTrue(near(convert(1, 'cup', 'g', { density: 0.53 }).qty, 132.5));
    assertTrue(near(convert(132.5, 'g', 'cup', { density: 0.53 }).qty, 1));
    assertTrue(near(convert(0.1325, 'kg', 'cup', { density: 0.53 }).qty, 1));
  });
  test('g ↔ cup without a density says so, never guesses', () => {
    assertTrue(Boolean(convert(1, 'cup', 'g').error));
    assertTrue(Boolean(convert(100, 'g', 'cup', { density: null }).error));
  });
  test('g ↔ ml is refused, even with a density', () => {
    assertTrue(Boolean(convert(100, 'g', 'ml', { density: 1 }).error));
    assertTrue(Boolean(convert(1, 'tbsp', 'g', { density: 1 }).error));
  });
  test('weight to weight', () => {
    assertEqual(convert(1.5, 'kg', 'g').qty, 1500);
  });
});

describe('unitOptions', () => {
  test('a weight offers itself and cup, cup disabled without a density', () => {
    assertEqual(unitOptions('g', null).map((o) => [o.unit, o.ok]), [['g', true], ['cup', false]]);
    assertEqual(unitOptions('g', 0.5).map((o) => o.ok), [true, true]);
  });
  test('cups can go to g (with a density) or ml; g ↔ ml never appears', () => {
    assertEqual(unitOptions('cup', 0.53).map((o) => o.unit), ['g', 'ml', 'cup']);
    assertEqual(unitOptions('ml', null).map((o) => o.unit), ['ml', 'cup']);
  });
});

describe('nutritionStatus (mirrors pinch.ingredient_nutrition)', () => {
  const p = (basis, gramsPerItem = null) => ({ basis, gramsPerItem });
  const s = (qty, unit, product, density = null) => nutritionStatus({ qty, unit }, product, density);
  test('to taste and no amount are not counted', () => {
    assertEqual(s(null, 'g', p('100g')), 'not_counted');
    assertEqual(s(1, 'to taste', p('100g')), 'not_counted');
  });
  test('no product needs nutrition', () => assertEqual(s(1, 'g', null), 'no_product'));
  test('per 100 g', () => {
    assertEqual(s(100, 'g', p('100g')), 'ok');
    assertEqual(s(1, 'cup', p('100g')), 'unconvertible');
    assertEqual(s(1, 'cup', p('100g'), 0.5), 'ok');
    assertEqual(s(100, 'ml', p('100g')), 'unconvertible');
    assertEqual(s(2, 'each', p('100g')), 'unconvertible');
    assertEqual(s(2, 'each', p('100g', 400)), 'ok');
  });
  test('per 100 ml', () => {
    assertEqual(s(1, 'cup', p('100ml')), 'ok');
    assertEqual(s(2, 'tbsp', p('100ml')), 'ok');
    assertEqual(s(100, 'g', p('100ml')), 'unconvertible');
  });
  test('per item', () => {
    assertEqual(s(2, 'each', p('item')), 'ok');
    assertEqual(s(100, 'g', p('item')), 'unconvertible');
    assertEqual(s(100, 'g', p('item', 50)), 'ok');
    assertEqual(s(1, 'cup', p('item', 50)), 'unconvertible');
  });
});
