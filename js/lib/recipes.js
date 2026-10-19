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
// meal ('breakfast' | 'lunch' | 'dinner') or a cuisine code. Order is kept.
export function filterRecipes(recipes, { mode, value }) {
  if (value == null) return [...recipes];
  if (mode === 'meal') return recipes.filter((r) => r.meal === value);
  if (mode === 'cuisine') return recipes.filter((r) => r.cuisine === value);
  return [...recipes];
}

// Alphabetical by name, ignoring case and accents. Home's grid order.
export function sortRecipes(recipes) {
  return [...recipes].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export const MEALS = ['breakfast', 'lunch', 'dinner'];
export const mealLabel = (meal) => (meal ? meal[0].toUpperCase() + meal.slice(1) : '');
