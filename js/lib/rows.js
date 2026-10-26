// Mapping between the app's nested recipe object and the pinch tables.
// Like a dbt staging model then a mart: four tables in, one object out,
// and one save_recipe payload back. Pure, so both directions are tested.

const byPosition = (a, b) => a.position - b.position || String(a.id).localeCompare(String(b.id));
const num = (v) => (v == null || v === '' ? null : Number(v));

// { recipes, ingredients, steps, tags, cooking } rows → recipe objects.
// Ingredients, steps and cooking options are ordered by position; tags keep
// ingredient-list order.
export function rowsToRecipes({ recipes = [], ingredients = [], steps = [], tags = [], cooking = [] }) {
  const ingBy = new Map();
  for (const i of [...ingredients].sort(byPosition)) {
    if (!ingBy.has(i.recipe_id)) ingBy.set(i.recipe_id, []);
    ingBy.get(i.recipe_id).push({
      id: i.id, name: i.name, qty: num(i.qty), unit: i.unit, productId: i.product_id ?? null, seasoning: i.seasoning === true,
    });
  }
  const cookBy = new Map();
  for (const c of [...cooking].sort(byPosition)) {
    if (!cookBy.has(c.recipe_id)) cookBy.set(c.recipe_id, []);
    cookBy.get(c.recipe_id).push({
      id: c.id, method: c.method, name: c.name ?? null, minutes: num(c.minutes), tempC: num(c.temp_c), note: c.note ?? null,
    });
  }
  const tagBy = new Map();
  for (const t of tags) {
    if (!tagBy.has(t.step_id)) tagBy.set(t.step_id, new Set());
    tagBy.get(t.step_id).add(t.ingredient_id);
  }
  const stepBy = new Map();
  for (const s of [...steps].sort(byPosition)) {
    if (!stepBy.has(s.recipe_id)) stepBy.set(s.recipe_id, []);
    const ings = ingBy.get(s.recipe_id) ?? [];
    const set = tagBy.get(s.id) ?? new Set();
    stepBy.get(s.recipe_id).push({
      id: s.id, text: s.text, ingredientIds: ings.filter((i) => set.has(i.id)).map((i) => i.id),
    });
  }
  return recipes.map((r) => ({
    id: r.id,
    name: r.name,
    serves: Number(r.serves),
    meal: r.meal,
    cuisine: r.cuisine ?? null,
    photoPath: r.photo_path ?? null,
    blocRecipeId: r.bloc_recipe_id ?? null,
    createdBy: r.created_by ?? null,
    updatedAt: r.updated_at ?? null,
    ingredients: ingBy.get(r.id) ?? [],
    steps: stepBy.get(r.id) ?? [],
    cooking: cookBy.get(r.id) ?? [],
  }));
}

// recipe object → the pinch.save_recipe payload. position is the array index.
// `cooking` is always sent (an empty list clears the recipe's options); the
// database leaves them alone only when a payload has no `cooking` at all,
// which is how an un-updated phone's save keeps them.
export function recipeToPayload(recipe, householdId) {
  return {
    id: recipe.id,
    household_id: householdId,
    name: recipe.name.trim(),
    serves: recipe.serves,
    meal: recipe.meal,
    cuisine: recipe.cuisine || null,
    photo_path: recipe.photoPath || null,
    bloc_recipe_id: recipe.blocRecipeId || null,
    ingredients: recipe.ingredients.map((i, position) => ({
      id: i.id, position, name: i.name.trim(), qty: i.qty ?? null, unit: i.unit, product_id: i.productId || null,
      seasoning: i.seasoning === true,
    })),
    steps: recipe.steps.map((s, position) => ({
      id: s.id, position, text: s.text, ingredient_ids: [...s.ingredientIds],
    })),
    cooking: (recipe.cooking ?? []).map((c, position) => ({
      id: c.id, position, method: c.method, name: c.method === 'other' ? String(c.name ?? '').trim() || null : null,
      minutes: c.minutes ?? null, temp_c: c.tempC ?? null, note: String(c.note ?? '').trim() || null,
    })),
  };
}

export function rowToProduct(p) {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand ?? null,
    barcode: p.barcode ?? null,
    basis: p.basis,
    kcal: num(p.kcal),
    protein: num(p.protein),
    carbs: num(p.carbs),
    fat: num(p.fat),
    gramsPerItem: num(p.grams_per_item),
    gramsPerTbsp: num(p.grams_per_tbsp),
    source: p.source ?? 'label',
    updatedAt: p.updated_at ?? null,
  };
}

export function productToRow(p, householdId) {
  return {
    id: p.id,
    household_id: householdId,
    name: p.name.trim(),
    brand: p.brand?.trim() || null,
    barcode: p.barcode?.trim() || null,
    basis: p.basis,
    kcal: p.kcal,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat,
    grams_per_item: p.gramsPerItem || null,
    grams_per_tbsp: p.basis === '100g' ? p.gramsPerTbsp || null : null,
    source: p.source ?? 'label',
  };
}

export function rowToNutrition(n) {
  return {
    kcal: num(n.kcal), protein: num(n.protein), carbs: num(n.carbs), fat: num(n.fat),
    counted: n.counted_count, missing: n.missing_count, notCounted: n.not_counted_count,
    complete: n.nutrition_complete,
  };
}
