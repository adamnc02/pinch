// Hash routes, so back, forward, refresh and deep links all work on GitHub
// Pages (which can't rewrite paths):
//   #/                 Home
//   #/recipe/<id>      Home with that recipe's sheet open
const listeners = new Set();

export function currentRoute() {
  const m = location.hash.match(/^#\/recipe\/([0-9a-f-]{36})$/i);
  return m ? { view: 'recipe', id: m[1] } : { view: 'home' };
}

export function navigate(hash, { replace = false } = {}) {
  if (location.hash === hash) return;
  if (replace) {
    history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
    emit();
  } else {
    location.hash = hash;
  }
}

// Closing the recipe sheet: step back if we came from Home in this tab, so
// the back button doesn't reopen it; otherwise (a deep link) replace.
// Idempotent: a second call before the first back() lands does nothing, so
// a recipe deleted from its own sheet never steps back out of Pinch.
let leaving = false;
export function leaveRecipe() {
  if (leaving || currentRoute().view !== 'recipe') return;
  leaving = true;
  if (history.state?.pinchFromHome) history.back();
  else navigate('#/', { replace: true });
}

export function openRecipe(id) {
  history.pushState({ pinchFromHome: true }, '', `${location.pathname}${location.search}#/recipe/${id}`);
  emit();
}

const emit = () => { leaving = false; listeners.forEach((fn) => fn(currentRoute())); };
export function onRoute(fn) { listeners.add(fn); return () => listeners.delete(fn); }
addEventListener('hashchange', emit);
addEventListener('popstate', emit);
