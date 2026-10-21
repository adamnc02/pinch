// Cooking options and seasonings: pure helpers, tested in cooking.test.js.
//
// · A cooking option is one way to cook a recipe, shown after the method:
//   { id, method, name, minutes, tempC, note }. `name` is only for 'other'.
//   Temperatures are STORED in °C (pinch.cooking_methods.temp_c, a whole
//   number 20–300); °F is display only, the person's Temperatures setting.
// · A seasoning (spice, herb, salt…) is never counted for nutrition and
//   never asks for a barcode. looksLikeSeasoning() only SUGGESTS the flag for
//   a new ingredient; nothing sets it on a saved one.

export const COOKING_METHODS = [
  ['air_fryer', 'Air fryer'],
  ['oven', 'Oven'],
  ['fan_oven', 'Fan oven'],
  ['hob', 'Hob'],
  ['grill', 'Grill'],
  ['microwave', 'Microwave'],
  ['bbq', 'BBQ'],
  ['slow_cooker', 'Slow cooker'],
  ['other', 'Other'],
];
const METHOD_KEYS = COOKING_METHODS.map(([k]) => k);
export const methodLabel = (option) =>
  option.method === 'other' ? String(option.name ?? '').trim() || 'Other' : (COOKING_METHODS.find(([k]) => k === option.method)?.[1] ?? option.method);

export const TEMP_MIN_C = 20;
export const TEMP_MAX_C = 300;
export const MINUTES_MAX = 1440;
export const NOTE_MAX = 200;

export const cToF = (c) => (c * 9) / 5 + 32;
export const fToC = (f) => ((f - 32) * 5) / 9;

// The stored °C as the person reads it: °C exactly, °F to the nearest 5
// (oven dials go in fives, and 180 °C is "350 °F", not "356 °F").
export function formatTemp(tempC, unit = 'c') {
  if (tempC == null) return '';
  return unit === 'f' ? `${Math.round(cToF(tempC) / 5) * 5}°F` : `${Math.round(tempC)}°C`;
}

// What the person typed, in their unit → the whole °C stored. null for empty.
export function tempInputToC(text, unit = 'c') {
  const s = String(text ?? '').trim();
  if (s === '') return null;
  const n = Number(s.replace(',', '.'));
  if (!Number.isFinite(n)) return NaN;
  return Math.round(unit === 'f' ? fToC(n) : n);
}

// The stored °C as the number to put back in the input, in the person's unit.
export const tempForInput = (tempC, unit = 'c') =>
  tempC == null ? '' : String(unit === 'f' ? Math.round(cToF(tempC) / 5) * 5 : tempC);

// 12 → "12 min", 90 → "1 h 30 min", 360 → "6 h".
export function formatMinutes(minutes) {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// One option as a line: "Air fryer · 12 min · 200°C".
export function cookingLine(option, unit = 'c') {
  return [methodLabel(option), formatMinutes(option.minutes), formatTemp(option.tempC, unit)].filter(Boolean).join(' · ');
}

// Every problem with one option, as messages (empty means it can be saved).
// Mirrors the pinch.cooking_methods checks.
export function cookingProblems(option) {
  const out = [];
  const label = methodLabel(option);
  if (!METHOD_KEYS.includes(option.method)) out.push('Choose how it is cooked.');
  if (option.method === 'other' && !String(option.name ?? '').trim()) out.push('Name the “Other” cooking method.');
  if (option.minutes != null && !(Number.isInteger(option.minutes) && option.minutes >= 1 && option.minutes <= MINUTES_MAX)) {
    out.push(`${label}: the time must be whole minutes, 1 to ${MINUTES_MAX}.`);
  }
  if (option.tempC != null && !(Number.isInteger(option.tempC) && option.tempC >= TEMP_MIN_C && option.tempC <= TEMP_MAX_C)) {
    out.push(`${label}: the temperature must be ${TEMP_MIN_C} to ${TEMP_MAX_C}°C (${Math.round(cToF(TEMP_MIN_C))} to ${Math.round(cToF(TEMP_MAX_C))}°F).`);
  }
  if (option.note != null && String(option.note).length > NOTE_MAX) out.push(`${label}: the note is over ${NOTE_MAX} characters.`);
  return out;
}

// Names that are almost always a seasoning, matched as whole words.
const SEASONINGS = [
  'salt', 'pepper', 'peppercorns', 'paprika', 'cayenne', 'chilli powder', 'chili powder', 'chilli flakes', 'chili flakes',
  'cumin', 'coriander seeds', 'ground coriander', 'turmeric', 'garam masala', 'curry powder', 'cinnamon', 'nutmeg',
  'cloves', 'cardamom', 'allspice', 'ginger powder', 'ground ginger', 'garlic powder', 'garlic salt', 'onion powder',
  'oregano', 'thyme', 'rosemary', 'sage', 'bay leaf', 'bay leaves', 'dried basil', 'dried parsley', 'mixed herbs',
  'italian seasoning', 'herbes de provence', 'five spice', 'chinese five spice', 'smoked paprika', 'fennel seeds',
  'mustard seeds', 'saffron', 'sumac', 'zaatar', 'za atar', 'star anise', 'celery salt', 'seasoning', 'spice', 'spices',
];
const words = (s) => ` ${String(s ?? '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()} `;
// "Bell pepper" and "pepper sauce" are food, not seasoning.
const NOT_SEASONING = /\b(bell|sweet|red|green|yellow|stuffed|romano) peppers?\b|\bpeppers\b|\bsauce\b|\bpaste\b/;

export function looksLikeSeasoning(name) {
  const w = words(name);
  if (w.trim() === '' || NOT_SEASONING.test(w)) return false;
  return SEASONINGS.some((s) => w.includes(` ${s} `));
}
