// Grams per millilitre for common ingredients, keyed by lower-case name.
// Used only for g/kg ↔ cup. 🚨 This is the same table as the pinch.densities
// seed in silver-octo-invention (20261019120000, 20261020120000, 20261020150000);
// behaviour-pinch.mjs fails if the two disagree, because the app's display and
// the SQL nutrition must convert a cup the same way. The app reads the live
// table on load (which also holds densities looked up with Claude) and uses
// this copy until then (and offline).

export const DENSITIES = {
  'almond butter': 1.08, 'almond flour': 0.4, 'almond milk': 1.02, 'almonds': 0.6, 'arborio rice': 0.84,
  'baked beans': 1, 'baking powder': 0.81, 'baking soda': 0.97, 'basil': 0.09, 'basmati rice': 0.79,
  'beef stock': 1, 'berries': 0.6, 'bicarbonate of soda': 0.97, 'black beans': 0.72, 'blueberries': 0.6,
  'bread flour': 0.55, 'breadcrumbs': 0.25, 'broccoli': 0.38, 'brown rice': 0.8, 'brown sugar': 0.83,
  'buckwheat flour': 0.51, 'bulgur wheat': 0.6, 'butter': 0.91, 'butter beans': 0.7, 'buttermilk': 1.03,
  'butternut squash': 0.59, 'cabbage': 0.37, 'cannellini beans': 0.7, 'carrot': 0.54, 'cashews': 0.57,
  'caster sugar': 0.84, 'cauliflower': 0.45, 'celery': 0.43, 'cheddar': 0.42, 'cheese': 0.42,
  'cherry tomatoes': 0.63, 'chia seeds': 0.68, 'chicken stock': 1, 'chickpea flour': 0.39, 'chickpeas': 0.68,
  'chocolate': 0.6, 'chocolate chips': 0.72, 'chopped onion': 0.68, 'chopped tomatoes': 1, 'cocoa': 0.42,
  'cocoa powder': 0.42, 'coconut cream': 1, 'coconut flour': 0.47, 'coconut milk': 0.97, 'coconut oil': 0.92,
  'coconut sugar': 0.68, 'cooked rice': 0.67, 'coriander': 0.07, 'cornflakes': 0.12, 'cornflour': 0.51,
  'cornmeal': 0.65, 'cottage cheese': 0.95, 'courgette': 0.52, 'couscous': 0.73, 'cream cheese': 0.98,
  'creme fraiche': 1, 'dark brown sugar': 0.85, 'dates': 0.63, 'demerara sugar': 0.9,
  'desiccated coconut': 0.34, 'double cream': 0.99, 'dried cranberries': 0.51, 'feta': 0.6,
  'flaked almonds': 0.38, 'flaxseed': 0.57, 'flour': 0.53, 'frozen peas': 0.6, 'ghee': 0.91,
  'golden syrup': 1.4, 'gram flour': 0.39, 'granola': 0.5, 'granulated sugar': 0.84, 'grapes': 0.64,
  'grated cheese': 0.42, 'greek yoghurt': 1.06, 'greek yogurt': 1.06, 'green lentils': 0.8,
  'ground almonds': 0.4, 'hazelnuts': 0.57, 'honey': 1.42, 'hummus': 1.03, 'icing sugar': 0.48, 'jam': 1.35,
  'jasmine rice': 0.79, 'kale': 0.28, 'ketchup': 1.15, 'kidney beans': 0.7, 'lemon juice': 1.03,
  'lentils': 0.81, 'lettuce': 0.2, 'lime juice': 1.03, 'linseed': 0.57, 'macaroni': 0.45, 'mango': 0.7,
  'maple syrup': 1.32, 'mascarpone': 1, 'mashed banana': 0.95, 'mayonnaise': 0.92, 'milk': 1.03,
  'mint': 0.07, 'mozzarella': 0.47, 'muesli': 0.45, 'muscovado sugar': 0.85, 'mushrooms': 0.3,
  'nutella': 1.2, 'oat milk': 1.03, 'oats': 0.36, 'oil': 0.92, 'olive oil': 0.91, 'orange juice': 1.04,
  'orzo': 0.75, 'panko': 0.21, 'parmesan': 0.42, 'parsley': 0.12, 'passata': 1.03, 'pasta': 0.42,
  'pasta sauce': 1.04, 'peanut butter': 1.08, 'peanuts': 0.6, 'pearl barley': 0.85, 'peas': 0.6,
  'pecans': 0.42, 'pecorino': 0.42, 'peppers': 0.6, 'pesto': 1, 'pine nuts': 0.57, 'pineapple': 0.7,
  'pistachios': 0.52, 'plain flour': 0.53, 'polenta': 0.68, 'potatoes': 0.63, 'protein powder': 0.4,
  'pumpkin seeds': 0.55, 'puy lentils': 0.8, 'quark': 1, 'quinoa': 0.72, 'raisins': 0.63,
  'rapeseed oil': 0.92, 'raspberries': 0.52, 'red lentils': 0.81, 'rice': 0.79, 'ricotta': 1.04,
  'risotto rice': 0.84, 'rocket': 0.08, 'rolled oats': 0.36, 'rye flour': 0.43, 'salt': 1.2,
  'self-raising flour': 0.53, 'semolina': 0.7, 'sesame oil': 0.92, 'sesame seeds': 0.6, 'single cream': 1,
  'skyr': 1.06, 'sour cream': 1, 'soy milk': 1.03, 'soy sauce': 1.15, 'spelt flour': 0.47, 'spinach': 0.13,
  'split peas': 0.85, 'stock': 1, 'strawberries': 0.61, 'sugar': 0.84, 'sultanas': 0.63,
  'sunflower oil': 0.92, 'sunflower seeds': 0.6, 'sweet potato': 0.56, 'sweetcorn': 0.7, 'tahini': 1.02,
  'tomato puree': 1.1, 'tomato sauce': 1.04, 'vegetable oil': 0.92, 'vegetable stock': 1, 'vinegar': 1.01,
  'walnuts': 0.42, 'water': 1, 'whey': 0.4, 'whey protein': 0.4, 'whipping cream': 0.99,
  'wholemeal flour': 0.51, 'wine': 0.99, 'yoghurt': 1.03, 'yogurt': 1.03,
};

const words = (s) => ` ${String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

// The longest table name found as whole words inside `name`, or null.
function bestWordMatch(name, table) {
  const hay = words(name);
  if (hay.trim() === '') return null;
  let best = null;
  for (const key of Object.keys(table)) {
    if (hay.includes(words(key)) && (!best || key.length > best.length || (key.length === best.length && key < best))) best = key;
  }
  return best;
}

// The density for an ingredient, exactly as pinch.ingredient_nutrition looks
// it up: the ingredient's whole name, then its product's whole name, then the
// longest table name found as whole words in the ingredient's name ("Flahavan's
// porridge oats" → oats; "coconut milk" beats "milk"), then in the product's.
// null when none: a cup is then never guessed.
export function densityFor(name, productName = null, table = DENSITIES) {
  const key = (s) => (s ? String(s).trim().toLowerCase() : '');
  if (key(name) in table) return table[key(name)];
  if (key(productName) in table) return table[key(productName)];
  const fromName = bestWordMatch(name, table);
  if (fromName) return table[fromName];
  const fromProduct = bestWordMatch(productName, table);
  return fromProduct ? table[fromProduct] : null;
}
