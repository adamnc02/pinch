// Tests for the test kit itself, so a broken kit can't hide broken code.
import { describe, test, assertEqual, assertTrue, assertThrows, deepEqual } from './kit.js';

describe('kit', () => {
  test('deepEqual compares arrays and objects by value', () => {
    assertTrue(deepEqual([1, { a: 'x' }], [1, { a: 'x' }]));
    assertTrue(!deepEqual([1, 2], [2, 1]));
    assertTrue(!deepEqual({ a: 1 }, { a: 1, b: 2 }));
    assertTrue(!deepEqual([], {}));
    assertTrue(deepEqual(NaN, NaN));
  });

  test('assertEqual throws on a mismatch', () => {
    assertThrows(() => assertEqual(['IT'], ['JP']));
  });

  test('assertThrows passes when the function throws', () => {
    assertThrows(() => { throw new Error('boom'); });
  });
});
