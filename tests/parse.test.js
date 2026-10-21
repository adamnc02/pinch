import { describe, test, assertEqual } from './kit.js';
import { parseIngredientLine, splitRecipeText, draftFromImport, servesFrom, mealFrom, looksLikeUrl, hostOf, titleCase, stripListMarker } from '../js/lib/parse.js';

const p = (line) => {
  const r = parseIngredientLine(line);
  return [r.qty, r.unit, r.name, r.ok];
};

describe('parseIngredientLine', () => {
  test('weights and volumes', () => {
    assertEqual(p('400g spaghetti'), [400, 'g', 'Spaghetti', true]);
    assertEqual(p('200 g plain flour'), [200, 'g', 'Plain flour', true]);
    assertEqual(p('1.5kg potatoes'), [1.5, 'kg', 'Potatoes', true]);
    assertEqual(p('300ml milk'), [300, 'ml', 'Milk', true]);
    assertEqual(p('2 tbsp olive oil'), [2, 'tbsp', 'Olive oil', true]);
    assertEqual(p('1 teaspoon ground cumin'), [1, 'tsp', 'Ground cumin', true]);
    assertEqual(p('2 cups of flour'), [2, 'cup', 'Flour', true]);
  });
  test('fractions, mixed numbers and unicode glyphs', () => {
    assertEqual(p('1/2 tsp salt'), [0.5, 'tsp', 'Salt', true]);
    assertEqual(p('1 1/2 cups rice'), [1.5, 'cup', 'Rice', true]);
    assertEqual(p('1½ cups plain flour'), [1.5, 'cup', 'Plain flour', true]);
    assertEqual(p('¾ tsp chilli flakes'), [0.75, 'tsp', 'Chilli flakes', true]);
    assertEqual(p('2,5 dl'), [2.5, 'each', 'Dl', true]);
  });
  test('ranges keep the first value', () => {
    assertEqual(p('2-3 garlic cloves'), [2, 'each', 'Garlic cloves', true]);
    assertEqual(p('1 to 2 tbsp honey'), [1, 'tbsp', 'Honey', true]);
  });
  test('"2 x 400g tins" is two of something', () => {
    const r = parseIngredientLine('2 x 400g tins chickpeas, drained');
    assertEqual([r.qty, r.unit, r.name, r.itemGrams], [2, 'each', 'Tins chickpeas, drained', 400]);
  });
  test('counted things are each, and "a"/"an" is one', () => {
    assertEqual(p('3 eggs'), [3, 'each', 'Eggs', true]);
    assertEqual(p('an onion, finely chopped'), [1, 'each', 'Onion, finely chopped', true]);
  });
  test('imperial becomes metric', () => {
    assertEqual(p('8 oz cheddar'), [226.8, 'g', 'Cheddar', true]);
    assertEqual(p('1 pint stock'), [568, 'ml', 'Stock', true]);
  });
  test('a unit only matches a whole word', () => {
    assertEqual(p('2 garlic cloves'), [2, 'each', 'Garlic cloves', true]);
    assertEqual(p('1 large lemon'), [1, 'each', 'Large lemon', true]);
  });
  test('to taste and amount-free lines', () => {
    assertEqual(p('Salt and pepper, to taste'), [null, 'to taste', 'Salt and pepper', true]);
    assertEqual(p('Fresh coriander'), [null, 'to taste', 'Fresh coriander', true]);
    assertEqual(p('a pinch of saffron'), [null, 'to taste', 'Saffron', true]);
  });
  test('a long line with no amount is left for Claude', () => {
    assertEqual(p('The zest and juice of one unwaxed lemon plus extra')[3], false);
  });
  test('lines collected from real recipe pages', () => {
    assertEqual(p('800g/1lb 12oz canned chickpeas or 720g jar giant chickpeas'), [800, 'g', 'Canned chickpeas or 720g jar giant chickpeas', true]);
    assertEqual(p('5cm piece of ginger'), [1, 'each', '5cm piece of ginger', true]);
    assertEqual(p('sea salt and freshly ground black pepper'), [null, 'to taste', 'Sea salt and freshly ground black pepper', true]);
    assertEqual(p('3 onions quartered'), [3, 'each', 'Onions quartered', true]);
    assertEqual(p('100g pancetta'), [100, 'g', 'Pancetta', true]);
  });
  test('parenthetical conversions and bullets are dropped', () => {
    assertEqual(p('• 200g (7oz) caster sugar'), [200, 'g', 'Caster sugar', true]);
  });
});

describe('splitRecipeText', () => {
  test('with headings', () => {
    const r = splitRecipeText('Chana masala\nServes 4\n\nIngredients\n2 x 400g tins chickpeas\n1 onion\n\nMethod\n1. Fry the onion.\n2. Add the chickpeas.');
    assertEqual([r.name, r.serves], ['Chana masala', 4]);
    assertEqual(r.ingredients, ['2 x 400g tins chickpeas', '1 onion']);
    assertEqual(r.steps, ['Fry the onion.', 'Add the chickpeas.']);
  });
  test('without headings', () => {
    const r = splitRecipeText('Toast\n2 slices bread\n10g butter\nToast the bread until golden, then spread with the butter.');
    assertEqual(r.ingredients, ['2 slices bread', '10g butter']);
    assertEqual(r.steps.length, 1);
  });
});

