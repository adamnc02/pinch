import { describe, test, assertEqual, assertTrue } from './kit.js';
import { makeBackup, parseBackup } from '../js/lib/backup.js';

const data = {
  recipes: [{ id: 'r', name: 'Dal', serves: 4, meal: 'dinner', ingredients: [{ id: 'a', name: 'Lentils', qty: 200, unit: 'g' }], steps: [{ id: 's', text: 'Simmer', ingredientIds: ['a'] }] }],
  products: [{ id: 'p', name: 'Lentils', basis: '100g', kcal: 350, protein: 24, carbs: 60, fat: 1 }],
};

describe('parseBackup', () => {
  test('round-trips a backup', () => {
    const out = parseBackup(JSON.stringify(makeBackup(data, new Date('2026-10-19T12:00:00Z'))));
    assertEqual(out, data);
  });
  test('never throws on bad input', () => {
    for (const bad of ['', 'nope', 'null', '[]', '{"kind":"x"}', '{"kind":"pinch-backup","version":1}']) {
      assertTrue(typeof parseBackup(bad).error === 'string', `error for ${bad}`);
    }
  });
  test('refuses another version', () => {
    assertTrue(/version 2/.test(parseBackup(JSON.stringify({ ...makeBackup(data), version: 2 })).error));
  });
  test('refuses a damaged step', () => {
    const b = makeBackup(structuredClone(data));
    b.recipes[0].steps[0].ingredientIds = 'a';
    assertTrue(Boolean(parseBackup(JSON.stringify(b)).error));
  });
});
