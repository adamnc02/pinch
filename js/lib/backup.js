// Settings › Back up recipes: every recipe and product as one JSON file, and
// reading one back. parseBackup never throws: bad input is { error }.

export const BACKUP_KIND = 'pinch-backup';
export const BACKUP_VERSION = 1;

export function makeBackup({ recipes, products }, now = new Date()) {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    recipes,
    products,
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'That file isn’t a Pinch backup (it isn’t JSON).' };
  }
  if (!isObj(data) || data.kind !== BACKUP_KIND) return { error: 'That file isn’t a Pinch backup.' };
  if (data.version !== BACKUP_VERSION) return { error: `That backup is version ${data.version}; this Pinch reads version ${BACKUP_VERSION}.` };
  if (!Array.isArray(data.recipes) || !Array.isArray(data.products)) return { error: 'That backup is missing its recipes or products.' };

  for (const [n, r] of data.recipes.entries()) {
    if (!isObj(r) || typeof r.id !== 'string' || typeof r.name !== 'string'
        || !Array.isArray(r.ingredients) || !Array.isArray(r.steps)) {
      return { error: `Recipe ${n + 1} in that backup is damaged.` };
    }
    if (r.steps.some((s) => !isObj(s) || !Array.isArray(s.ingredientIds))) {
      return { error: `A step in “${r.name}” is damaged.` };
    }
  }
  for (const [n, p] of data.products.entries()) {
    if (!isObj(p) || typeof p.id !== 'string' || typeof p.name !== 'string' || !['100g', '100ml', 'item'].includes(p.basis)) {
      return { error: `Product ${n + 1} in that backup is damaged.` };
    }
  }
  return { recipes: data.recipes, products: data.products };
}
