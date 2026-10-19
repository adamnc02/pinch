# Pinch

The household's recipe library: a phone-first PWA for Adam and Ella's recipes, with servings
scaling, unit conversion, method steps tagged with the ingredients they use, and per-serving
nutrition from a shared product library that each person's BLOC can read.

Live at **https://adamnc02.github.io/pinch/**, served by GitHub Pages from the root of `main`, and
made to be installed on an iPhone Home Screen. **Status: 1.0.**

## Stack

Vanilla JavaScript with native ES modules · plain CSS from design tokens · Supabase (auth, Postgres,
Storage, one Edge Function). **No framework, no bundler, no npm and no build step**: the files in this
repo are what the browser runs.

Pinch is the **fifth app** on the shared Supabase project (`nxekrfdagkdwhjuunsrl`), in its own `pinch`
schema, and reuses `shared_finance_ledger`'s household like Listly does — so the household code Adam
and Ella already share links Pinch too. It does not use PowerSync. Its migrations, checks, behaviour
tests and the `pinch-import` Edge Function live in
[`silver-octo-invention`](https://github.com/adamnc02/silver-octo-invention)
(`docs/pinch-SUPABASE.md`).

## What it does

- **Home:** recipes as cards, by meal (Breakfast / Lunch / Dinner) or by cuisine (a chip per cuisine
  in use, with its flag). A card shows its photo, or its cuisine's flag.
- **The recipe sheet:** a servings stepper that rescales every amount one serving at a time,
  Ingredients | Method with a card flip, each step's tagged ingredients in italics (scaled), and
  per-serving kcal, protein, carbs and fat.
- **Adding recipes:** type them in (with Scan barcode or Add manually for each ingredient), or import
  from the web by pasting a link or the recipe's text. Either way the result lands in **Check
  ingredients**, which links each ingredient to a product.
- **Products:** the household's library, found by barcode (Open Food Facts), by name, or typed in from
  the label. Products hold all the nutrition.
- **Settings:** theme, amounts as written / metric / cups, cup size, the household code, an optional
  personal Claude key, backup and restore, and the one-off import from a BLOC backup.

## Rules that must not be quietly undone

### Only the amount as written is stored.

An ingredient stores its `qty` and `unit` exactly as the recipe gave them. Scaled amounts, metric and
cup display are all computed for display (`js/lib/scale.js`, `js/lib/format.js`). The stepper never
changes `serves`, and nothing the display does is saved.

### Conversions only go to or from cups. Grams and millilitres are never converted.

Volume units convert by fixed arithmetic; g ↔ cup needs the ingredient's density; **g ↔ ml is never
offered** and returns an error rather than a guess. A stored `cup` is a metric 250 ml cup; US cups are
a display setting. Cups show ¼ ½ ¾ only when the value really is that quarter (BLOC's `fmtInch` rule)
and "≈" when a value was snapped. The database's nutrition view follows the same rule, and the app's
density table (`js/lib/densities.js`) must equal the `pinch.densities` seed — a behaviour test in
`silver-octo-invention` fails if they differ.

### Nutrition lives only on products, and is computed once, in SQL.

Recipes and ingredients have no macro columns. Per-serving figures come only from
`pinch.recipe_nutrition`; an ingredient whose amount can't reach its product's basis is reported
missing, never estimated. The app's `nutritionStatus()` mirrors the rule only to show the status of a
draft that isn't saved yet.

### Step tags are ingredient ids, never names or copied amounts.

A step's `ingredientIds` reference ingredients by id, made when the form row is created, so a step can
tag an ingredient added in the same unsaved edit, renaming or reordering ingredients never breaks a
tag, and the stepper scales the italic line. Removing an ingredient removes its tags (in the app and
by cascade in the database).

### A recipe is saved by one call, `pinch.save_recipe`, or not at all.

The recipe, its ingredients, steps and tags go in one function call, which is one transaction. Do not
replace it with several table writes: they can fail halfway.

### Everything is namespaced on the shared origin.

All of Adam's apps are on `adamnc02.github.io`. Pinch's localStorage keys start with `pinch.`, its
caches with `pinch-`, its service worker is scoped to `/pinch/`, and supabase-js uses its own
`auth.storageKey` (`pinch.auth`). Every path in the app is relative.

### BLOC reads only the versioned views.

BLOC (a separate Supabase project) reads `pinch.bloc_recipes_v1` and `pinch.bloc_recipe_ingredients_v1`
and nothing else. A breaking change ships as `_v2`; `_v1` is never edited. Recipes are edited only in
Pinch. There is no export and no two-way sync.

### Sign-in is required. There is no guest mode.

Recipes live in the household on the server. `?demo` runs the sample recipes in one browser for
trying Pinch out; it never touches the server.

## Running it locally

Serve the folder over HTTP (ES modules don't load from `file://`):

```sh
python3 -m http.server 8000
```

- Mac: http://localhost:8000/
- Phone on the same Wi-Fi: http://<Mac LAN IP>:8000/

Add `?demo` to either to use the sample recipes without signing in. Signing in from localhost needs
`http://localhost:8000/**` on the project's Redirect URLs list. The camera, install and the service
worker need https, so test those on the live URL.

## Tests

Open **http://localhost:8000/tests.html** — the browser test kit runs every `tests/*.test.js` and shows
pass/fail counts (108 tests over the pure logic in `js/lib/`). The database side is tested in
`silver-octo-invention/tools/schema-test` (`npm run check:pinch`, `npm run behaviour:pinch`).

## Deploying

Merging to `main` deploys: GitHub Pages serves the repo root.

1. Bump `VERSION` in `sw.js` (`v1` → `v2`) whenever a file in its `SHELL_FILES` list changes, or
   installed phones keep the old copy. Add any new shell file to that list.
2. Merge the PR.
3. Check the served bytes, not the Pages badge:
   `curl -s https://adamnc02.github.io/pinch/sw.js | grep VERSION`.

## Documents

| File | What it is |
|---|---|
| `TECHNICAL.md` | How the app is built, module by module |
| `silver-octo-invention/docs/pinch-SUPABASE.md` | The schema, RLS, nutrition views, BLOC contract, photos and the import function |
