// The only module that talks to Supabase tables, Storage and the import
// function, or to localStorage for data. Views and state.js call these
// async functions and never see a row.
//
// Two backends behind one interface:
//   · supabase — the real one: the `pinch` schema on the shared project.
//   · demo     — ?demo in the URL: the design's six sample recipes in this
//                browser only (localStorage `pinch.demo.v1`), no sign-in, no
//                network. For trying Pinch out and for headless UI checks.
//
// Every read is also kept in localStorage (`pinch.cache.v1`) for the signed-in
// user, so Pinch opens offline with the last recipes it saw. Writes need a
// connection; offline they fail with a message and change nothing.

import { supabase, sfl, schemaProblem } from './supabase.js';
import { rowsToRecipes, recipeToPayload, rowToProduct, productToRow, rowToNutrition } from './lib/rows.js';
import { DENSITIES } from './lib/densities.js';
import { demoData } from './demo-data.js';

export const isDemo = new URLSearchParams(location.search).has('demo');
const CACHE_KEY = 'pinch.cache.v1';
const DEMO_KEY = 'pinch.demo.v1';
const PHOTO_BUCKET = 'pinch-photos';
const URL_KEY = 'pinch.photoUrls.v1';

function fail(error, fallback) {
  const msg = schemaProblem(error) ?? (navigator.onLine === false ? 'You’re offline. Try again when you’re connected.' : null);
  const e = new Error(msg ?? error?.message ?? fallback);
  e.cause = error;
  return e;
}
const must = ({ data, error }, what) => { if (error) throw fail(error, `Couldn’t ${what}.`); return data; };

// ── household ─────────────────────────────────────────────────────────────
export async function ensureHousehold() {
  if (isDemo) return 'demo-household';
  return must(await sfl().rpc('ensure_household'), 'find your household');
}

export async function householdInfo(householdId) {
  if (isDemo) return { members: 2, code: 'DEMO42' };
  const out = { members: null, code: null };
  const m = await sfl().from('household_members').select('user_id').eq('household_id', householdId);
  if (!m.error) out.members = m.data.length;
  const c = await sfl().rpc('create_household_link_code');
  if (!c.error) out.code = typeof c.data === 'string' ? c.data : c.data?.code ?? null;
  return out;
}

export async function joinHousehold(code) {
  if (isDemo) throw new Error('Not in the demo.');
  return must(await sfl().rpc('redeem_household_link_code', { p_code: code }), 'join that household');
}

// ── loading ───────────────────────────────────────────────────────────────
async function all(query) {
  // PostgREST caps a response at 1000 rows; page through anything longer.
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw fail(error, 'Couldn’t load your recipes.');
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

function shape({ recipes, ingredients, steps, tags, products, nutrition, ingredientStatus, densities }) {
  return {
    recipes: rowsToRecipes({ recipes, ingredients, steps, tags }),
    products: products.map(rowToProduct),
    nutrition: Object.fromEntries(nutrition.map((n) => [n.recipe_id, rowToNutrition(n)])),
    ingredientStatus: Object.fromEntries(ingredientStatus.map((s) => [s.ingredient_id, s.status])),
    densities: densities.length ? Object.fromEntries(densities.map((d) => [d.name, Number(d.g_per_ml)])) : DENSITIES,
  };
}

export async function loadAll(userId) {
  if (isDemo) return demoLoad();
  const [recipes, ingredients, steps, tags, products, nutrition, ingredientStatus, densities] = await Promise.all([
    all(() => supabase.from('recipes').select('id,name,serves,meal,cuisine,photo_path,bloc_recipe_id,created_by,updated_at').order('id')),
    all(() => supabase.from('ingredients').select('id,recipe_id,position,name,qty,unit,product_id').order('id')),
    all(() => supabase.from('steps').select('id,recipe_id,position,text').order('id')),
    all(() => supabase.from('step_ingredients').select('step_id,ingredient_id').order('step_id')),
    all(() => supabase.from('products').select('*').order('id')),
    all(() => supabase.from('recipe_nutrition').select('*').order('recipe_id')),
    all(() => supabase.from('ingredient_nutrition').select('ingredient_id,status').order('ingredient_id')),
    all(() => supabase.from('densities').select('name,g_per_ml').order('name')),
  ]);
  const data = shape({ recipes, ingredients, steps, tags, products, nutrition, ingredientStatus, densities });
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, at: Date.now(), data })); } catch { /* full or private */ }
  return data;
}

