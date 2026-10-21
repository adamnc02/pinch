import { describe, test, assertEqual } from './kit.js';
import {
  cToF, fToC, formatTemp, tempInputToC, tempForInput, formatMinutes, cookingLine, cookingProblems, methodLabel, looksLikeSeasoning,
  suggestCooking,
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

describe('suggestCooking (cooking options read from a method)', () => {
  const opt = (method, minutes, tempC, note = null) => ({ method, minutes, tempC, note });
  test('a rotisserie BBQ note: time from the next step, the internal temperature as a note, not the marinade', () => {
    assertEqual(suggestCooking([
      'Add all the ingredients into a bowl and the chicken thighs. Cover and leave to marinate in the fridge for 24 hours',
      'Remove the warming shelf for the grill and prepare the rotisserie. Remember to use a grill plate under the rotisserie',
      'Return chicken to the rotisserie, fire up the two outer burners to low and start the rotisserie motor.',
      'Close the lid and cook for approx. 40 minutes or until you have an internal temperature of 75 degrees centigrade',
    ]), [opt('bbq', 40, null, 'Until 75°C inside')]);
  });
  test('🚨 an internal temperature is never the cooking temperature', () => {
    const [o] = suggestCooking(['Roast at 425°F for 1 hour 15 minutes, until a thermometer reads 165°F.']);
    assertEqual([o.method, o.minutes, o.tempC, o.note], ['oven', 75, 218, 'Until 74°C inside']);
  });
  test('"200°C (180°C fan)" and "200C/180C fan" give an oven and a fan oven, sharing the time', () => {
    const both = [opt('oven', 25, 200), opt('fan_oven', 25, 180)];
    assertEqual(suggestCooking(['Preheat the oven to 200°C (180°C fan).', 'Bake for 25-30 minutes until golden.']), both);
    assertEqual(suggestCooking(['Heat the oven to 200C/180C fan and bake for 25 mins.']), both);
  });
  test('air fryer, slow cooker, microwave and grill', () => {
    assertEqual(suggestCooking(['Cook in the air fryer at 190C for 12 mins, turning halfway.']), [opt('air_fryer', 12, 190)]);
    assertEqual(suggestCooking(['Put everything in the slow cooker on low for 8 hours.']), [opt('slow_cooker', 480, null)]);
    assertEqual(suggestCooking(['Microwave on high for 2 minutes.']), [opt('microwave', 2, null)]);
    assertEqual(suggestCooking(['Marinate in the fridge for 2 hours.', 'Grill for 8 minutes each side.']), [opt('grill', 8, null)]);
  });
  test('nothing from hob work, a grill pan, or a method only mentioned', () => {
    assertEqual(suggestCooking(['Simmer for 15 minutes.', 'Season to taste.']), []);
    assertEqual(suggestCooking(['Heat a grill pan and sear for 3 minutes.']), []);
    assertEqual(suggestCooking(['Serve warm from the oven.']), []);
  });
});
