// Settings (screen 08), a bottom sheet:
//   Household · Appearance · Show amounts as (+ Cup size) · Import from web ·
//   Your data (Import recipes from BLOC, Back up recipes, Restore).
// Appearance and units are per device (prefs.js); everything under
// Household and Your data is the household's.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { openSheet, sheetHead, confirmSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import * as state from '../state.js';
import * as storage from '../storage.js';
import { supabase } from '../supabase.js';
import { getPrefs, setPref, getAiKey, setAiKey } from '../prefs.js';
import { makeBackup, parseBackup } from '../lib/backup.js';
import { openBlocImport } from './bloc-import.js';

export const VERSION = '1.0';

export function openSettings({ onSignOut }) {
  const body = h('div', { class: 'settings' });
  const sheet = openSheet(body, { kind: 'bottom', label: 'Settings' });
  let household = null;

  storage.householdInfo(state.get().householdId).then((info) => { household = info; render(); }).catch(() => {});

  const seg = (label, options, value, onPick) => h('div', { class: 'seg sm', role: 'group', 'aria-label': label },
    options.map(([v, text]) => h('button', { type: 'button', 'aria-pressed': String(value === v), onclick: () => { onPick(v); render(); } }, text)));
  const row = (ic, title, sub, { onclick, end = null } = {}) => h(onclick ? 'button' : 'div', { class: 'row', type: onclick ? 'button' : null, onclick },
    icon(ic), h('span', { class: 'txt' }, h('b', {}, title), sub ? h('span', {}, sub) : null),
    end ?? (onclick ? h('span', { class: 'end' }, icon('chevron-right')) : null));

  function render() {
    const prefs = getPrefs();
    const email = state.get().user?.email ?? (storage.isDemo ? 'the demo' : '');
    const members = household?.members;
    clear(body,
      sheetHead('Settings', { onClose: () => sheet.close() }),

      h('div', { class: 'group' }, h('span', { class: 'label' }, 'Household'),
        h('div', { class: 'list' },
          row('users', members > 1 ? `You and ${members - 1} other${members > 2 ? 's' : ''}` : 'Just you so far',
            'Recipes and products are shared with everyone in your household'),
          row('key', household?.code ? `Household code · ${household.code}` : 'Household code',
            'The same code as Listly and Shared Ledger. Give it to the other person to join.',
            { onclick: household?.code ? () => navigator.clipboard?.writeText(household.code).then(() => toast('Code copied')) : null, end: household?.code ? h('span', { class: 'end small' }, 'Copy') : null }),
          row('link', 'Join a household', 'Enter someone else’s code', { onclick: join }),
          row('logout', 'Sign out', email ? `Signed in as ${email}` : null, { onclick: signOut }))),

      h('div', { class: 'group' }, h('span', { class: 'label' }, 'Appearance'),
        seg('Theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], prefs.theme, (v) => setPref('theme', v))),

      h('div', { class: 'group' }, h('span', { class: 'label' }, 'Show amounts as'),
        seg('Amounts', [['original', 'Original'], ['written', 'As written'], ['metric', 'Metric'], ['cups', 'Cups']], prefs.amounts, (v) => setPref('amounts', v)),
        h('span', { class: 'label sub-label' }, 'Cup size'),
        seg('Cup size', [['metric', 'Metric · 250 ml'], ['us', 'US · 237 ml']], prefs.cup, (v) => setPref('cup', v))),

      h('div', { class: 'group' }, h('span', { class: 'label' }, 'Import from web'), importKeyGroup()),

      h('div', { class: 'group' }, h('span', { class: 'label' }, 'Your data'),
        h('div', { class: 'list' },
          row('upload', 'Import recipes from BLOC', 'Choose a BLOC backup, then pick which recipes', { onclick: () => openBlocImport() }),
          row('download', 'Back up recipes', 'Save every recipe and product as a file', { onclick: backup }),
          restoreRow())),
      h('p', { class: 'footer-note' }, `Pinch ${VERSION}${storage.isDemo ? ' · demo' : ''}`));
  }

  // As in BLOC: the key is entered once, kept on this device, and sent only
  // to Anthropic when an import needs Claude.
  function importKeyGroup() {
    const has = Boolean(getAiKey());
    const input = h('input', { class: 'input', type: 'password', autocomplete: 'off', placeholder: 'sk-ant-\u2026', 'aria-label': 'Your Claude API key' });
    return h('div', { class: 'list padded' },
      row('key', has ? 'Claude key saved on this phone' : 'Add your Claude API key',
        'For links without recipe data, and lines Pinch can\u2019t read on its own. Stored on this phone only and sent only to Anthropic.'),
      h('div', { class: 'key-row' },
        has ? h('button', { class: 'btn secondary', type: 'button', onclick: () => { setAiKey(''); render(); toast('Key removed from this phone'); } }, 'Remove key')
          : [input, h('button', { class: 'btn primary', type: 'button', onclick: () => { if (input.value.trim()) { setAiKey(input.value); render(); toast('Key saved on this phone'); } } }, 'Save')]));
  }

  function restoreRow() {
    const input = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', onchange: restore });
    return h('label', { class: 'row' }, input, icon('upload'),
      h('span', { class: 'txt' }, h('b', {}, 'Restore from a backup'), h('span', {}, 'Adds back any recipe or product in a Pinch backup')),
      h('span', { class: 'end' }, icon('chevron-right')));
  }

  // The share sheet (AirDrop, Save to Files…) where the device has one: a
  // download link inside an installed iOS app opens a blank page instead.
  // Elsewhere, a plain download.
  async function backup() {
    const s = state.get();
    const data = makeBackup({ recipes: s.recipes, products: s.products });
    const name = `pinch-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const json = JSON.stringify(data, null, 2);
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Pinch backup' });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // the person closed the sheet
      }
    }
    const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function restore(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (parsed.error) { toast(parsed.error, { error: true }); return; }
    const ok = await confirmSheet({
      title: 'Restore this backup?',
      body: `${parsed.recipes.length} recipes and ${parsed.products.length} products. Any with the same id are replaced by the backup’s copy; nothing else changes.`,
      confirm: 'Restore',
    });
    if (!ok) return;
    try {
      for (const p of parsed.products) await state.saveProduct(p);
      for (const r of parsed.recipes) await state.saveRecipe(r);
      toast(`Restored ${parsed.recipes.length} recipes`);
    } catch (err) {
      toast(err.message, { error: true });
    }
  }

  function join() {
    const input = h('input', { class: 'input code', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'ABC123', 'aria-label': 'Household code', autofocus: true });
    const note = h('p', { class: 'hint' }, 'If you’re the only person in your household now, your recipes come with you. If someone else is still in it, they stay with them.');
    const s = openSheet(h('div', { class: 'join' },
      sheetHead('Join a household', { onBack: () => s.close(), onClose: () => s.close() }),
      input, note,
      h('button', { class: 'btn primary big', type: 'button', onclick: go }, 'Join')), { kind: 'bottom', label: 'Join a household' });
    async function go() {
      const code = input.value.trim();
      if (!code) return;
      try {
        await storage.joinHousehold(code);
        toast('Joined. Reloading…');
        // The household id in memory is stale the moment the join lands.
        setTimeout(() => location.reload(), 900);
      } catch (err) {
        note.textContent = err.message;
        note.classList.add('field-error');
      }
    }
  }

  async function signOut() {
    const ok = await confirmSheet({ title: 'Sign out?', body: 'Your recipes stay in your household. Sign in again to see them.', confirm: 'Sign out' });
    if (!ok) return;
    await sheet.close({ force: true });
    if (!storage.isDemo) await supabase.auth.signOut().catch(() => {});
    storage.clearCache();
    onSignOut?.();
  }

  render();
  return sheet;
}