describe('draftFromImport', () => {
  let n = 0;
  const newId = () => `id${++n}`;
  test('JSON-LD shape → a draft with ids, tags and the unparsed lines', () => {
    const { recipe, unparsed } = draftFromImport({
      name: 'Chana masala', recipeYield: '4 servings', recipeCategory: 'Main course', recipeCuisine: 'Indian',
      recipeIngredient: ['1 onion', '2 tsp garam masala', 'The zest and juice of one unwaxed lemon plus extra'],
      recipeInstructions: ['Fry the onion.', 'Stir in the garam masala.'],
    }, { newId });
    assertEqual([recipe.serves, recipe.meal, recipe.cuisine], [4, 'dinner', 'IN']);
    assertEqual(recipe.ingredients.length, 3);
    assertEqual(recipe.steps[0].ingredientIds, [recipe.ingredients[0].id]);
    assertEqual(recipe.steps[1].ingredientIds, [recipe.ingredients[1].id]);
    assertEqual(unparsed, [recipe.ingredients[2].id]);
  });
  test('the chosen serves and meal win over the page', () => {
    const { recipe } = draftFromImport({ name: 'x', recipeYield: '6', recipeIngredient: [], recipeInstructions: [] }, { serves: 2, meal: 'lunch', newId });
    assertEqual([recipe.serves, recipe.meal], [2, 'lunch']);
  });
});

describe('small helpers', () => {
  test('servesFrom', () => {
    assertEqual([servesFrom('Serves 6'), servesFrom(['4', '4 servings']), servesFrom('Makes 12'), servesFrom('lots'), servesFrom(4)], [6, 4, 12, null, 4]);
  });
  test('a phone-note checklist: markers off, no title, numbered steps wrapped across lines', () => {
    const note = '- [ ] 2kg chicken thigh\n- [ ] 1 tsp salt\n- [x] 1 tbsp ground cumin\n\n'
      + '1. Add all the ingredients into a bowl and then add\nthe chicken thighs. Leave in the\nfridge for 24 hours\n'
      + '2. Close the lid and cook for approx. 40 minutes or until\n75 degrees centigrade';
    const r = splitRecipeText(note);
    assertEqual(r.name, '');
    assertEqual(r.ingredients, ['2kg chicken thigh', '1 tsp salt', '1 tbsp ground cumin']);
    assertEqual(r.steps, [
      'Add all the ingredients into a bowl and then add the chicken thighs. Leave in the fridge for 24 hours',
      'Close the lid and cook for approx. 40 minutes or until 75 degrees centigrade']);
  });
  test('a checklist note with a title keeps it', () => {
    const r = splitRecipeText('Rotisserie thighs\n☐ 2kg chicken thigh\n• 1 tsp salt\n1. Marinate.\n2. Cook.');
    assertEqual([r.name, r.ingredients.length, r.steps], ['Rotisserie thighs', 2, ['Marinate.', 'Cook.']]);
  });
  test('wrapped lines join under a Method heading too; unnumbered steps stay one per line', () => {
    assertEqual(splitRecipeText('X\nIngredients\n1 egg\nMethod\n1. Whisk the\negg.\n2. Fry it.').steps, ['Whisk the egg.', 'Fry it.']);
    assertEqual(splitRecipeText('X\nIngredients\n1 egg\nMethod\nWhisk the egg.\nFry it.').steps, ['Whisk the egg.', 'Fry it.']);
  });
  test('list markers never reach a name', () => {
    assertEqual(['- [ ] 250ml olive oil', '* [x] salt', '☐ 2 eggs', '- 1 onion'].map(stripListMarker), ['250ml olive oil', 'salt', '2 eggs', '1 onion']);
    assertEqual(p('- [ ] 250ml olive oil'), [250, 'ml', 'Olive oil', true]);
  });
  test('titleCase: every lower-case word, small words and capitals left alone', () => {
    assertEqual(titleCase('chicken thigh'), 'Chicken Thigh');
    assertEqual(titleCase('Self-raising flour'), 'Self-Raising Flour');
    assertEqual(titleCase('salt and pepper'), 'Salt and Pepper');
    assertEqual(titleCase("McVitie's digestives, BBQ sauce"), "McVitie's Digestives, BBQ Sauce");
    assertEqual(titleCase('of course'), 'Of Course');
  });
  test('an import draft is in title case', () => {
    let k = 0;
    const { recipe } = draftFromImport({ name: 'rotisserie thighs', recipeIngredient: ['2kg chicken thigh'], recipeInstructions: [] }, { newId: () => `t${++k}` });
    assertEqual([recipe.name, recipe.ingredients[0].name], ['Rotisserie Thighs', 'Chicken Thigh']);
  });
  test('an import draft starts with the cooking options its method states', () => {
    let k = 0;
    const { recipe } = draftFromImport({ name: 'x', recipeIngredient: [], recipeInstructions: ['Air fry at 200°C for 12 minutes.'] }, { newId: () => `c${++k}` });
    assertEqual(recipe.cooking.map((c) => [c.method, c.minutes, c.tempC, c.name, typeof c.id]), [['air_fryer', 12, 200, null, 'string']]);
  });
  test('mealFrom files sauces, dressings and condiments under sauce', () => {
    assertEqual([mealFrom('Sauce'), mealFrom('Salad dressing'), mealFrom('Condiments'), mealFrom('Dips'), mealFrom('Main course')], ['sauce', 'sauce', 'sauce', 'sauce', 'dinner']);
  });
  test('mealFrom prefers dinner when a page lists several', () => {
    assertEqual([mealFrom('Dinner, Lunch, Main course'), mealFrom('Lunch'), mealFrom('Breakfast, Brunch'), mealFrom('Dessert')], ['dinner', 'lunch', 'breakfast', null]);
  });
  test('looksLikeUrl and hostOf', () => {
    assertEqual([looksLikeUrl(' https://www.bbcgoodfood.com/recipes/x '), looksLikeUrl('2 eggs')], [true, false]);
    assertEqual(hostOf('https://www.bbcgoodfood.com/recipes/x'), 'bbcgoodfood.com');
  });
});
