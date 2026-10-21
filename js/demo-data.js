// The design's sample recipes, for ?demo only (see storage.js). Fixed ids so
// a demo deep link like #/recipe/<id> keeps working across reloads.

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let next = 100;
const ing = (name, qty, unit, productId = null) => ({ id: id(next++), name, qty, unit, productId });
const spice = (...args) => ({ ...ing(...args), seasoning: true });
const step = (text, ...tagged) => ({ id: id(next++), text, ingredientIds: tagged.map((i) => i.id) });
const cook = (method, minutes, tempC, note = null) => ({ id: id(next++), method, name: null, minutes, tempC, note });

export function demoData() {
  next = 100;
  const products = [
    { id: id(1), name: 'Spaghetti', brand: 'De Cecco', barcode: '8001250120120', basis: '100g', kcal: 359, protein: 13, carbs: 71, fat: 1.5, gramsPerItem: 500, source: 'off' },
    { id: id(2), name: 'Guanciale', brand: null, barcode: null, basis: '100g', kcal: 655, protein: 10, carbs: 0, fat: 69, gramsPerItem: null, source: 'label' },
    { id: id(3), name: 'Egg', brand: null, barcode: null, basis: 'item', kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8, gramsPerItem: 50, source: 'label' },
    { id: id(4), name: 'Egg yolk', brand: null, barcode: null, basis: 'item', kcal: 55, protein: 2.7, carbs: 0.6, fat: 4.5, gramsPerItem: 17, source: 'label' },
    { id: id(5), name: 'Pecorino Romano', brand: null, barcode: null, basis: '100g', kcal: 387, protein: 32, carbs: 0, fat: 27, gramsPerItem: null, source: 'label' },
    { id: id(6), name: 'Chickpeas in water', brand: 'Napolina', barcode: '8005121000207', basis: '100g', kcal: 115, protein: 7.2, carbs: 13.4, fat: 2.1, gramsPerItem: 240, source: 'off' },
    { id: id(7), name: 'Rolled oats', brand: 'Flahavan’s', barcode: '5011051000000', basis: '100g', kcal: 370, protein: 13, carbs: 60, fat: 7, gramsPerItem: null, source: 'off' },
    { id: id(8), name: 'Semi-skimmed milk', brand: null, barcode: null, basis: '100ml', kcal: 50, protein: 3.6, carbs: 4.8, fat: 1.8, gramsPerItem: null, source: 'label' },
  ];
  const [spaghetti, guanciale, egg, yolk, pecorino, chickpeas, oats, milk] = products.map((p) => p.id);

  const carb = [ing('Spaghetti', 400, 'g', spaghetti), ing('Guanciale', 150, 'g', guanciale), ing('Egg yolks', 4, 'each', yolk),
    ing('Whole eggs', 2, 'each', egg), ing('Pecorino Romano', 60, 'g', pecorino), ing('Parmigiano Reggiano', 30, 'g'), spice('Black pepper', 2 / 3, 'tbsp')];
  const chana = [ing('Chickpeas, tinned', 2, 'each', chickpeas), ing('Onion', 1, 'each'), ing('Vegetable oil', 2, 'tbsp'), ing('Garlic', 3, 'each'),
    ing('Ginger', 1, 'tbsp'), spice('Garam masala', 2, 'tsp'), ing('Chopped tomatoes', 400, 'g'), ing('Fresh coriander', 0.5, 'cup'), spice('Salt', null, 'to taste')];
  const muesli = [ing('Rolled oats', 80, 'g', oats), ing('Semi-skimmed milk', 1, 'cup', milk), ing('Apple', 1, 'each'), ing('Honey', 1, 'tbsp')];
  const katsu = [ing('Chicken breast', 2, 'each'), ing('Panko', 80, 'g'), ing('Plain flour', 30, 'g'), ing('Egg', 1, 'each', egg), ing('Curry roux', 100, 'g'), ing('Rice', 300, 'g')];
  const krapao = [ing('Pork mince', 300, 'g'), ing('Thai basil', 1, 'cup'), ing('Garlic', 4, 'each'), ing('Bird’s eye chilli', 3, 'each'), ing('Oyster sauce', 1, 'tbsp'), ing('Fish sauce', 1, 'tbsp')];
  const croque = [ing('Bread', 4, 'each'), ing('Ham', 4, 'each'), ing('Gruyère', 100, 'g'), ing('Butter', 20, 'g'), ing('Milk', 200, 'ml', milk), ing('Eggs', 2, 'each', egg)];
  const risotto = [ing('Carnaroli rice', 320, 'g'), ing('Chicken stock', 1.2, 'l'), ing('Saffron', null, 'to taste'), ing('Butter', 60, 'g'), ing('Parmesan', 60, 'g')];
  const verde = [ing('Flat-leaf parsley', 1, 'cup'), ing('Capers', 1, 'tbsp'), ing('Olive oil', 100, 'ml'), ing('Red wine vinegar', 1, 'tbsp'), spice('Salt', null, 'to taste')];
  const katsuCook = [cook('air_fryer', 12, 200, 'Spray with oil and turn halfway'), cook('oven', 20, 200)];

  const recipes = [
    { id: id(11), name: 'Spaghetti carbonara', serves: 4, meal: 'dinner', cuisine: 'IT', photoPath: null, blocRecipeId: null, ingredients: carb, steps: [
      step('Cut the guanciale into strips and render slowly in a cold pan until crisp.', carb[1]),
      step('Whisk the yolks and eggs with most of the cheese and plenty of pepper.', carb[2], carb[3], carb[4], carb[6]),
      step('Boil the spaghetti in well-salted water until just shy of al dente.', carb[0]),
      step('Off the heat, toss with the guanciale, then the egg mix, loosening with pasta water. Finish with Parmigiano.', carb[5])] },
    { id: id(12), name: 'Chicken katsu curry', serves: 2, meal: 'dinner', cuisine: 'JP', photoPath: null, blocRecipeId: null, ingredients: katsu, steps: [
      step('Flatten the chicken, then dip in flour, egg and panko.', katsu[0], katsu[2], katsu[3], katsu[1]),
      step('Shallow fry until golden and cooked through.'),
      step('Make the curry sauce with the roux and serve over rice.', katsu[4], katsu[5])], cooking: katsuCook },
    { id: id(13), name: 'Pad kra pao', serves: 2, meal: 'lunch', cuisine: 'TH', photoPath: null, blocRecipeId: null, ingredients: krapao, steps: [
      step('Pound the garlic and chillies.', krapao[2], krapao[3]),
      step('Stir-fry the pork in a very hot wok, then add the sauces.', krapao[0], krapao[4], krapao[5]),
      step('Wilt in the basil off the heat.', krapao[1])] },
    { id: id(14), name: 'Croque madame', serves: 2, meal: 'breakfast', cuisine: 'FR', photoPath: null, blocRecipeId: null, ingredients: croque, steps: [
      step('Make a quick béchamel with the butter and milk.', croque[3], croque[4]),
      step('Build the sandwiches with ham and cheese, top with béchamel and bake.', croque[0], croque[1], croque[2]),
      step('Fry the eggs and set one on each.', croque[5])] },
    { id: id(15), name: 'Bircher muesli', serves: 2, meal: 'breakfast', cuisine: 'CH', photoPath: null, blocRecipeId: null, ingredients: muesli, steps: [
      step('Soak the oats in the milk overnight.', muesli[0], muesli[1]),
      step('Grate in the apple and drizzle with honey to serve.', muesli[2], muesli[3])] },
    { id: id(16), name: 'Chana masala', serves: 4, meal: 'dinner', cuisine: 'IN', photoPath: null, blocRecipeId: null, ingredients: chana, steps: [
      step('Fry the onion in the oil until soft and golden.', chana[1], chana[2]),
      step('Add the garlic, ginger and spices and cook for a minute until fragrant.', chana[3], chana[4], chana[5]),
      step('Tip in the tomatoes and chickpeas and simmer for 15 minutes.', chana[6], chana[0]),
      step('Season and scatter with coriander.', chana[8], chana[7])] },
    { id: id(17), name: 'Risotto alla milanese', serves: 4, meal: 'dinner', cuisine: 'IT', photoPath: null, blocRecipeId: null, ingredients: risotto, steps: [
      step('Toast the rice in half the butter, then add hot stock a ladle at a time.', risotto[0], risotto[1], risotto[3]),
      step('Stir in the saffron, then finish with the rest of the butter and the Parmesan.', risotto[2], risotto[4])] },
    { id: id(18), name: 'Salsa verde', serves: 6, meal: 'sauce', cuisine: 'IT', photoPath: null, blocRecipeId: null, ingredients: verde, steps: [
      step('Chop the parsley and capers finely.', verde[0], verde[1]),
      step('Stir in the oil and vinegar, and season.', verde[2], verde[3], verde[4])] },
  ];
  for (const r of recipes) r.cooking ??= [];
  return { recipes, products };
}
