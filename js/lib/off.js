// Open Food Facts v2 → a Pinch product, for the user to confirm.
// Crowd-sourced data is never saved without the scan result sheet's
// "Use product", and a missing kcal is reported, never invented.

export const OFF_FIELDS = 'code,product_name,product_name_en,generic_name,brands,quantity,product_quantity,product_quantity_unit,nutriments,nutrition_data_per';

export const offUrl = (barcode) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;

const n = (v) => {
  const x = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : null;
};

// mapOffProduct(json, barcode) →
//   { ok: true, product, missing: [field…], sizeLabel }  or  { ok: false, reason }
export function mapOffProduct(json, barcode) {
  if (!json || json.status === 0 || !json.product) return { ok: false, reason: 'not_found' };
  const p = json.product;
  const nm = p.nutriments ?? {};

  const qtyText = String(p.quantity ?? '');
  const unit = String(p.product_quantity_unit ?? '').toLowerCase();
  const liquid = p.nutrition_data_per === '100ml' || ['ml', 'cl', 'l'].includes(unit)
    || /\d\s*(ml|cl|l)\b/i.test(qtyText);

  let kcal = n(nm['energy-kcal_100g']);
  if (kcal == null) {
    const kj = n(nm['energy-kj_100g']) ?? (nm.energy_unit === 'kJ' || nm.energy_unit == null ? n(nm.energy_100g) : null);
    if (kj != null) kcal = Math.round((kj / 4.184) * 10) / 10;
  }
  const product = {
    id: null,
    name: (p.product_name || p.product_name_en || p.generic_name || '').trim(),
    brand: (p.brands ?? '').split(',')[0].trim() || null,
    barcode: String(p.code ?? barcode ?? '').trim() || null,
    basis: liquid ? '100ml' : '100g',
    kcal,
    protein: n(nm.proteins_100g),
    carbs: n(nm.carbohydrates_100g),
    fat: n(nm.fat_100g),
    gramsPerItem: !liquid && unit === 'g' && n(p.product_quantity) > 0 ? n(p.product_quantity) : null,
    source: 'off',
  };
  const missing = ['name', 'kcal', 'protein', 'carbs', 'fat'].filter((k) => product[k] == null || product[k] === '');
  return { ok: true, product, missing, sizeLabel: qtyText.trim() || null };
}
