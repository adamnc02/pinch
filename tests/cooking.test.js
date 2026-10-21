import { describe, test, assertEqual } from './kit.js';
import {
  cToF, fToC, formatTemp, tempInputToC, tempForInput, formatMinutes, cookingLine, cookingProblems, methodLabel, looksLikeSeasoning,
} from '../js/lib/cooking.js';

describe('temperatures (stored °C, shown °C or °F)', () => {
  test('°C ↔ °F', () => {
    assertEqual([cToF(100), cToF(0), fToC(212), fToC(32)], [212, 32, 100, 0]);
  });
  test('°C shows exactly; °F rounds to the nearest 5, as oven dials do', () => {
    assertEqual([formatTemp(180), formatTemp(180, 'f'), formatTemp(200, 'f'), formatTemp(220, 'f')], ['180°C', '355°F', '390°F', '430°F']);
    assertEqual(formatTemp(null, 'f'), '');
  });
  test('typed °F is stored as whole °C, and reads back the same', () => {
    assertEqual([tempInputToC('350', 'f'), tempInputToC('425', 'f'), tempInputToC(' 200 ', 'c'), tempInputToC('', 'f')], [177, 218, 200, null]);
    assertEqual([tempForInput(177, 'f'), tempForInput(218, 'f'), tempForInput(200, 'c')], ['350', '425', '200']);
    assertEqual(Number.isNaN(tempInputToC('hot', 'c')), true);
  });
});

describe('cooking lines', () => {
  test('minutes read as minutes and hours', () => {
    assertEqual([formatMinutes(12), formatMinutes(60), formatMinutes(90), formatMinutes(360), formatMinutes(null)], ['12 min', '1 h', '1 h 30 min', '6 h', '']);
  });
  test('one line per option, leaving out what is empty', () => {
    assertEqual(cookingLine({ method: 'air_fryer', minutes: 12, tempC: 200 }), 'Air fryer · 12 min · 200°C');
    assertEqual(cookingLine({ method: 'oven', minutes: 20, tempC: 180 }, 'f'), 'Oven · 20 min · 355°F');
    assertEqual(cookingLine({ method: 'microwave', minutes: 2, tempC: null }), 'Microwave · 2 min');
    assertEqual(cookingLine({ method: 'other', name: 'Deep fryer', minutes: null, tempC: 180 }), 'Deep fryer · 180°C');
  });
  test('an Other with no name says Other', () => assertEqual(methodLabel({ method: 'other', name: ' ' }), 'Other'));
});

describe('cookingProblems (mirrors pinch.cooking_methods)', () => {
  const okOpt = { method: 'oven', name: null, minutes: 20, tempC: 200, note: null };
  test('a good option, and one with nothing but a method', () => {
    assertEqual(cookingProblems(okOpt), []);
    assertEqual(cookingProblems({ method: 'hob', minutes: null, tempC: null }), []);
  });
  test('an unknown method, an unnamed Other', () => {
    assertEqual(cookingProblems({ ...okOpt, method: 'kiln' }).length, 1);
    assertEqual(cookingProblems({ ...okOpt, method: 'other', name: '' }).length, 1);
  });
  test('time is whole minutes, 1 to 1440; temperature 20 to 300 °C', () => {
    assertEqual(cookingProblems({ ...okOpt, minutes: 2.5 }).length, 1);
    assertEqual(cookingProblems({ ...okOpt, minutes: 0 }).length, 1);
    assertEqual(cookingProblems({ ...okOpt, minutes: 1441 }).length, 1);
    assertEqual(cookingProblems({ ...okOpt, tempC: 301 }).length, 1);
    assertEqual(cookingProblems({ ...okOpt, tempC: NaN }).length, 1);
    assertEqual(cookingProblems({ ...okOpt, tempC: 20 }), []);
  });
  test('a note is at most 200 characters', () => assertEqual(cookingProblems({ ...okOpt, note: 'x'.repeat(201) }).length, 1));
});

describe('looksLikeSeasoning (a suggestion for a new ingredient)', () => {
  test('spices, herbs and salt', () => {
    assertEqual(['Salt', 'Black pepper', 'Paprika', 'Smoked paprika', 'Cayenne Pepper', 'Garlic Salt', 'ground cumin', 'Dried oregano', 'Garam masala']
      .map(looksLikeSeasoning), [true, true, true, true, true, true, true, true, true]);
  });
  test('common misspellings in phone notes', () => {
    assertEqual(['Ground Corriander', 'Ground Cardamon'].map(looksLikeSeasoning), [true, true]);
  });
  test('food that only shares a word is not', () => {
    assertEqual(['Red pepper', 'Bell peppers', 'Peppers', 'Garlic Paste', 'Chicken mince', 'Fish sauce', 'Saltimbocca', ''].map(looksLikeSeasoning),
      [false, false, false, false, false, false, false, false]);
  });
});
