// Pure functions over the list of recipes, for Home.

// The unique cuisine codes used by these recipes, in the order each code
// first appears (like SELECT DISTINCT ordered by first row). Home's
// "By cuisine" chips are built from this, so a chip only exists for a
// cuisine in use. Recipes with no cuisine add nothing.
export function cuisinesInUse(recipes) {
  const seen = [];
  for (const r of recipes) {
    if (r.cuisine && !seen.includes(r.cuisine)) seen.push(r.cuisine);
  }
  return seen;
}

// Home's grid. mode is 'meal' or 'cuisine'; value is null for All, else a
// meal ('breakfast' | 'lunch' | 'dinner' | 'sauce') or a cuisine code. Order is kept.
export function filterRecipes(recipes, { mode, value }) {
  if (value == null) return [...recipes];
  if (mode === 'meal') return recipes.filter((r) => r.meal === value);
  if (mode === 'cuisine') return recipes.filter((r) => r.cuisine === value);
  return [...recipes];
}

// BLOC names recipes "(Dinner) Carbonara"; a recipe imported from BLOC keeps
// that name. Pinch has the meal as its own field, so it shows the name
// without the bracketed meal, and the editor keeps the stored prefix
// silently. BLOC adds "(Meal) " from the meal field to any name without one.
export const MEAL_PREFIX = /^\((breakfast|lunch|dinner|snacks?)\)\s*/i;

// "(Dinner) Carbonara" → { prefix: '(Dinner) ', title: 'Carbonara' }.
export function splitMealPrefix(name) {
  const s = String(name ?? '');
  const m = s.match(MEAL_PREFIX);
  return m ? { prefix: m[0], title: s.slice(m[0].length) } : { prefix: '', title: s };
}

// The name as Pinch shows it.
export const displayName = (name) => splitMealPrefix(name).title;

// The meal a "(Dinner) …" name states, or null. Used to pre-fill the meal of
// a recipe brought across from BLOC.
export function mealFromPrefix(name) {
  const m = String(name ?? '').match(MEAL_PREFIX);
  if (!m) return null;
  const meal = m[1].toLowerCase();
  return MEALS.includes(meal) ? meal : null;
}

// Alphabetical by the shown name, ignoring case, accents and any "(Meal) ".
export function sortRecipes(recipes) {
  return [...recipes].sort((a, b) => displayName(a.name).localeCompare(displayName(b.name), 'en', { sensitivity: 'base' }));
}

// Home's chips and the editor's meal buttons, in this order. A sauce is
// filed under "Sauces"; BLOC, which builds "(Meal) " from the stored value,
// shows it as "(Sauce) …".
export const MEALS = ['breakfast', 'lunch', 'dinner', 'sauce'];
const MEAL_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', sauce: 'Sauces' };
export const mealLabel = (meal) => (meal ? MEAL_LABELS[meal] ?? meal[0].toUpperCase() + meal.slice(1) : '');
