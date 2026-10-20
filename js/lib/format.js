// Amounts as people read them.
//
// · Spoons and cups use quarter glyphs (¼ ½ ¾), as BLOC's fmtInch does: a
//   glyph only when the value really is that quarter. A value that isn't is
//   snapped to the nearest quarter and shown with "≈".
// · g and ml round for humans (no 0.333…, no 600.0000001 g), and roll up to
//   kg and l from 1000.
// · `each` is a whole number.
//
// mode (Settings › Show amounts as):
//   'written' — the unit the recipe was written in
//   'metric'  — cups become ml; spoons stay (they are metric already)
//   'cups'    — g/kg (with a density) and ml/l become cups; under ¼ cup the
//               written amount is kept, and spoons stay
// Only cups are ever converted to or from (see units.js).

import { convert, isWeight } from './units.js';

const GLYPHS = ['', '¼', '½', '¾'];
const EPS = 1e-9;

export const isQuarter = (v) => Math.abs(v * 4 - Math.round(v * 4)) < 1e-6;

// 1.5 → "1½", 0.25 → "¼", 2 → "2". Assumes v is a whole number of quarters.
export function quarters(v) {
  let whole = Math.floor(v + EPS);
  let q = Math.round((v - whole) * 4);
  if (q === 4) { whole += 1; q = 0; }
  if (whole === 0 && q === 0) return '0';
  return `${whole || ''}${GLYPHS[q]}`;
}

// Trims trailing zeros: 1.50 → "1.5", 2.00 → "2".
export function trimNumber(n, dp) {
  const s = n.toFixed(dp);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function roundMetric(q) {
  if (q < 10) return trimNumber(Math.round(q * 10) / 10, 1);
  if (q < 100) return String(Math.round(q));
  return String(Math.round(q / 5) * 5);
}

function metric(q, small, large) {
  if (q >= 1000) return `${trimNumber(Math.round(q / 10) / 100, 2)} ${large}`;
  return `${roundMetric(q)} ${small}`;
}

function spoonOrCup(q, unit) {
  const label = unit === 'cup' ? (q > 1 + EPS ? 'cups' : 'cup') : unit;
  if (q < 0.125) return `${trimNumber(q, 2)} ${label}`;
  if (isQuarter(q)) return `${quarters(q)} ${label}`;
  const snapped = Math.round(q * 4) / 4;
  const snappedLabel = unit === 'cup' ? (snapped > 1 + EPS ? 'cups' : 'cup') : unit;
  return `≈ ${quarters(snapped)} ${snappedLabel}`;
}

// The amount as written, in its own unit.
function written(q, unit) {
  switch (unit) {
    case 'each': return String(Math.max(1, Math.round(q)));
    case 'g': return metric(q, 'g', 'kg');
    case 'ml': return metric(q, 'ml', 'l');
    case 'kg': return q < 1 ? metric(q * 1000, 'g', 'kg') : `${trimNumber(q, 2)} kg`;
    case 'l': return q < 1 ? metric(q * 1000, 'ml', 'l') : `${trimNumber(q, 2)} l`;
    case 'tsp': case 'tbsp': case 'cup': return spoonOrCup(q, unit);
    default: return `${trimNumber(q, 2)} ${unit}`;
  }
}

// formatAmount(qty, unit, { mode, cup, density }) → "600 g", "1½ tbsp",
// "≈ ¾ cup", "6", "to taste", or "" when there is no amount.
export function formatAmount(qty, unit, { mode = 'written', cup = 'metric', density = null } = {}) {
  if (unit === 'to taste') return 'to taste';
  if (qty == null || !Number.isFinite(qty)) return '';

  if (mode === 'metric' && unit === 'cup') {
    const r = convert(qty, 'cup', 'ml');
    return written(r.qty, 'ml');
  }
  if (mode === 'cups' && (isWeight(unit) || unit === 'ml' || unit === 'l')) {
    const r = convert(qty, unit, 'cup', { density, cup });
    if (!r.error && r.qty >= 0.25 - EPS) {
      const snapped = Math.round(r.qty * 4) / 4;
      const label = snapped > 1 + EPS ? 'cups' : 'cup';
      // A conversion INTO cups always snaps, so it is marked unless the
      // result happens to land exactly on a quarter.
      return isQuarter(r.qty) ? `${quarters(r.qty)} ${label}` : `≈ ${quarters(snapped)} ${label}`;
    }
  }
  if (mode === 'cups' && unit === 'cup' && cup !== 'metric') {
    const r = convert(qty, 'cup', 'cup', { cup });
    return spoonOrCup(r.qty, 'cup');
  }
  return written(qty, unit);
}

// The number alone, for inputs: 1.5 → "1.5", null → "".
export const qtyInput = (qty) => (qty == null ? '' : trimNumber(qty, 3));
