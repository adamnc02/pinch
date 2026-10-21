// Turning other people's recipes into Pinch's shape. Pure and heavily
// tested: like a dbt staging model for messy sources.
//
// parseIngredientLine("2 x 400g tins chickpeas, drained") → { qty, unit, name, ok }
// splitRecipeText(pastedText) → { name, serves, ingredients[], steps[] }
// draftFromImport(jsonLdShape, defaults) → { recipe, unparsed[] }
// titleCase("chicken thigh") → "Chicken Thigh" (imported names only)

import { cuisineFromText } from './cuisines.js';
import { suggestTags } from './method.js';
import { suggestCooking } from './cooking.js';

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅕': 0.2 };
const FRAC = Object.keys(FRACTIONS).join('');

// alias → [unit, multiplier]. Imperial weights and volumes become g and ml.
const UNIT_ALIASES = [
  [['g', 'gr', 'grm', 'gram', 'grams', 'gramme', 'grammes'], 'g', 1],
  [['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'], 'kg', 1],
  [['ml', 'mls', 'millilitre', 'millilitres', 'milliliter', 'milliliters'], 'ml', 1],
  [['cl', 'centilitre', 'centilitres'], 'ml', 10],
  [['l', 'ltr', 'litre', 'litres', 'liter', 'liters'], 'l', 1],
  [['tsp', 'tsps', 'teaspoon', 'teaspoons', 'tspn'], 'tsp', 1],
  [['tbsp', 'tbsps', 'tbs', 'tbl', 'tablespoon', 'tablespoons', 'tbspn'], 'tbsp', 1],
  [['cup', 'cups', 'c'], 'cup', 1],
  [['oz', 'ounce', 'ounces'], 'g', 28.35],
  [['lb', 'lbs', 'pound', 'pounds'], 'g', 453.6],
  [['fl oz', 'fl. oz', 'fluid ounce', 'fluid ounces'], 'ml', 29.57],
  [['pint', 'pints', 'pt'], 'ml', 568],
];
const ALIASES = UNIT_ALIASES.flatMap(([words, unit, mult]) => words.map((w) => [w, unit, mult]))
  .sort((a, b) => b[0].length - a[0].length);

// Lines with no amount that are still clearly seasoning.
const SEASONING = /\b(salt|pepper|seasoning)\b/i;
const TO_TASTE = /\b(to taste|to serve|for serving|for garnish|to garnish|as needed|as required|optional|a pinch|pinch of|a handful|handful of|a drizzle|a splash|splash of|drizzle of|a little|some)\b/i;

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// A list marker at the start of a line: "- [ ] ", "* [x] ", "☐ ", "• ", "- ".
// Notes apps export checklists this way; the marker is never part of the text.
const LIST_MARKER = /^\s*(?:[-*+•▢□◦·–]\s*)?(?:\[[ xX✓✔]?\]|[☐☑☒✓✔])?\s*/;
export const stripListMarker = (s) => String(s ?? '').replace(LIST_MARKER, '');
const hasListMarker = (s) => /^\s*(?:[-*+•▢□◦·–]\s|\[[ xX✓✔]?\]|[☐☑☒✓✔])/.test(String(s ?? ''));

// Every all-lower-case word capitalised, small joining words left alone
// (except first). A word with any capital ("McVitie's", "BBQ") is kept as
// written, and hyphenated parts are capitalised each ("Self-Raising").
const SMALL_WORDS = new Set(['a', 'an', 'and', 'or', 'of', 'in', 'on', 'with', 'the', 'to', 'for', 'at', 'from', 'into', 'de', 'la', 'del', 'di']);
export function titleCase(text) {
  return String(text ?? '').split(/(\s+)/).map((w, n) => {
    if (/^\s+$/.test(w)) return w;
    if (n > 0 && SMALL_WORDS.has(w.replace(/[^a-z]/g, ''))) return w;
    return w.split('-').map((part) => (/[A-Z]/.test(part) ? part
      : part.replace(/^([^a-z]*)([a-z])/, (m, lead, c) => lead + c.toUpperCase()))).join('-');
  }).join('');
}
const round = (v) => Math.round(v * 1000) / 1000;

// One number from the front of s: 1, 1.5, 1,5, 1/2, 1 1/2, 1½, ½.
function readNumber(s) {
  let m;
  if ((m = s.match(new RegExp(`^(\\d+)\\s*([${FRAC}])`)))) return { value: Number(m[1]) + FRACTIONS[m[2]], rest: s.slice(m[0].length) };
  if ((m = s.match(new RegExp(`^([${FRAC}])`)))) return { value: FRACTIONS[m[1]], rest: s.slice(m[0].length) };
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)/)) && Number(m[3]) > 0) return { value: Number(m[1]) + Number(m[2]) / Number(m[3]), rest: s.slice(m[0].length) };
  if ((m = s.match(/^(\d+)\/(\d+)/)) && Number(m[2]) > 0) return { value: Number(m[1]) / Number(m[2]), rest: s.slice(m[0].length) };
  if ((m = s.match(/^(\d+(?:[.,]\d+)?)/))) return { value: Number(m[1].replace(',', '.')), rest: s.slice(m[0].length) };
  return null;
}

