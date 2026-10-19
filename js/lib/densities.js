// Grams per millilitre for common ingredients, keyed by lower-case name.
// Used only for g/kg ↔ cup. 🚨 This is the same table as the pinch.densities
// seed in silver-octo-invention (20261019120000); behaviour-pinch.mjs fails
// if the two disagree, because the app's display and the SQL nutrition must
// convert a cup the same way. The app reads the live table on load and uses
// this copy until then (and offline).

export const DENSITIES = {
  'plain flour': 0.53, 'flour': 0.53, 'self-raising flour': 0.53,
  'bread flour': 0.55, 'wholemeal flour': 0.51, 'cornflour': 0.51,
  'caster sugar': 0.84, 'sugar': 0.84, 'granulated sugar': 0.84,
  'brown sugar': 0.83, 'icing sugar': 0.48, 'honey': 1.42,
  'golden syrup': 1.4, 'maple syrup': 1.32, 'butter': 0.91,
  'olive oil': 0.91, 'vegetable oil': 0.92, 'oil': 0.92,
  'milk': 1.03, 'water': 1, 'double cream': 0.99, 'yoghurt': 1.03,
  'greek yoghurt': 1.06, 'rice': 0.79, 'basmati rice': 0.79,
  'rolled oats': 0.36, 'oats': 0.36, 'cocoa powder': 0.42,
  'grated cheese': 0.42, 'parmesan': 0.42, 'frozen peas': 0.6,
  'red lentils': 0.81, 'lentils': 0.81, 'salt': 1.2,
  'ground almonds': 0.4, 'desiccated coconut': 0.34,
};

// The density for an ingredient name (then its product's name), exactly as
// the SQL looks it up: lower-cased, trimmed, whole-name match. null if none.
export function densityFor(name, productName = null, table = DENSITIES) {
  const key = (s) => (s ? String(s).trim().toLowerCase() : '');
  return table[key(name)] ?? table[key(productName)] ?? null;
}
