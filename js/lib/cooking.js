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
  'cumin', 'coriander seeds', 'ground coriander', 'ground corriander', 'turmeric', 'garam masala', 'curry powder', 'cinnamon', 'nutmeg',
  'cloves', 'cardamom', 'cardamon', 'allspice', 'ginger powder', 'ground ginger', 'garlic powder', 'garlic salt', 'onion powder',
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

// ── Cooking options read from a method ────────────────────────────────────
// suggestCooking(stepTexts) → [{ method, minutes, tempC, note }], at most one
// per method, for an import to start with (the cook can edit or delete them).
//
// · A step names a method (air fryer, slow cooker, microwave, BBQ /
//   barbecue / rotisserie, fan oven or "°C fan", oven / bake / roast,
//   grill). Hob work is not an option: frying and simmering are the method
//   itself, not a way to cook the finished dish.
// · A time or a temperature belongs to the method named in its own step, or
//   else the last one named before it ("Light the BBQ." … "Cook for 40
//   minutes."). A step about the fridge, marinating, resting, chilling or
//   soaking never gives a time ("marinate for 24 hours").
// · 🚨 An INTERNAL temperature ("until the internal temperature is 75°C",
//   "a probe reads 75°C") is how hot the food must get, not the heat to cook
//   at: it becomes the note "Until 75°C inside", never temp_c.
// · An oven step with two temperatures, "200°C (180°C fan)" or "200C/180C
//   fan", gives an Oven option and a Fan oven option; a time in an oven step
//   goes to both.
const STEP_METHODS = [
  ['air_fryer', /\bair[\s-]?fr(?:y|ier|yer|ying)\b/],
  ['slow_cooker', /\bslow[\s-]?cooker\b/],
  ['microwave', /\bmicrowave\b/],
  ['bbq', /\b(?:bbq|barbecue|barbeque|rotisserie)\b/],
  ['fan_oven', /\bfan(?:[\s-]assisted)?\s+oven\b/],
  ['oven', /\boven\b|\bbake\b|\broast\b/],
  ['grill', /\bgrill\b(?!\s+(?:plate|pan))/],
];
const NOT_COOKING = /\b(?:fridge|refrigerat\w*|marinat\w*|rest(?:ing)?|chill\w*|soak\w*|overnight|freez\w*)\b/;
const TEMP = /(\d{2,3})\s*(?:°|º|degrees?)\s*(c|celsius|centigrade|f|fahrenheit)?\b|(\d{2,3})\s*(c|f)\b/g;
const INTERNAL = /\b(?:internal|core|inside|probe|thermometer|reaches?)\b[^.]{0,40}$/;
const DURATION = /(\d+(?:[.,]\d+)?)\s*(?:(?:-|–|to)\s*\d+(?:[.,]\d+)?\s*)?(hours?|hrs?|h|minutes?|mins?|m)\b(?:\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?|m)\b)?/;

function methodIn(text) {
  return STEP_METHODS.find(([, re]) => re.test(text))?.[0] ?? null;
}

function minutesIn(text) {
  const m = text.match(DURATION);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  const mins = /^h/.test(m[2]) ? n * 60 + Number(m[3] ?? 0) : n;
  const whole = Math.round(mins);
  return whole >= 1 && whole <= MINUTES_MAX ? whole : null;
}

// The first cooking temperature in °C, the first one marked "fan", and an
// internal one if stated.
function tempsIn(text) {
  let cook = null;
  let fan = null;
  let inside = null;
  for (const m of text.matchAll(TEMP)) {
    const n = Number(m[1] ?? m[3]);
    const scale = (m[2] ?? m[4] ?? 'c')[0];
    const c = Math.round(scale === 'f' ? fToC(n) : n);
    if (INTERNAL.test(text.slice(0, m.index))) { inside ??= c; continue; }
    if (c < TEMP_MIN_C || c > TEMP_MAX_C) continue;
    if (/^\s*\)?\s*fan\b/.test(text.slice(m.index + m[0].length))) fan ??= c;
    else cook ??= c;
  }
  return { cook, fan, inside };
}
const OVENS = ['oven', 'fan_oven'];

export function suggestCooking(stepTexts) {
  const found = new Map();
  let current = null;
  const get = (method) => {
    if (!found.has(method)) found.set(method, { method, minutes: null, tempC: null, note: null });
    return found.get(method);
  };
  for (const raw of stepTexts ?? []) {
    const text = String(raw).toLowerCase();
    current = methodIn(text) ?? current;
    if (!current) continue;
    const { cook, fan, inside } = tempsIn(text);
    const option = get(current);
    if (OVENS.includes(current)) {
      if (cook != null) get(current === 'fan_oven' && fan == null ? 'fan_oven' : 'oven').tempC ??= cook;
      if (fan != null) get('fan_oven').tempC ??= fan;
    } else {
      option.tempC ??= cook;
    }
    if (inside != null && option.note == null) option.note = `Until ${inside}°C inside`;
    const minutes = NOT_COOKING.test(text) ? null : minutesIn(text);
    if (minutes != null) {
      for (const o of OVENS.includes(current) ? OVENS.filter((k) => found.has(k)).map(get) : [option]) o.minutes ??= minutes;
    }
  }
  // A method only mentioned in passing (no time, temperature or note) is noise.
  return [...found.values()].filter((o) => o.minutes != null || o.tempC != null || o.note != null);
}
