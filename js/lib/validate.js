// Every problem with a recipe at once, as [{ field, message }]. Empty means
// it can be saved. Mirrors the constraints in pinch (20261019120000), so a
// save is never refused by the database for a reason the form could have
// said first.

import { UNITS } from './units.js';
import { MEALS, displayName } from './recipes.js';
import { cookingProblems } from './cooking.js';

export function validateRecipe(recipe) {
  const problems = [];
  const add = (field, message) => problems.push({ field, message });

  if (!recipe.name || !displayName(recipe.name).trim()) add('name', 'Give the recipe a name.');
  if (!Number.isInteger(recipe.serves) || recipe.serves < 1 || recipe.serves > 100) {
    add('serves', 'Serves must be a whole number from 1 to 100.');
  }
  if (!MEALS.includes(recipe.meal)) add('meal', 'Choose Breakfast, Lunch, Dinner or Sauces.');
  if (recipe.cuisine != null && !/^[A-Z]{2}$/.test(recipe.cuisine)) add('cuisine', 'Choose a cuisine from the list.');

  const ids = new Set();
  recipe.ingredients.forEach((i, n) => {
    const where = `ingredients.${n}`;
    if (!i.name || !i.name.trim()) add(where, `Ingredient ${n + 1} needs a name.`);
    if (!UNITS.includes(i.unit)) add(where, `${i.name || `Ingredient ${n + 1}`} has an unknown unit.`);
    if (i.qty !== null && !(typeof i.qty === 'number' && Number.isFinite(i.qty) && i.qty > 0)) {
      add(where, `${i.name || `Ingredient ${n + 1}`}: the amount must be a number above 0, or empty.`);
    }
    ids.add(i.id);
  });

  recipe.steps.forEach((s, n) => {
    if (s.ingredientIds.some((id) => !ids.has(id))) {
      add(`steps.${n}`, `Step ${n + 1} is tagged with an ingredient that isn't in this recipe.`);
    }
  });

  (recipe.cooking ?? []).forEach((c, n) => cookingProblems(c).forEach((m) => add(`cooking.${n}`, m)));
  return problems;
}
