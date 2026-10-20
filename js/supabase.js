// One supabase-js client for Pinch, defaulting to the `pinch` schema, loaded
// as a pinned ES module (no bundler in this repo).
//
// · The publishable key is safe in a public repo: RLS protects the data.
// · 🚨 auth.storageKey is Pinch's own. Every app of Adam's shares the
//   adamnc02.github.io origin, and the default key would make Pinch read and
//   overwrite another app's session.
// · flowType 'pkce': the OAuth return arrives as ?code=, which leaves the
//   #/recipe/<id> hash routes alone.
// · `pinch` must be in the project's Exposed schemas, or every call fails
//   PGRST106 (MIGRATION-LESSONS §20). schemaProblem() says so in words.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';

export const SUPABASE_URL = 'https://nxekrfdagkdwhjuunsrl.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_hv-9Mb3Y36PklJ2Yo4KBhw_XEy3z5lP';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  db: { schema: 'pinch' },
  auth: {
    storageKey: 'pinch.auth',
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// The ledger's household functions: Pinch reuses that household, so the
// link code Adam and Ella already share links Pinch too.
export const sfl = () => supabase.schema('shared_finance_ledger');

// Where OAuth and email links come back to: this page, with no query or hash.
// It must be on the project's Redirect URLs allow-list, or Supabase silently
// sends the browser to the Site URL instead (MIGRATION-LESSONS §2).
export const redirectTarget = () => `${location.origin}${location.pathname}`;

export function schemaProblem(error) {
  if (error?.code === 'PGRST106') {
    return 'The pinch schema isn’t exposed to the Data API yet. Add it under Project Settings › API › Exposed schemas.';
  }
  return null;
}
