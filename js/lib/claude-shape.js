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

// ── cup measures ────────────────────────────────────────────────────────────
// For ingredients Pinch has no density for: is it sensibly measured in cups,
// and how many grams fill one metric cup (250 ml)?
export const CUPS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          cup_measurable: { type: 'boolean' },
          grams_per_cup: { type: 'number' },
        },
        required: ['name', 'cup_measurable', 'grams_per_cup'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

// Claude's answer → { densities: [{ name, g_per_ml }], notCup: [name] }, for the
// names that were asked about only. Names are lower-cased and trimmed (the
// table's key). A density outside 0.03–2.5 g/ml (what pinch.densities
// accepts) is dropped rather than stored.
export function cupMeasuresFromClaude(out, asked) {
  const key = (s) => String(s ?? '').trim().toLowerCase();
  const wanted = new Set(asked.map(key));
  const densities = [];
  const notCup = [];
  for (const it of Array.isArray(out?.items) ? out.items : []) {
    const name = key(it?.name);
    if (!wanted.has(name)) continue;
    const g = Number(it.grams_per_cup);
    const perMl = Math.round((g / 250) * 1000) / 1000;
    if (it.cup_measurable === true && Number.isFinite(g) && perMl >= 0.03 && perMl <= 2.5 && name.length >= 2 && name.length <= 60) {
      densities.push({ name, g_per_ml: perMl });
    } else {
      notCup.push(name);
    }
  }
  return { densities, notCup };
}
