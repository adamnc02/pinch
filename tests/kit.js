// Pinch test kit: a tiny test runner for the browser, no build step.
// Roughly pytest in ~100 lines: test files call describe() and test() when
// they're imported, then tests.html calls run() once every file has loaded.

const tests = [];
let currentGroup = '';

export function describe(group, fn) {
  currentGroup = group;
  fn();
  currentGroup = '';
}

export function test(name, fn) {
  tests.push({ group: currentGroup, name, fn });
}

export class AssertionError extends Error {}

function show(value) {
  if (value === undefined) return 'undefined';
  if (Number.isNaN(value)) return 'NaN';
  return JSON.stringify(value);
}

export function deepEqual(a, b) {
  if (a === b || (Number.isNaN(a) && Number.isNaN(b))) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}

// Compares by value, like == on Python lists and dicts (not `is`).
export function assertEqual(actual, expected, message = '') {
  if (!deepEqual(actual, expected)) {
    throw new AssertionError(
      `${message ? message + ': ' : ''}expected ${show(expected)}, got ${show(actual)}`
    );
  }
}

export function assertTrue(value, message = 'expected true') {
  if (value !== true) throw new AssertionError(`${message} (got ${show(value)})`);
}

// Like pytest.raises: passes only if fn throws.
export function assertThrows(fn, message = 'expected it to throw') {
  try {
    fn();
  } catch (err) {
    if (err instanceof Error && err.message === 'not implemented') throw err;
    return err;
  }
  throw new AssertionError(message);
}

const isStub = (err) => err instanceof Error && err.message === 'not implemented';

export async function run() {
  const results = [];
  for (const t of tests) {
    try {
      await t.fn();
      results.push({ ...t, status: 'pass' });
    } catch (err) {
      results.push({ ...t, status: isStub(err) ? 'todo' : 'fail', error: err });
      if (!isStub(err)) console.error(`${t.group} › ${t.name}\n`, err);
    }
  }
  render(results);
  return results;
}

function render(results) {
  const passed = results.filter((r) => r.status === 'pass').length;
  const todo = results.filter((r) => r.status === 'todo').length;
  const failed = results.length - passed;

  const summary = document.getElementById('summary');
  summary.dataset.passed = passed;
  summary.dataset.failed = failed;
  summary.dataset.total = results.length;
  summary.className = failed ? 'bad' : 'good';
  summary.textContent = failed
    ? `${passed} passed, ${failed} failed` + (todo ? ` (${todo} not implemented yet)` : '')
    : `All ${passed} passed`;
  document.title = `${failed ? 'FAIL' : 'PASS'} ${passed}/${results.length} · Pinch tests`;

  const list = document.getElementById('results');
  list.replaceChildren();
  let group = null;
  let ul = null;
  for (const r of results) {
    if (r.group !== group) {
      group = r.group;
      const h = document.createElement('h2');
      h.textContent = group || 'Tests';
      ul = document.createElement('ul');
      list.append(h, ul);
    }
    const li = document.createElement('li');
    li.className = r.status;
    const mark = document.createElement('span');
    mark.className = 'mark';
    mark.textContent = { pass: 'PASS', fail: 'FAIL', todo: 'TODO' }[r.status];
    li.append(mark, r.name);
    if (r.status === 'fail') {
      const detail = document.createElement('pre');
      detail.textContent = r.error instanceof AssertionError ? r.error.message : String(r.error?.stack || r.error);
      li.append(detail);
    }
    ul.append(li);
  }
}
