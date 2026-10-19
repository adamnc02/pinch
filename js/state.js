// The one source of truth while Pinch is open. Views read from here and
// re-render when it changes (subscribe); only the actions below change it,
// and each action writes through storage.js first. Like a dbt DAG where only
// the source table is written to and everything downstream is derived.

import * as storage from './storage.js';
import { densityFor } from './lib/densities.js';

let state = {
  user: null,
  householdId: null,
  recipes: [],
  products: [],
  nutrition: {},          // recipe id → per-serving figures from pinch.recipe_nutrition
  ingredientStatus: {},   // ingredient id → 'ok' | 'no_product' | 'unconvertible' | 'not_counted'
  densities: {},
  status: 'loading',      // 'loading' | 'ready' | 'offline' | 'error'
  error: null,
};
const listeners = new Set();

export const get = () => state;
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export const getRecipe = (id) => state.recipes.find((r) => r.id === id) ?? null;
export const getProduct = (id) => (id ? state.products.find((p) => p.id === id) ?? null : null);
export const productByBarcode = (code) => state.products.find((p) => p.barcode === code) ?? null;
export const densityForIngredient = (i) => densityFor(i.name, getProduct(i.productId)?.name, state.densities);

// Household products whose name contains every word typed, best first.
export function searchProducts(text, limit = 6) {
  const words = String(text).toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return state.products
    .map((p) => {
      const hay = `${p.name} ${p.brand ?? ''}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return null;
      return { p, score: (p.name.toLowerCase().startsWith(words[0]) ? 0 : 1) + p.name.length / 1000 };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => x.p);
}

// The household product whose name matches an ingredient's, for linking an
// imported ingredient automatically. Exact name first, then a product name
// that contains the ingredient's main words.
export function matchProduct(name) {
  const n = String(name).trim().toLowerCase();
  if (!n) return null;
  return state.products.find((p) => p.name.trim().toLowerCase() === n)
    ?? state.products.find((p) => p.name.trim().toLowerCase().replace(/s$/, '') === n.replace(/s$/, ''))
    ?? null;
}

// ── actions ───────────────────────────────────────────────────────────────
export async function start(user) {
  const cached = user ? storage.cachedData(user.id) : null;
  set({ user, status: 'loading', error: null, ...(cached ?? {}) });
  try {
    const householdId = await storage.ensureHousehold();
    const data = await storage.loadAll(user?.id);
    set({ ...data, householdId, status: 'ready', error: null });
  } catch (e) {
    if (cached) set({ status: 'offline', error: e.message });
    else set({ status: 'error', error: e.message });
  }
}

export const reload = () => start(state.user);

export function reset() {
  set({ user: null, householdId: null, recipes: [], products: [], nutrition: {}, ingredientStatus: {}, status: 'loading', error: null });
}

function requireOnline() {
  if (!state.householdId) throw new Error('Pinch is offline. Try again when you’re connected.');
}

async function refreshNutrition(ids) {
  const fresh = await storage.loadNutrition(ids);
  set({ nutrition: { ...state.nutrition, ...fresh.nutrition }, ingredientStatus: { ...state.ingredientStatus, ...fresh.ingredientStatus } });
}

export async function saveRecipe(recipe) {
  requireOnline();
  await storage.saveRecipe(recipe, state.householdId);
  const exists = state.recipes.some((r) => r.id === recipe.id);
  set({ recipes: exists ? state.recipes.map((r) => (r.id === recipe.id ? recipe : r)) : [...state.recipes, recipe] });
  await refreshNutrition([recipe.id]).catch(() => {});
}

export async function deleteRecipe(id) {
  requireOnline();
  const recipe = getRecipe(id);
  if (!recipe) return;
  await storage.deleteRecipe(recipe);
  set({ recipes: state.recipes.filter((r) => r.id !== id) });
}

// Saves a product (new or edited) and returns it with its id.
export async function saveProduct(product) {
  requireOnline();
  const withId = { ...product, id: product.id ?? crypto.randomUUID() };
  const saved = (await storage.saveProduct(withId, state.householdId)) ?? withId;
  const exists = state.products.some((p) => p.id === saved.id);
  set({ products: exists ? state.products.map((p) => (p.id === saved.id ? saved : p)) : [...state.products, saved] });
  const using = state.recipes.filter((r) => r.ingredients.some((i) => i.productId === saved.id)).map((r) => r.id);
  if (using.length) await refreshNutrition(using).catch(() => {});
  return saved;
}

export async function deleteProduct(id) {
  requireOnline();
  await storage.deleteProduct(id);
  const recipes = state.recipes.map((r) => ({ ...r, ingredients: r.ingredients.map((i) => (i.productId === id ? { ...i, productId: null } : i)) }));
  const using = recipes.filter((r) => state.recipes.find((o) => o.id === r.id)?.ingredients.some((i) => i.productId === id)).map((r) => r.id);
  set({ products: state.products.filter((p) => p.id !== id), recipes });
  if (using.length) await refreshNutrition(using).catch(() => {});
}