function readUnit(s) {
  const lower = s.toLowerCase();
  for (const [alias, unit, mult] of ALIASES) {
    if (lower.startsWith(alias)) {
      const next = lower[alias.length];
      // A unit must end at a word boundary: "g" in "garlic" is not grams.
      if (next === undefined || /[\s.,;:()/-]/.test(next)) {
        return { unit, mult, rest: s.slice(alias.length).replace(/^\./, '') };
      }
    }
  }
  return null;
}

function cleanName(s) {
  return s
    .replace(/^\s*\([^)]*\)\s*/, '')     // "(7oz)" straight after the unit
    .replace(/^\s*\/\s*[\d.,½¼¾]+\s*[a-z]+(?:\s+[\d.,½¼¾]+\s*[a-z]+)?\b\s*/i, '') // "/1lb 12oz" after "800g"
    .replace(/^\s*of\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:-]+|[\s,;:.]+$/g, '')
    .trim();
}

export function parseIngredientLine(text) {
  const line = String(text ?? '').replace(/\s+/g, ' ').trim();
  const s0 = stripListMarker(line).trim();
  const fail = { qty: null, unit: 'to taste', name: cap(cleanName(s0)) || s0, ok: false, line };
  if (!s0) return { ...fail, name: '' };

  let s = s0.replace(/^(a|an)\s+(?=[a-z])/i, (m, a) => (TO_TASTE.test(s0) ? m : '1 '));
  const first = readNumber(s);
  if (!first) {
    const words = s0.split(/\s+/).length;
    if (TO_TASTE.test(s0) || SEASONING.test(s0) || words <= 4) {
      const name = cleanName(s0.replace(TO_TASTE, '').replace(/,\s*$/, '')) || cleanName(s0);
      return { qty: null, unit: 'to taste', name: cap(name), ok: true, line };
    }
    return fail;
  }

  let qty = first.value;
  s = first.rest;
  // A range ("2-3", "2 to 3") keeps its first value.
  const range = s.match(/^\s*(?:-|–|to)\s*/);
  if (range) {
    const second = readNumber(s.slice(range[0].length));
    if (second) s = second.rest;
  }

  // "2 x 400g tins chickpeas" is 2 of something, the 400 g describing each.
  const times = s.match(/^\s*[x×]\s*/i);
  if (times) {
    const inner = readNumber(s.slice(times[0].length));
    if (inner) {
      const innerUnit = readUnit(inner.rest.trimStart());
      const restAfter = innerUnit ? innerUnit.rest : inner.rest;
      const itemGrams = innerUnit?.unit === 'g' ? round(inner.value * innerUnit.mult)
        : innerUnit?.unit === 'kg' ? round(inner.value * 1000) : null;
      return { qty: round(qty), unit: 'each', name: cap(cleanName(restAfter)), ok: true, line, itemGrams };
    }
  }

  // A length ("5cm piece of ginger") is a description, not an amount.
  if (/^\s*(cm|mm|in|inch|inches)\b/i.test(s)) {
    return { qty: 1, unit: 'each', name: cap(cleanName(s0)), ok: true, line };
  }

  const unit = readUnit(s.trimStart());
  if (unit) {
    const name = cleanName(unit.rest);
    if (!name) return fail;
    return { qty: round(qty * unit.mult), unit: unit.unit, name: cap(name), ok: qty > 0, line };
  }
  const name = cleanName(s);
  if (!name) return fail;
  return { qty: round(qty), unit: 'each', name: cap(name), ok: qty > 0, line };
}

// ── whole recipes ──────────────────────────────────────────────────────────

const ING_HEAD = /^(ingredients?|you will need|you'll need|what you need)\s*:?$/i;
const METHOD_HEAD = /^(method|instructions?|directions?|steps?|preparation|how to make( it)?|to make)\s*:?$/i;
const SERVES = /\b(?:serves|servings?|portions?|makes|yield)\s*:?\s*(\d+)|\b(\d+)\s*(?:servings|portions|people)\b/i;

export function servesFrom(value) {
  const v = Array.isArray(value) ? value.join(' ') : String(value ?? '');
  const m = v.match(SERVES) ?? v.match(/(\d+)/);
  const n = m ? Number(m[1] ?? m[2]) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : null;
}

export function mealFrom(category) {
  const c = String(category ?? '').toLowerCase();
  if (/breakfast|brunch|porridge/.test(c)) return 'breakfast';
  if (/sauce|dressing|condiment|marinade|\bdips?\b|gravy|salsa|pesto/.test(c)) return 'sauce';
  if (/dinner|main|supper/.test(c)) return 'dinner';
  if (/lunch|light|salad|sandwich|soup|snack/.test(c)) return 'lunch';
  return null;
}

const STEP_NUMBER = /^\s*(?:step\s*)?\d+\s*[.):-]?\s+/i;
const stripStepNumber = (s) => s.replace(STEP_NUMBER, '').trim();
// "1. Add …" / "Step 2 …", but not an amount: "1 tsp salt" is an ingredient.
const isNumberedStep = (l) => /^\s*(?:step\s*\d+|\d+\s*[.)])\s+/i.test(l);

