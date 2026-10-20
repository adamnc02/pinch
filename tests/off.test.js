import { describe, test, assertEqual } from './kit.js';
import { mapOffProduct } from '../js/lib/off.js';

// Shapes saved from Open Food Facts v2 responses, trimmed to the fields Pinch asks for.
const complete = { status: 1, product: { code: '8005121000207', product_name: 'Chickpeas in Water', brands: 'Napolina,Princes', quantity: '400 g', product_quantity: '400', product_quantity_unit: 'g', nutriments: { 'energy-kcal_100g': 115, proteins_100g: 7.2, carbohydrates_100g: 13.4, fat_100g: 2.1 } } };
const noKcal = { status: 1, product: { code: '5000000000002', product_name: 'Plain flour', brands: '', nutriments: { proteins_100g: 10, carbohydrates_100g: 76, fat_100g: 1.3 } } };
const kjOnly = { status: 1, product: { code: '5000000000003', product_name: 'Oats', nutriments: { 'energy-kj_100g': 1548, proteins_100g: 13, carbohydrates_100g: 60, fat_100g: 7 } } };
const liquid = { status: 1, product: { code: '5000000000004', product_name: 'Semi-skimmed milk', quantity: '1 l', product_quantity: '1000', product_quantity_unit: 'ml', nutriments: { 'energy-kcal_100g': 50, proteins_100g: 3.6, carbohydrates_100g: 4.8, fat_100g: 1.8 } } };

describe('mapOffProduct', () => {
  test('a complete product, per 100 g, with its tin weight', () => {
    const r = mapOffProduct(complete, '8005121000207');
    assertEqual([r.ok, r.product.name, r.product.brand, r.product.basis, r.product.kcal, r.product.gramsPerItem], [true, 'Chickpeas in Water', 'Napolina', '100g', 115, 400]);
    assertEqual(r.missing, []);
  });
  test('missing kcal is reported, never invented', () => {
    const r = mapOffProduct(noKcal, '5000000000002');
    assertEqual([r.product.kcal, r.missing], [null, ['kcal']]);
  });
  test('kJ alone is converted to kcal', () => {
    assertEqual(mapOffProduct(kjOnly).product.kcal, 370);
  });
  test('a liquid is per 100 ml, with no grams per item', () => {
    const r = mapOffProduct(liquid);
    assertEqual([r.product.basis, r.product.gramsPerItem], ['100ml', null]);
  });
  test('not found', () => {
    assertEqual(mapOffProduct({ status: 0 }), { ok: false, reason: 'not_found' });
  });
});
