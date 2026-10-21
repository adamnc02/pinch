// Ids are made when a form row is created, not at save, so a step can tag
// an ingredient added in the same unsaved edit.
export const newId = () => crypto.randomUUID();

export const blankRecipe = () => ({
  id: newId(), name: '', serves: 4, meal: null, cuisine: null, photoPath: null, blocRecipeId: null,
  ingredients: [], steps: [], cooking: [],
});
export const blankIngredient = () => ({ id: newId(), name: '', qty: null, unit: 'g', productId: null, seasoning: false });
export const blankCooking = (method = 'oven') => ({ id: newId(), method, name: null, minutes: null, tempC: null, note: null });
export const blankStep = () => ({ id: newId(), text: '', ingredientIds: [] });
