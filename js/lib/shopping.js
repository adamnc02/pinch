// Send to Listly: a recipe's ingredients as shopping-list lines.
//
// · Scaled to the servings chosen, then written "Plain flour (500 g)". A
//   line with no amount, or "to taste", is the name alone.
// · Amounts are always metric-rounded (formatAmount's 'metric' mode),
//   whatever Settings › Show amounts as says: a shop sells grams and
//   millilitres, not "≈ 1½ cups". Spoons stay spoons.
// · Lines for the same ingredient in the same unit are added together
//   (kg counted as g, l as ml), so butter in two steps is one item.
// · Listly's own rules for the rows it reads: ids are 8 characters from its
//   alphabet (listly src/lib/ids.ts), and a new item goes after the last one
//   (appendPosition, listly src/lib/powersync/mapping.ts).

import { scaleRecipe } from './scale.js';
import { formatAmount } from './format.js';

const BASE = { kg: ['g', 1000], l: ['ml', 1000] };
const key = (name) => String(name).trim().toLowerCase();

// shoppingLines(recipe, servings) →
//   [{ key, name, qty, unit, text, toTaste }] in recipe order.
export function shoppingLines(recipe, servings) {
  const scaled = scaleRecipe(recipe, servings);
  const lines = [];
  const byKey = new Map();
  for (const i of scaled.ingredients) {
    const name = String(i.name ?? '').trim();
    if (!name) continue;
    const hasAmount = i.unit !== 'to taste' && i.qty != null && Number.isFinite(i.qty);
    const [unit, factor] = hasAmount ? (BASE[i.unit] ?? [i.unit, 1]) : [null, 1];
    const k = `${key(name)}|${unit ?? ''}`;
    const line = byKey.get(k);
    if (line) {
      if (hasAmount) line.qty += i.qty * factor;
      continue;
    }
    const fresh = { key: k, name, qty: hasAmount ? i.qty * factor : null, unit, toTaste: i.unit === 'to taste' };
    byKey.set(k, fresh);
    lines.push(fresh);
  }
  // A name that has an amount somewhere needs no separate amount-less line.
  const withAmount = new Set(lines.filter((l) => l.unit).map((l) => key(l.name)));
  return lines
    .filter((l) => l.unit || !withAmount.has(key(l.name)))
    .map((l) => ({ ...l, text: itemText(l.name, l.qty, l.unit) }));
}

export function itemText(name, qty, unit) {
  const amount = unit ? formatAmount(qty, unit, { mode: 'metric' }) : '';
  return amount ? `${name} (${amount})` : name;
}

// An item's name without a trailing "(…)": "Plain flour (500 g)" → "plain flour".
export const baseName = (text) => key(String(text).replace(/\s*\([^()]*\)\s*$/, ''));

// The lines whose ingredient is already on the list, not yet ticked off.
export function alreadyOn(lines, items) {
  const open = new Set(items.filter((i) => !i.done).map((i) => baseName(i.text)));
  return new Set(lines.filter((l) => open.has(key(l.name))).map((l) => l.key));
}

// After the last sibling, as Listly appends.
export function appendPosition(positions) {
  return positions.reduce((m, p) => (p != null && p > m ? p : m), -1) + 1;
}

// Listly's id shape: 8 characters, no 0/O/1/I/l.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
export function listlyId() {
  let out = '';
  while (out.length < 8) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      const v = b & 63;                       // unbiased: reject 56–63
      if (v < ALPHABET.length && out.length < 8) out += ALPHABET[v];
    }
  }
  return out;
}

// The household's lists in Listly's order: position, then id; no position last.
export function sortLists(lists) {
  return [...lists].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || String(a.id).localeCompare(String(b.id)));
}
