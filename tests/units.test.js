import { describe, test, assertEqual, assertTrue } from './kit.js';
import { convert, unitOptions, nutritionStatus, missingMeasure, gramsBySpoon } from '../js/lib/units.js';

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
  test('a seasoning is never counted, whatever its amount or product', () => {
    assertEqual(nutritionStatus({ qty: 1, unit: 'tsp', seasoning: true }, p('100g'), null), 'not_counted');
    assertEqual(nutritionStatus({ qty: 1, unit: 'tsp', seasoning: true }, null, null), 'not_counted');
    assertEqual(nutritionStatus({ qty: 1, unit: 'tsp', seasoning: false }, p('100g'), null), 'unconvertible');
  });
  test('"2 each" against a per-100 g product counts once it has the weight of one', () => {
    assertEqual([s(2, 'each', p('100g')), s(2, 'each', p('100g', 58))], ['unconvertible', 'ok']);
  });
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

describe('the spoon weight (a per-100 g product\u2019s gramsPerTbsp)', () => {
  const pb = (gramsPerTbsp = null, basis = '100g') => ({ basis, gramsPerTbsp, gramsPerItem: null });
  const s = (qty, unit, product, density = null) => nutritionStatus({ qty, unit }, product, density);
  test('a spoon of a per-100 g product counts only once it has a spoon weight', () => {
    assertEqual([s(2, 'tbsp', pb()), s(2, 'tbsp', pb(16))], ['unconvertible', 'ok']);
    assertEqual([s(1, 'tsp', pb()), s(1, 'tsp', pb(16))], ['unconvertible', 'ok']);
  });
  test('a cup counts by the spoon weight even with no density', () => {
    assertEqual([s(1, 'cup', pb()), s(1, 'cup', pb(16))], ['unconvertible', 'ok']);
  });
  test('ml and l of a per-100 g product never count, spoon weight or not', () => {
    assertEqual([s(100, 'ml', pb(16)), s(1, 'l', pb(16))], ['unconvertible', 'unconvertible']);
  });
  test('missingMeasure names the one number that would fix it', () => {
    const m = (qty, unit, product, density = null) => missingMeasure({ qty, unit }, product, density);
    assertEqual([m(2, 'tbsp', pb()), m(1, 'cup', pb()), m(2, 'tbsp', pb(16))], ['spoon', 'spoon', null]);
    assertEqual(m(1, 'cup', pb(), 0.53), null);                               // the density already counts it
    assertEqual([m(2, 'each', pb()), m(100, 'g', { basis: 'item', gramsPerItem: null })], ['item', 'item']);
    assertEqual([m(100, 'ml', pb()), m(1, 'cup', { basis: 'item', gramsPerItem: 50 }), m(100, 'g', pb(16, '100ml'))], [null, null, null]);
    assertEqual([m(2, 'tbsp', null), m(null, 'tbsp', pb())], [null, null]);  // no product; not counted
  });
  test('gramsBySpoon: tsp is a third, a stored cup is 250 ml', () => {
    assertEqual([gramsBySpoon(2, 'tbsp', 16), gramsBySpoon(1.5, 'tsp', 16)], [32, 8]);
    assertTrue(near(gramsBySpoon(1, 'cup', 15), 250));
    assertEqual([gramsBySpoon(2, 'g', 16), gramsBySpoon(2, 'tbsp', null)], [null, null]);
  });
});
