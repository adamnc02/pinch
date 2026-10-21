// Ids are made when a form row is created, not at save, so a step can tag
// an ingredient added in the same unsaved edit.
//
// crypto.randomUUID only exists in a secure context (https, localhost), so
// on the phone over the Mac's LAN address (http://192.168.…:8000, for local
// testing) it is missing. getRandomValues exists everywhere and makes the
// same RFC 4122 version 4 uuid.
export const newId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : uuidFromRandom());

export function uuidFromRandom() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const blankRecipe = () => ({
  id: newId(), name: '', serves: 4, meal: null, cuisine: null, photoPath: null, blocRecipeId: null,
  ingredients: [], steps: [], cooking: [],
});
export const blankIngredient = () => ({ id: newId(), name: '', qty: null, unit: 'g', productId: null, seasoning: false });
export const blankCooking = (method = 'oven') => ({ id: newId(), method, name: null, minutes: null, tempC: null, note: null });
export const blankStep = () => ({ id: newId(), text: '', ingredientIds: [] });
