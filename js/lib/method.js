// The method: steps, and the ingredients each one is tagged with.
//
// Tags reference ingredients BY ID (step.ingredientIds), never by name or
// position, and a quantity is never copied onto a step: the italic line
// under a step is derived from the same scaling and formatting as the
// ingredient list, so the servings stepper applies to it too.

import { scaleRecipe } from './scale.js';
import { formatAmount } from './format.js';

// "Guanciale 225 g · Black pepper 1 tbsp", in ingredient-list order. An id
// that is no longer an ingredient is ignored. opts: { mode, cup, densityFor }.
export function stepLine(recipe, step, servings, opts = {}) {
  const scaled = scaleRecipe(recipe, servings);
  const tagged = new Set(step.ingredientIds);
  return scaled.ingredients
    .filter((i) => tagged.has(i.id))
    .map((i) => {
      const amount = formatAmount(i.qty, i.unit, { ...opts, density: opts.densityFor?.(i) ?? null });
      return amount ? `${i.name} ${amount}` : i.name;
    })
    .join(' · ');
}

// A new recipe without that ingredient, and without any tag naming it.
export function removeIngredient(recipe, ingredientId) {
  return {
    ...recipe,
    ingredients: recipe.ingredients.filter((i) => i.id !== ingredientId),
    steps: recipe.steps.map((s) => ({ ...s, ingredientIds: s.ingredientIds.filter((id) => id !== ingredientId) })),
  };
}

// A new recipe with the step moved up (-1) or down (+1). At either end it is
// returned unchanged (as a copy). Never mutates its input.
export function moveStep(recipe, stepId, direction) {
  const steps = [...recipe.steps];
  const from = steps.findIndex((s) => s.id === stepId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= steps.length) return { ...recipe, steps };
  [steps[from], steps[to]] = [steps[to], steps[from]];
  return { ...recipe, steps };
}

// A new recipe with the tag toggled on that step.
export function toggleTag(recipe, stepId, ingredientId) {
  return {
    ...recipe,
    steps: recipe.steps.map((s) => {
      if (s.id !== stepId) return s;
      const has = s.ingredientIds.includes(ingredientId);
      return { ...s, ingredientIds: has ? s.ingredientIds.filter((id) => id !== ingredientId) : [...s.ingredientIds, ingredientId] };
    }),
  };
}

// Ingredient ids whose name (or its main word) appears in the step text.
// Used to pre-tag the steps of an imported recipe; the cook checks them.
export function suggestTags(ingredients, text) {
  const t = ` ${String(text).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')} `;
  const STOP = new Set(['fresh', 'large', 'small', 'medium', 'chopped', 'sliced', 'ground', 'tin', 'tins', 'can', 'of', 'and', 'the', 'a', 'to', 'taste', 'finely', 'roughly', 'plain', 'whole', 'dried', 'tinned']);
  return ingredients
    .filter((i) => {
      const words = i.name.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
      return words.some((w) => t.includes(` ${w} `) || t.includes(` ${w}s `) || (w.endsWith('s') && t.includes(` ${w.slice(0, -1)} `)));
    })
    .map((i) => i.id);
}
