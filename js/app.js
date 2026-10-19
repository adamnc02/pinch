// Pinch entry point. index.html loads only this module; everything else
// reaches the page through its imports.
//
// Boot: theme → service worker → splash → session → sign-in or Home →
// route. The splash plays once per launch and is dismissed when the data is
// ready, but no sooner than 2.8 s, so the shake and the wordmark land.

import * as state from './state.js';
import { supabase } from './supabase.js';
import { isDemo } from './storage.js';
import { applyTheme } from './prefs.js';
import { currentRoute, onRoute, leaveRecipe, navigate } from './router.js';
import { closeAllSheets, topSheet } from './components/sheet.js';
import { toast } from './components/toast.js';
import { mountHome } from './views/home.js';
import { mountSignIn } from './views/signin.js';
import { openRecipeSheet } from './views/recipe-sheet.js';
import { openEditor } from './views/editor.js';
import { openSettings } from './views/settings.js';
import { openCheckIngredients } from './views/check.js';

const SPLASH_MIN_MS = 2800;
const splashShown = performance.now();
const homeEl = document.getElementById('home');
const signinEl = document.getElementById('signin');
let recipeSheet = null;
let mounted = false;
let currentUserId;

applyTheme();

// ── splash ──────────────────────────────────────────────────────────────
function dismissSplash() {
  const el = document.getElementById('splash');
  if (!el || el.classList.contains('gone')) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = reduced ? 0 : Math.max(0, SPLASH_MIN_MS - (performance.now() - splashShown));
  setTimeout(() => {
    el.classList.add('gone');
    setTimeout(() => el.remove(), 400);
  }, wait);
}

// ── routes ──────────────────────────────────────────────────────────────
function showRoute(route) {
  if (route.view !== 'recipe') {
    if (recipeSheet && !recipeSheet.closed) recipeSheet.close({ force: true });
    recipeSheet = null;
    return;
  }
  if (recipeSheet && !recipeSheet.closed) return;
  const s = state.get();
  if (!state.getRecipe(route.id)) {
    if (s.status === 'loading') return;   // re-checked when the data lands
    toast('That recipe isn’t in your household.', { error: true });
    navigate('#/', { replace: true });
    return;
  }
  recipeSheet = openRecipeSheet(route.id, {
    onEdit: (id) => openEditor({ recipeId: id, onDeleted: () => leaveRecipe() }),
    onCheck: (id) => openCheckIngredients({ recipe: state.getRecipe(id), saveOnFinish: true, finishLabel: 'Save recipe' }),
    onClose: () => {
      recipeSheet = null;
      if (currentRoute().view === 'recipe') leaveRecipe();
    },
  });
}
onRoute(showRoute);

// ── signed in / out ─────────────────────────────────────────────────────
function showHome(user) {
  signinEl.hidden = true;
  homeEl.hidden = false;
  if (!mounted) {
    mounted = true;
    mountHome(homeEl, {
      onAdd: () => openEditor(),
      onSettings: () => openSettings({ onSignOut: () => showSignIn() }),
    });
    state.subscribe((s) => {
      if (s.status !== 'loading') { dismissSplash(); showRoute(currentRoute()); }
    });
  }
  state.start(user);
}

function showSignIn() {
  closeAllSheets();
  state.reset();
  currentUserId = null;
  homeEl.hidden = true;
  signinEl.hidden = false;
  mountSignIn(signinEl);
  dismissSplash();
}

async function boot() {
  if (isDemo) {
    showHome({ id: 'demo', email: null });
    return;
  }
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;
  // A PKCE return leaves ?code= in the address bar; once the session exists
  // it has done its job.
  if (new URLSearchParams(location.search).has('code')) history.replaceState(null, '', `${location.pathname}${location.hash}`);
  currentUserId = user?.id ?? null;
  if (user) showHome(user); else showSignIn();

  supabase.auth.onAuthStateChange((event, session) => {
    const id = session?.user?.id ?? null;
    if (id === currentUserId) return;
    currentUserId = id;
    if (id) showHome(session.user); else showSignIn();
  });
}

boot().catch((e) => {
  console.error('[pinch] boot failed', e);
  dismissSplash();
  toast('Pinch couldn’t start. Check your connection and reload.', { error: true });
});

// ── service worker ──────────────────────────────────────────────────────
// Scope is this folder (/pinch/), never the site root: Adam's other apps
// live on the same origin. A new version takes over at the next quiet
// moment (no sheet open), so nobody loses an unsaved edit to a reload.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js', { scope: './' }).then((reg) => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch((e) => console.warn('[pinch] service worker not registered', e));
  let reloading = false;
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    const tryReload = () => {
      if (topSheet()) { setTimeout(tryReload, 2000); return; }
      reloading = true;
      location.reload();
    };
    tryReload();
  });
}