// A method written as numbered steps, wrapped across lines (a phone note):
// every line that doesn't start a new number continues the step above it.
// Without numbers each line is its own step.
function joinWrapped(lines) {
  if (!lines.some(isNumberedStep)) return lines.map(stripStepNumber).filter(Boolean);
  const steps = [];
  for (const l of lines) {
    if (isNumberedStep(l) || !steps.length) steps.push(stripStepNumber(l));
    else steps[steps.length - 1] = `${steps[steps.length - 1]} ${l.trim()}`;
  }
  return steps.filter(Boolean);
}

// Pasted text → { name, serves, ingredients: [line], steps: [line] }.
// List markers ("- [ ] ") are taken off every ingredient line.
export function splitRecipeText(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const serves = servesFrom(lines.find((l) => SERVES.test(l)) ?? '');
  const ingAt = lines.findIndex((l) => ING_HEAD.test(l));
  const methodAt = lines.findIndex((l) => METHOD_HEAD.test(l));
  const isMeta = (l) => SERVES.test(l) && l.length < 40;
  const clean = (l) => stripListMarker(l).trim();

  if (ingAt >= 0) {
    const name = lines.slice(0, ingAt).find((l) => !isMeta(l)) ?? '';
    const end = methodAt > ingAt ? methodAt : lines.length;
    const ingredients = lines.slice(ingAt + 1, end).filter((l) => !isMeta(l)).map(clean).filter(Boolean);
    const steps = methodAt > ingAt ? joinWrapped(lines.slice(methodAt + 1)) : [];
    return { name: clean(name), serves, ingredients, steps };
  }

  // No headings. A note with a list (markers) and numbered steps: list lines
  // are ingredients, the numbered lines and their wrapped continuations are
  // the method, and a title only exists if the first line is neither.
  if (lines.some(hasListMarker) && lines.some(isNumberedStep)) {
    const firstStep = lines.findIndex(isNumberedStep);
    const head = lines.slice(0, firstStep).filter((l) => !isMeta(l));
    const name = head.length && !hasListMarker(head[0]) && !parseIngredientLine(head[0]).qty ? head.shift() : '';
    return { name, serves, ingredients: head.map(clean).filter(Boolean), steps: joinWrapped(lines.slice(firstStep)) };
  }

  // Otherwise: short lines that start with an amount are ingredients,
  // longer sentences are steps, and the first line is the name.
  const [first, ...rest] = lines;
  const ingredients = [];
  const steps = [];
  for (const l of rest) {
    if (isMeta(l)) continue;
    const p = parseIngredientLine(l);
    if (p.ok && p.qty != null && l.length <= 70) ingredients.push(clean(l));
    else if (l.length > 40 || /^\s*(?:step\s*)?\d+[.)]/i.test(l)) steps.push(stripStepNumber(l));
    else ingredients.push(clean(l));
  }
  return { name: first ?? '', serves, ingredients, steps };
}

// An imported recipe ({ name, recipeYield, recipeIngredient[], recipeInstructions[],
// recipeCuisine, recipeCategory } — the pinch-import function's shape, also
// what splitRecipeText gives once renamed) → a draft recipe, every
// ingredient and step with a fresh id, steps pre-tagged by name, and the
// recipe and ingredient names in title case, and cooking options read from
// the method (suggestCooking) for the cook to check.
// `unparsed` lists the ingredient ids whose line the parser couldn't read.
export function draftFromImport(src, { serves = null, meal = null, newId = () => crypto.randomUUID() } = {}) {
  const parsed = (src.recipeIngredient ?? []).map((line) => ({ id: newId(), ...parseIngredientLine(line) }));
  const ingredients = parsed.filter((p) => p.name).map((p) => ({
    id: p.id, name: titleCase(p.name), qty: p.qty, unit: p.unit, productId: null, sourceLine: p.line, itemGrams: p.itemGrams ?? null,
  }));
  const steps = (src.recipeInstructions ?? []).map(String).map((t) => t.trim()).filter(Boolean)
    .map((text) => ({ id: newId(), text, ingredientIds: suggestTags(ingredients, text) }));
  return {
    recipe: {
      id: newId(),
      name: titleCase(stripListMarker(src.name).trim()),
      serves: serves ?? servesFrom(src.recipeYield) ?? 4,
      meal: meal ?? mealFrom(src.recipeCategory) ?? 'dinner',
      cuisine: cuisineFromText(src.recipeCuisine),
      photoPath: null,
      blocRecipeId: null,
      ingredients,
      steps,
      cooking: suggestCooking(steps.map((s) => s.text)).map((c) => ({ id: newId(), name: null, ...c })),
    },
    unparsed: parsed.filter((p) => !p.ok && p.name).map((p) => p.id),
  };
}

export const looksLikeUrl = (text) => /^\s*https?:\/\/\S+\s*$/i.test(String(text ?? ''));
export function hostOf(text) {
  try { return new URL(String(text).trim()).hostname.replace(/^www\./, ''); } catch { return null; }
}
