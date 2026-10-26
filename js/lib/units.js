// Unit conversion under the cups-only rule.
//
// · Volume units (tsp, tbsp, ml, l, cup) convert by fixed arithmetic.
// · g/kg ↔ cup needs the ingredient's density (g per ml).
// · g ↔ ml is never offered: asking for it returns an error, not a guess.
//
// A STORED "cup" is a metric cup, 250 ml. `cup` in the options is the cup to
// convert INTO (Settings › Cup size): 'metric' (250 ml) or 'us' (236.6 ml).

export const UNITS = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'each', 'to taste'];
export const STORED_CUP_ML = 250;
export const CUP_ML = { metric: 250, us: 236.6 };

const ML = { ml: 1, l: 1000, tsp: 5, tbsp: 15 };
const G = { g: 1, kg: 1000 };
const SPOONS = ['tsp', 'tbsp'];
const TBSP_PER = { tsp: 1 / 3, tbsp: 1, cup: STORED_CUP_ML / 15 };

export const isVolume = (u) => u in ML || u === 'cup';
export const isWeight = (u) => u in G;

// convert(qty, from, to, { density, cup }) → { qty } or { error }
export function convert(qty, from, to, { density = null, cup = 'metric' } = {}) {
  if (qty == null || !Number.isFinite(qty)) return { error: 'No amount to convert.' };
  if (from === to && from !== 'cup') return { qty };
  const cupMl = CUP_ML[cup] ?? CUP_ML.metric;

  // Everything goes through ml (volume) or g (weight).
  const toMl = (q, u) => (u === 'cup' ? q * STORED_CUP_ML : q * ML[u]);
  const fromMl = (ml, u) => (u === 'cup' ? ml / cupMl : ml / ML[u]);

  if (isVolume(from) && isVolume(to)) return { qty: fromMl(toMl(qty, from), to) };
  if (isWeight(from) && isWeight(to)) return { qty: (qty * G[from]) / G[to] };

  const cupInvolved = from === 'cup' || to === 'cup';
  if (!cupInvolved) {
    if ((isWeight(from) && isVolume(to)) || (isVolume(from) && isWeight(to))) {
      return { error: 'Grams and millilitres are never converted. Only cups convert to grams.' };
    }
    return { error: `Can't convert ${from} to ${to}.` };
  }
  if (!(density > 0)) return { error: 'Needs this ingredient’s density, which isn’t known.' };

  if (isWeight(from) && to === 'cup') return { qty: (qty * G[from]) / density / cupMl };
  if (from === 'cup' && isWeight(to)) return { qty: (qty * STORED_CUP_ML * density) / G[to] };
  return { error: `Can't convert ${from} to ${to}.` };
}

// The units Check ingredients offers for one ingredient: its own unit plus
// cup, and an amount in cups can go to g or ml. Each with whether it is
// possible and, if not, why.
export function unitOptions(unit, density) {
  if (unit === 'cup') {
    return [
      { unit: 'g', ok: density > 0, reason: density > 0 ? null : 'No density for this ingredient' },
      { unit: 'ml', ok: true },
      { unit: 'cup', ok: true },
    ];
  }
  if (isWeight(unit)) {
    return [
      { unit, ok: true },
      { unit: 'cup', ok: density > 0, reason: density > 0 ? null : 'No density for this ingredient' },
    ];
  }
  if (isVolume(unit)) return [{ unit, ok: true }, { unit: 'cup', ok: true }];
  return [{ unit, ok: true }];
}

// Whether an ingredient's amount can reach its product's nutrition basis.
// Mirrors pinch.ingredient_nutrition so Check ingredients can show the
// status of a draft that isn't saved yet. The saved figures come only from
// the view. Returns 'ok' | 'unconvertible' | 'no_product' | 'not_counted'.
// A seasoning is never counted, whatever its amount or product.
//
// A per-100 g product's spoon weight (gramsPerTbsp, measured: "1 tbsp =
// 16 g") counts tsp, tbsp and cup of it. It is a measurement, not a
// conversion, so ml and l of a per-100 g product are still never counted.
export function nutritionStatus(ingredient, product, density) {
  const { qty, unit } = ingredient;
  if (ingredient.seasoning || qty == null || unit === 'to taste') return 'not_counted';
  if (!product) return 'no_product';
  const gpi = product.gramsPerItem;
  const gpt = product.gramsPerTbsp;
  const ok = {
    '100g': isWeight(unit) || (SPOONS.includes(unit) && gpt > 0) || (unit === 'cup' && (gpt > 0 || density > 0)) || (unit === 'each' && gpi > 0),
    '100ml': isVolume(unit),
    item: unit === 'each' || (isWeight(unit) && gpi > 0),
  }[product.basis];
  return ok ? 'ok' : 'unconvertible';
}

// What a linked product is missing for this amount to be counted, when one
// number on the product would fix it: 'spoon' (the weight of 1 tbsp, for
// tsp, tbsp or cup of a per-100 g product) or 'item' (the weight of one, for
// "2 each" of a per-100 g product or grams of a per-item one). null when
// the amount already counts, or when no measurement can help (ml of a
// per-100 g product, a cup of a per-item one).
export function missingMeasure(ingredient, product, density) {
  if (!product || nutritionStatus(ingredient, product, density) !== 'unconvertible') return null;
  const { unit } = ingredient;
  if (product.basis === '100g' && (SPOONS.includes(unit) || unit === 'cup')) return 'spoon';
  if ((unit === 'each' && product.basis === '100g') || (isWeight(unit) && product.basis === 'item')) return 'item';
  return null;
}

// Grams of a spoon or cup amount by a product's tbsp weight, or null.
export function gramsBySpoon(qty, unit, gramsPerTbsp) {
  if (!(qty > 0) || !(gramsPerTbsp > 0) || !(unit in TBSP_PER)) return null;
  return qty * TBSP_PER[unit] * gramsPerTbsp;
}
