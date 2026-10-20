// Per-device preferences, in localStorage under `pinch.prefs` (namespaced:
// every app of Adam's shares this origin). Not synced: two people can read
// the same recipe in different units.
const KEY = 'pinch.prefs';
const AI_KEY = 'pinch.anthropicKey';
const DEFAULTS = { theme: 'system', amounts: 'written', cup: 'metric', homeMode: 'meal' };

let prefs = { ...DEFAULTS };
try { prefs = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { /* private mode or corrupt */ }

const listeners = new Set();
export const getPrefs = () => prefs;
export function setPref(name, value) {
  prefs = { ...prefs, [name]: value };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
  if (name === 'theme') applyTheme();
  listeners.forEach((fn) => fn(prefs));
}
export const onPrefs = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// data-theme on <html>, as tokens.css expects. ?theme= (screenshots) wins.
export function applyTheme() {
  const forced = new URLSearchParams(location.search).get('theme');
  const t = forced === 'light' || forced === 'dark' ? forced : prefs.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#101311' : '#F4F5F1'));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

// The person's own Claude key, entered once in Settings, as in BLOC. Kept on
// this device only and sent only to api.anthropic.com (claude.js), when an
// import needs Claude.
export function getAiKey() { try { return localStorage.getItem(AI_KEY) ?? ''; } catch { return ''; } }
export function setAiKey(v) {
  try { if (v) localStorage.setItem(AI_KEY, v.trim()); else localStorage.removeItem(AI_KEY); } catch { /* private mode */ }
}

// The display options formatAmount takes, from the current prefs.
export const amountOpts = () => ({ mode: prefs.amounts, cup: prefs.cup });
