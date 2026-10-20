// Sign in. Pinch needs an account from its first screen: recipes live in
// the household on the shared project, with the same login as Listly and
// the ledger. Google, or email and password.

import { h, clear } from '../components/dom.js';
import { supabase, redirectTarget } from '../supabase.js';

export function mountSignIn(root) {
  let mode = 'signin';
  let error = null;
  let note = null;
  let busy = false;

  // A provider error comes back in the query (PKCE) or the hash.
  const params = new URLSearchParams(location.search);
  const urlError = params.get('error_description') ?? params.get('error');
  if (urlError) {
    error = `Sign-in was refused: ${urlError}`;
    history.replaceState(null, '', location.pathname);
  }

  const email = h('input', { class: 'input', type: 'email', id: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const password = h('input', { class: 'input', type: 'password', id: 'password', autocomplete: 'current-password' });

  async function run(fn) {
    busy = true; error = null; note = null; render();
    try { await fn(); } catch (e) { error = e.message ?? String(e); }
    busy = false; render();
  }

  const google = () => run(async () => {
    const { error: e } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectTarget() } });
    if (e) throw e;
  });

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      if (!email.value || !password.value) throw new Error('Enter both an email and a password.');
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email: email.value, password: password.value, options: { emailRedirectTo: redirectTarget() } });
        if (err) throw err;
        if (!data.session) { mode = 'signin'; note = 'Check your email to confirm the account, then sign in.'; }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });
        if (err) throw err;
      }
    });
  };

  const reset = () => run(async () => {
    if (!email.value) throw new Error('Enter your email above first.');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.value, { redirectTo: redirectTarget() });
    if (err) throw err;
    note = 'If that email has an account, a reset link is on its way.';
  });

  function render() {
    password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    clear(root,
      h('div', { class: 'signin' },
        h('h1', { class: 'wordmark big' }, 'Pinch'),
        h('p', { class: 'tagline' }, 'Your household’s recipes, in one place.'),
        h('button', { class: 'btn primary big', type: 'button', disabled: busy, onclick: google }, 'Continue with Google'),
        h('div', { class: 'or', 'aria-hidden': 'true' }, h('span', {}, 'or')),
        h('form', { class: 'signin-form', onsubmit: submit },
          h('div', { class: 'field' }, h('label', { for: 'email' }, 'Email'), email),
          h('div', { class: 'field' }, h('label', { for: 'password' }, 'Password'), password),
          h('button', { class: 'btn secondary big', type: 'submit', disabled: busy }, mode === 'signup' ? 'Create account' : 'Sign in')),
        h('div', { class: 'signin-links' },
          h('button', { class: 'btn quiet', type: 'button', onclick: () => { mode = mode === 'signup' ? 'signin' : 'signup'; error = null; render(); } },
            mode === 'signup' ? 'I already have an account' : 'Create an account'),
          mode === 'signin' ? h('button', { class: 'btn quiet muted', type: 'button', onclick: reset }, 'Forgot password') : null),
        error ? h('p', { class: 'field-error', role: 'alert' }, error) : null,
        note ? h('p', { class: 'note', role: 'status' }, note) : null,
        h('p', { class: 'hint center' }, 'Use the same account as Listly and Shared Ledger, so your household’s recipes are here.')));
  }

  render();
}
