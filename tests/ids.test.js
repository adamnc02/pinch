import { describe, test, assertEqual } from './kit.js';
import { newId, uuidFromRandom } from '../js/lib/ids.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('ids', () => {
  test('newId is a version 4 uuid', () => assertEqual(UUID_V4.test(newId()), true));
  test('without crypto.randomUUID (plain http on the LAN) the fallback is a version 4 uuid too', () => {
    const ids = Array.from({ length: 200 }, uuidFromRandom);
    assertEqual(ids.every((id) => UUID_V4.test(id)), true);
    assertEqual(new Set(ids).size, 200);
  });
});
