// The two JSON shapes Pinch asks Claude for, and how each answer becomes
// Pinch's own shapes. Pure, so a malformed answer is tested, not discovered.

import { UNITS } from './units.js';

export const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    name: { type: 'string' },
    servings: { type: 'integer' },
    ingredients: { type: 'array', items: { type: 'string' } },
    steps: { type: 'array', items: { type: 'string' } },
    cuisine: { type: 'string' },
    meal: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'unknown'] },
  },
  required: ['found', 'name', 'servings', 'ingredients', 'steps', 'cuisine', 'meal'],
  additionalProperties: false,
};

export const LINES_SCHEMA = {
  type: 'object',
  properties: {
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          line: { type: 'string' },
          qty: { type: 'number' },
          unit: { type: 'string', enum: UNITS },
          name: { type: 'string' },
        },
        required: ['line', 'qty', 'unit', 'name'],
        additionalProperties: false,
      },
    },
  },
  required: ['ingredients'],
  additionalProperties: false,
};

// Claude's recipe → the import shape draftFromImport takes (the same shape
// as a page's schema.org Recipe), or null when it found no recipe.
export function recipeFromClaude(out) {
  if (!out || out.found !== true || !Array.isArray(out.ingredients) || !out.ingredients.length) return null;
  const strings = (a) => (Array.isArray(a) ? a.map((x) => String(x).trim()).filter(Boolean) : []);
  return {
    name: String(out.name ?? '').trim(),
    recipeYield: Number.isInteger(out.servings) && out.servings > 0 ? String(out.servings) : null,
    recipeIngredient: strings(out.ingredients),
    recipeInstructions: strings(out.steps),
    recipeCuisine: /^[A-Za-z]{2}$/.test(out.cuisine ?? '') ? out.cuisine.toUpperCase() : null,
    recipeCategory: ['breakfast', 'lunch', 'dinner'].includes(out.meal) ? out.meal : null,
  };
}

// Claude's split lines → [{ line, qty, unit, name }], keeping only items
// for lines that were asked about. qty 0 means none; an unknown unit is
// "each" and an empty name falls back to the line.
export function linesFromClaude(out, asked) {
  const wanted = new Set(asked);
  return (Array.isArray(out?.ingredients) ? out.ingredients : [])
    .filter((i) => i && wanted.has(i.line))
    .map((i) => {
      const qty = Number(i.qty) > 0 ? Number(i.qty) : null;
      const unit = qty == null ? 'to taste' : UNITS.includes(i.unit) && i.unit !== 'to taste' ? i.unit : 'each';
      return { line: i.line, qty, unit, name: String(i.name ?? '').trim() || i.line };
    });
}