// The last load for this user, for opening offline. null if none.
export function cachedData(userId) {
  if (isDemo) return null;
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    return c && c.userId === userId ? c.data : null;
  } catch {
    return null;
  }
}
export function clearCache() { try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(URL_KEY); } catch { /* */ } }

// Fresh nutrition for some recipes, after a save or a product change.
export async function loadNutrition(recipeIds) {
  if (isDemo) return demoNutrition(recipeIds);
  if (!recipeIds.length) return { nutrition: {}, ingredientStatus: {} };
  const [n, s] = await Promise.all([
    supabase.from('recipe_nutrition').select('*').in('recipe_id', recipeIds),
    supabase.from('ingredient_nutrition').select('ingredient_id,status').in('recipe_id', recipeIds),
  ]);
  must(n, 'load nutrition'); must(s, 'load nutrition');
  return {
    nutrition: Object.fromEntries(n.data.map((r) => [r.recipe_id, rowToNutrition(r)])),
    ingredientStatus: Object.fromEntries(s.data.map((r) => [r.ingredient_id, r.status])),
  };
}

// ── recipes ───────────────────────────────────────────────────────────────
export async function saveRecipe(recipe, householdId) {
  if (isDemo) return demoSave('recipes', recipe);
  must(await supabase.rpc('save_recipe', { payload: recipeToPayload(recipe, householdId) }), 'save the recipe');
}

export async function deleteRecipe(recipe) {
  if (isDemo) return demoDelete('recipes', recipe.id);
  must(await supabase.from('recipes').delete().eq('id', recipe.id), 'delete the recipe');
  // Files are removed through the Storage API only (MIGRATION-LESSONS §70).
  if (recipe.photoPath) await supabase.storage.from(PHOTO_BUCKET).remove([recipe.photoPath]);
}

// ── products ──────────────────────────────────────────────────────────────
export async function saveProduct(product, householdId) {
  if (isDemo) return demoSave('products', product);
  const row = productToRow(product, householdId);
  const data = must(await supabase.from('products').upsert(row).select().single(), 'save the product');
  return rowToProduct(data);
}

export async function deleteProduct(id) {
  if (isDemo) return demoDelete('products', id);
  must(await supabase.from('products').delete().eq('id', id), 'delete the product');
}

// ── photos ────────────────────────────────────────────────────────────────
export async function uploadPhoto(blob, householdId, recipeId) {
  if (isDemo) return URL.createObjectURL(blob);
  const path = `${householdId}/${recipeId}-${Date.now().toString(36)}.jpg`;
  must(await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }), 'upload the photo');
  return path;
}
export async function removePhoto(path) {
  if (isDemo || !path) return;
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

// A signed URL, kept for a week so the service worker's image cache can
// serve it offline (a new URL each time would never hit the cache).
let urls = null;
const WEEK = 7 * 24 * 3600;
export async function photoUrl(path) {
  if (!path) return null;
  if (isDemo || path.startsWith('blob:')) return path;
  if (!urls) { try { urls = JSON.parse(localStorage.getItem(URL_KEY) ?? '{}'); } catch { urls = {}; } }
  const hit = urls[path];
  if (hit && hit.exp > Date.now() + 3600_000) return hit.url;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, WEEK);
  if (error) return hit?.url ?? null;
  urls[path] = { url: data.signedUrl, exp: Date.now() + WEEK * 1000 };
  try { localStorage.setItem(URL_KEY, JSON.stringify(urls)); } catch { /* */ }
  return data.signedUrl;
}

