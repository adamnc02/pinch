// Servings scaling. Only the amount as written is stored; this derives the
// amounts for the servings on the stepper, and never touches the original.

// A new recipe whose quantities are multiplied by servings ÷ recipe.serves.
// qty: null ("to taste", "a pinch") stays null. `serves` is unchanged: it is
// what the recipe makes, not what is being cooked.
export function scaleRecipe(recipe, servings) {
  const factor = scaleFactor(recipe, servings);
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((i) => ({
      ...i,
      qty: i.qty == null ? null : i.qty * factor,
    })),
    steps: recipe.steps.map((s) => ({ ...s, ingredientIds: [...s.ingredientIds] })),
  };
}

export function scaleFactor(recipe, servings) {
  const serves = Number(recipe.serves) || 1;
  const n = Number(servings) || serves;
  return n / serves;
}
