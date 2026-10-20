import { describe, test, assertEqual } from './kit.js';
import { recipeFromClaude, linesFromClaude } from '../js/lib/claude-shape.js';

describe('recipeFromClaude', () => {
  test('a found recipe becomes the import shape', () => {
    const out = recipeFromClaude({ found: true, name: ' Dal ', servings: 4, ingredients: ['200g lentils', ' '], steps: ['Simmer.'], cuisine: 'in', meal: 'dinner' });
    assertEqual(out, { name: 'Dal', recipeYield: '4', recipeIngredient: ['200g lentils'], recipeInstructions: ['Simmer.'], recipeCuisine: 'IN', recipeCategory: 'dinner' });
  });
  test('unknown servings, cuisine and meal become null', () => {
    const out = recipeFromClaude({ found: true, name: 'x', servings: 0, ingredients: ['1 egg'], steps: [], cuisine: '', meal: 'unknown' });
    assertEqual([out.recipeYield, out.recipeCuisine, out.recipeCategory], [null, null, null]);
  });
  test('no recipe, or no ingredients, is null', () => {
    assertEqual(recipeFromClaude({ found: false, ingredients: ['x'] }), null);
    assertEqual(recipeFromClaude({ found: true, ingredients: [] }), null);
    assertEqual(recipeFromClaude(null), null);
  });
});

describe('linesFromClaude', () => {
  test('keeps only lines that were asked about, and cleans them', () => {
    const out = linesFromClaude({ ingredients: [
      { line: 'zest of one lemon', qty: 1, unit: 'each', name: 'Lemon zest' },
      { line: 'a dash of something', qty: 0, unit: 'to taste', name: '' },
      { line: 'not asked', qty: 2, unit: 'g', name: 'x' },
      { line: 'odd unit', qty: 2, unit: 'pinch', name: 'Saffron' },
    ] }, ['zest of one lemon', 'a dash of something', 'odd unit']);
    assertEqual(out, [
      { line: 'zest of one lemon', qty: 1, unit: 'each', name: 'Lemon zest' },
      { line: 'a dash of something', qty: null, unit: 'to taste', name: 'a dash of something' },
      { line: 'odd unit', qty: 2, unit: 'each', name: 'Saffron' },
    ]);
  });
  test('a malformed answer gives nothing', () => assertEqual(linesFromClaude({}, ['x']), []));
});
