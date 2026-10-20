import { describe, test, assertEqual } from './kit.js';
import { formatAmount, quarters } from '../js/lib/format.js';

describe('formatAmount, as written', () => {
  test('null qty is blank; to taste says so', () => {
    assertEqual(formatAmount(null, 'g'), '');
    assertEqual(formatAmount(null, 'to taste'), 'to taste');
  });
  test('each is a whole number', () => {
    assertEqual(formatAmount(6, 'each'), '6');
    assertEqual(formatAmount(4.5, 'each'), '5');
    assertEqual(formatAmount(0.4, 'each'), '1');
  });
  test('grams round for humans', () => {
    assertEqual(formatAmount(600.0000001, 'g'), '600 g');
    assertEqual(formatAmount(33.333333, 'g'), '33 g');
    assertEqual(formatAmount(2.25, 'g'), '2.3 g');
    assertEqual(formatAmount(337.5, 'g'), '340 g');
    assertEqual(formatAmount(1250, 'g'), '1.25 kg');
  });
  test('ml rolls up to l, kg under 1 shows grams', () => {
    assertEqual(formatAmount(1500, 'ml'), '1.5 l');
    assertEqual(formatAmount(0.5, 'kg'), '500 g');
  });
  test('spoons and cups use glyphs only for a real quarter', () => {
    assertEqual(formatAmount(1.5, 'tbsp'), '1½ tbsp');
    assertEqual(formatAmount(0.75, 'cup'), '¾ cup');
    assertEqual(formatAmount(2, 'cup'), '2 cups');
    assertEqual(formatAmount(1, 'tsp'), '1 tsp');
  });
  test('a spoon that is not a quarter snaps, with ≈', () => {
    assertEqual(formatAmount(1 / 3, 'tsp'), '≈ ¼ tsp');
    assertEqual(formatAmount(1.1, 'tbsp'), '≈ 1 tbsp');
  });
  test('tiny amounts keep their decimal', () => {
    assertEqual(formatAmount(0.1, 'tsp'), '0.1 tsp');
  });
  test('quarters', () => {
    assertEqual(quarters(1.25), '1¼');
    assertEqual(quarters(0.5), '½');
    assertEqual(quarters(3), '3');
  });
});

describe('formatAmount, display modes', () => {
  test('metric turns cups into ml and leaves spoons', () => {
    assertEqual(formatAmount(1.5, 'cup', { mode: 'metric' }), '375 ml');
    assertEqual(formatAmount(2, 'tsp', { mode: 'metric' }), '2 tsp');
  });
  test('cups: ml snaps to the nearest quarter with ≈, an exact quarter has none', () => {
    assertEqual(formatAmount(250, 'ml', { mode: 'cups' }), '1 cup');
    assertEqual(formatAmount(200, 'ml', { mode: 'cups' }), '≈ ¾ cup');
    assertEqual(formatAmount(375, 'ml', { mode: 'cups' }), '1½ cups');
  });
  test('cups: grams need a density, else stay as written', () => {
    assertEqual(formatAmount(200, 'g', { mode: 'cups', density: 0.53 }), '≈ 1½ cups');
    assertEqual(formatAmount(200, 'g', { mode: 'cups' }), '200 g');
  });
  test('cups: from ⅛ cup up it snaps (never below ¼); under ⅛ cup keeps the written amount', () => {
    assertEqual(formatAmount(50, 'g', { mode: 'cups', density: 1.03 }), '≈ ¼ cup');
    assertEqual(formatAmount(30, 'ml', { mode: 'cups' }), '30 ml');
    assertEqual(formatAmount(35, 'ml', { mode: 'cups' }), '≈ ¼ cup');
  });
  test('cups: US cup size converts a stored metric cup', () => {
    assertEqual(formatAmount(1, 'cup', { mode: 'cups', cup: 'us' }), '≈ 1 cup');
    assertEqual(formatAmount(236.6, 'ml', { mode: 'cups', cup: 'us' }), '1 cup');
  });
  test('g ↔ ml never happens: metric leaves g alone', () => {
    assertEqual(formatAmount(200, 'g', { mode: 'metric', density: 1 }), '200 g');
  });
});

describe('formatAmount, original', () => {
  test('exactly what was entered, no rounding for humans', () => {
    assertEqual(formatAmount(122, 'g', { mode: 'original' }), '122 g');
    assertEqual(formatAmount(1250, 'g', { mode: 'original' }), '1250 g');
    assertEqual(formatAmount(1 / 3, 'tsp', { mode: 'original' }), '0.33 tsp');
    assertEqual(formatAmount(4.5, 'each', { mode: 'original' }), '4.5');
  });
  test('a real quarter of a spoon or cup keeps its glyph, never "≈"', () => {
    assertEqual(formatAmount(1.5, 'cup', { mode: 'original' }), '1½ cups');
    assertEqual(formatAmount(0.75, 'tbsp', { mode: 'original' }), '¾ tbsp');
  });
  test('as written still rounds for humans', () => assertEqual(formatAmount(122, 'g'), '120 g'));
});
