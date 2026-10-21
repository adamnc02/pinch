import { describe, test, assertEqual, assertTrue } from './kit.js';
import { shoppingLines, itemText, baseName, alreadyOn, appendPosition, listlyId, sortLists } from '../js/lib/shopping.js';

const lasagne = () => ({
  id: 'r1', name: '(Dinner) Lasagne', serves: 4,
  ingredients: [
    { id: 'a', name: 'Plain flour', qty: 250, unit: 'g' },
    { id: 'b', name: 'Butter', qty: 50, unit: 'g' },
    { id: 'c', name: 'Milk', qty: 1.5, unit: 'cup' },
    { id: 'd', name: 'Eggs', qty: 2, unit: 'each' },
    { id: 'e', name: 'Salt', qty: null, unit: 'to taste' },
    { id: 'f', name: 'butter', qty: 30, unit: 'g' },
    { id: 'g', name: 'Nutmeg', qty: 0.5, unit: 'tsp' },
    { id: 'h', name: 'Passata', qty: 0.7, unit: 'l' },
    { id: 'i', name: 'Passata', qty: 100, unit: 'ml' },
  ],
  steps: [],
});

describe('shoppingLines', () => {
  test('scales to the servings chosen and writes "Name (amount)"', () => {
    const lines = shoppingLines(lasagne(), 8);
    assertEqual(lines.map((l) => l.text), ['Plain flour (500 g)', 'Butter (160 g)', 'Milk (750 ml)', 'Eggs (4)', 'Salt', 'Nutmeg (1 tsp)', 'Passata (1.6 l)']);
  });
  test('the same ingredient in the same unit is one line, added together', () => {
    const butter = shoppingLines(lasagne(), 4).filter((l) => l.name.toLowerCase() === 'butter');
    assertEqual(butter.length, 1);
    assertEqual(butter[0].text, 'Butter (80 g)');
  });
  test('kg is counted as g and l as ml before adding', () => {
    const r = { serves: 1, ingredients: [{ name: 'Rice', qty: 1, unit: 'kg' }, { name: 'Rice', qty: 200, unit: 'g' }], steps: [] };
    assertEqual(shoppingLines(r, 1).map((l) => l.text), ['Rice (1.2 kg)']);
  });
  test('amounts are metric whatever the display setting: cups become ml', () => {
    assertEqual(shoppingLines(lasagne(), 4).find((l) => l.name === 'Milk').text, 'Milk (375 ml)');
  });
  test('to taste and no amount are the name alone, marked toTaste', () => {
    const salt = shoppingLines(lasagne(), 4).find((l) => l.name === 'Salt');
    assertEqual([salt.text, salt.toTaste], ['Salt', true]);
    const r = { serves: 2, ingredients: [{ name: 'Basil', qty: null, unit: 'g' }], steps: [] };
    assertEqual(shoppingLines(r, 4).map((l) => [l.text, l.toTaste]), [['Basil', false]]);
  });
  test('an amount-less line is dropped when the same name has an amount', () => {
    const r = { serves: 1, ingredients: [{ name: 'Oil', qty: null, unit: 'to taste' }, { name: 'oil', qty: 2, unit: 'tbsp' }], steps: [] };
    assertEqual(shoppingLines(r, 1).map((l) => l.text), ['oil (2 tbsp)']);
  });
  test('different units of one name stay separate (g ↔ ml is never converted)', () => {
    const r = { serves: 1, ingredients: [{ name: 'Yogurt', qty: 100, unit: 'g' }, { name: 'Yogurt', qty: 100, unit: 'ml' }], steps: [] };
    assertEqual(shoppingLines(r, 1).map((l) => l.text), ['Yogurt (100 g)', 'Yogurt (100 ml)']);
  });
  test('unnamed rows are skipped, and the recipe is not changed', () => {
    const r = lasagne();
    r.ingredients.push({ id: 'z', name: '  ', qty: 1, unit: 'each' });
    const before = JSON.stringify(r);
    assertEqual(shoppingLines(r, 4).length, 7);
    assertEqual(JSON.stringify(r), before);
  });
});

describe('itemText and baseName', () => {
  test('itemText', () => {
    assertEqual(itemText('Flour', 500, 'g'), 'Flour (500 g)');
    assertEqual(itemText('Salt', null, null), 'Salt');
  });
  test('baseName drops a trailing bracket and case', () => {
    assertEqual(baseName('Plain flour (500 g)'), 'plain flour');
    assertEqual(baseName('  Milk '), 'milk');
    assertEqual(baseName('Tomatoes (tinned) (2)'), 'tomatoes (tinned)');
  });
});

describe('alreadyOn', () => {
  test('matches open items by name, ignoring their amount; ticked items do not count', () => {
    const lines = shoppingLines(lasagne(), 4);
    const on = alreadyOn(lines, [{ text: 'plain flour (1 kg)', done: false }, { text: 'Milk', done: true }, { text: 'Eggs', done: false }]);
    assertEqual([...on].sort(), ['eggs|each', 'plain flour|g']);
  });
});

describe('Listly rows', () => {
  test('appendPosition goes after the last, ignoring nulls; an empty list starts at 0', () => {
    assertEqual(appendPosition([0, 3, null, 1]), 4);
    assertEqual(appendPosition([]), 0);
    assertEqual(appendPosition([null]), 0);
  });
  test('listlyId is 8 characters of Listly’s alphabet', () => {
    for (let n = 0; n < 200; n++) assertTrue(/^[A-HJ-NP-Za-km-z2-9]{8}$/.test(listlyId()));
  });
  test('sortLists: by position, then id, no position last', () => {
    const out = sortLists([{ id: 'b', position: null }, { id: 'c', position: 1 }, { id: 'a', position: 1 }, { id: 'd', position: 0 }]);
    assertEqual(out.map((l) => l.id), ['d', 'a', 'c', 'b']);
  });
});