// ── web import ────────────────────────────────────────────────────────────
export async function callImport(body, personalKey) {
  if (isDemo) return { error: 'demo', message: 'Importing needs a signed-in Pinch. In the demo, paste the recipe text instead.' };
  const headers = personalKey ? { 'x-pinch-key': personalKey } : {};
  const { data, error } = await supabase.functions.invoke('pinch-import', { body, headers });
  if (error) {
    try { const b = await error.context?.json?.(); if (b?.message) return b; } catch { /* */ }
    return { error: 'network', message: navigator.onLine === false ? 'You’re offline.' : 'The import service didn’t answer. Paste the recipe text instead.' };
  }
  return data;
}

// ── Open Food Facts ───────────────────────────────────────────────────────
export async function fetchOff(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return { status: 0 };
  if (!res.ok) throw new Error('Open Food Facts didn’t answer.');
  return res.json();
}

// ── demo backend ──────────────────────────────────────────────────────────
function demoRead() {
  try {
    const d = JSON.parse(localStorage.getItem(DEMO_KEY) ?? 'null');
    if (d && Array.isArray(d.recipes)) return d;
  } catch { /* */ }
  return demoData();
}
function demoWrite(d) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); } catch { /* */ } }

function demoNutritionFor(d, ids) {
  const nutrition = {};
  const ingredientStatus = {};
  const products = new Map(d.products.map((p) => [p.id, p]));
  for (const r of d.recipes.filter((x) => !ids || ids.includes(x.id))) {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    let counted = 0, missing = 0, notCounted = 0;
    for (const i of r.ingredients) {
      const p = products.get(i.productId);
      let status = 'ok';
      let f = null;
      if (i.qty == null || i.unit === 'to taste') status = 'not_counted';
      else if (!p) status = 'no_product';
      else if (p.basis === '100g' && (i.unit === 'g' || i.unit === 'kg')) f = (i.unit === 'kg' ? i.qty * 1000 : i.qty) / 100;
      else if (p.basis === '100ml' && ['ml', 'l', 'tsp', 'tbsp', 'cup'].includes(i.unit)) f = ({ ml: 1, l: 1000, tsp: 5, tbsp: 15, cup: 250 }[i.unit] * i.qty) / 100;
      else if (p.basis === 'item' && i.unit === 'each') f = i.qty;
      else if (p.basis === '100g' && i.unit === 'each' && p.gramsPerItem) f = (i.qty * p.gramsPerItem) / 100;
      else status = 'unconvertible';
      if (status === 'ok') { counted++; for (const k of Object.keys(t)) t[k] += f * p[k]; }
      if (status === 'not_counted') notCounted++;
      if (status === 'no_product' || status === 'unconvertible') missing++;
      ingredientStatus[i.id] = status;
    }
    const per = (v) => Math.round((v / r.serves) * 10) / 10;
    nutrition[r.id] = { kcal: per(t.kcal), protein: per(t.protein), carbs: per(t.carbs), fat: per(t.fat), counted, missing, notCounted, complete: missing === 0 && counted > 0 };
  }
  return { nutrition, ingredientStatus };
}
function demoLoad() {
  const d = demoRead();
  return { recipes: d.recipes, products: d.products, densities: DENSITIES, ...demoNutritionFor(d) };
}
function demoNutrition(ids) { return demoNutritionFor(demoRead(), ids); }
function demoSave(kind, item) {
  const d = demoRead();
  const i = d[kind].findIndex((x) => x.id === item.id);
  if (i >= 0) d[kind][i] = item; else d[kind].push(item);
  demoWrite(d);
  return item;
}
function demoDelete(kind, id) {
  const d = demoRead();
  d[kind] = d[kind].filter((x) => x.id !== id);
  if (kind === 'products') d.recipes.forEach((r) => r.ingredients.forEach((i) => { if (i.productId === id) i.productId = null; }));
  demoWrite(d);
}
