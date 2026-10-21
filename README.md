# Pinch

The household's recipe library: a phone-first PWA for Adam and Ella's recipes, with servings
scaling, unit conversion, method steps tagged with the ingredients they use, and per-serving
nutrition from a shared product library that each person's BLOC can read.

Live at **https://adamnc02.github.io/pinch/**, served by GitHub Pages from the root of `main`, and
made to be installed on an iPhone Home Screen. **Status: 1.2.**

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

- **Home:** recipes as cards, by meal (Breakfast / Lunch / Dinner / Sauces) or by cuisine (a chip per cuisine
  in use, with its flag). A card shows its photo, or its cuisine's flag.
- **The recipe sheet:** a servings stepper that rescales every amount one serving at a time,
  Ingredients | Method with a card flip, each step's tagged ingredients in italics (scaled), the ways to
  cook it after the method (Air fryer · 12 min · 200°C, with a note), and per-serving kcal, protein, carbs
  and fat.
- **Adding recipes:** type them in (with Scan barcode or Add manually for each ingredient), or import
  from the web by pasting a link or the recipe's text. Either way the result lands in **Check
  ingredients**, which links each ingredient to a product. Nothing needs a barcode to be saved: an
  ingredient without a product is marked "needs nutrition" and can be scanned later from the recipe.
- **Seasonings:** an ingredient marked Seasoning (spices, herbs, salt) is never counted for nutrition,
  never asks for a barcode and never stops BLOC using the recipe. Pinch suggests it for names like
  paprika or cumin.
- **Cooking options:** any number per recipe, each a method (air fryer, oven, fan oven, hob, grill,
  microwave, BBQ, slow cooker or your own), a time, a temperature and a note.
- **Products:** the household's library, found by barcode (Open Food Facts), by name, or typed in from
  the label. Products hold all the nutrition, and a linked product can be edited from the ingredient —
  including the weight of one item, which "2 eggs" needs against a per-100 g product.
- **Send to Listly:** long-press a recipe card (or tap the basket on a recipe) to put its ingredients, scaled to the
  servings you choose, on one of the household's Listly shopping lists as "Plain flour (500 g)". Items already on that
  list, and "to taste" ones, start unticked.
- **Tablets:** a wider grid and centred panels, and Ingredients and Method side by side (a switch in Settings).
- **Settings:** theme, side by side, Nutrition and barcodes (off hides nutrition and the barcode prompts, for people
  who don't use BLOC; saved on the account), amounts original / as written / metric / cups, cup size, temperatures in °C or
  °F (saved on the account), the household code, an optional
  Claude key (kept on the phone, as in BLOC), backup and restore, and the one-off import from a BLOC
  backup.

## Rules that must not be quietly undone

### Only the amount as written is stored.

An ingredient stores its `qty` and `unit` exactly as the recipe gave them. Scaled amounts, metric and
cup display are all computed for display (`js/lib/scale.js`, `js/lib/format.js`). The stepper never
changes `serves`, and nothing the display does is saved.

### Conversions only go to or from cups. Grams and millilitres are never converted.

Volume units convert by fixed arithmetic; g ↔ cup needs the ingredient's density; **g ↔ ml is never
offered** and returns an error rather than a guess. A stored `cup` is a metric 250 ml cup; US cups are
a display setting. Cups show ¼ ½ ¾ only when the value really is that quarter (BLOC's `fmtInch` rule)
and "≈" when a value was snapped. The database's nutrition view follows the same rule, the app's
density table (`js/lib/densities.js`, 187 foods) must equal the `pinch.densities` seed, and both find a density the same
way (whole name, then the longest known food named in it) — behaviour tests in `silver-octo-invention` fail otherwise.
In cups mode a weighed ingredient with no density stays as written, with a note; **Look up cup measures** asks Claude
(the device's key) and adds what it finds to the shared table.

### Nutrition lives only on products, and is computed once, in SQL.

Recipes and ingredients have no macro columns. Per-serving figures come only from
`pinch.recipe_nutrition`; an ingredient whose amount can't reach its product's basis is reported
missing, never estimated. A seasoning, like an ingredient "to taste", is not counted at all. The app's
`nutritionStatus()` mirrors the rule only to show the status of a draft that isn't saved yet.

### Step tags are ingredient ids, never names or copied amounts.

A step's `ingredientIds` reference ingredients by id, made when the form row is created, so a step can
tag an ingredient added in the same unsaved edit, renaming or reordering ingredients never breaks a
tag, and the stepper scales the italic line. Removing an ingredient removes its tags (in the app and
by cascade in the database).

### A recipe is saved by one call, `pinch.save_recipe`, or not at all.

The recipe, its ingredients, steps, tags and cooking options go in one function call, which is one
transaction. Do not replace it with several table writes: they can fail halfway. A payload without
`seasoning` or `cooking` (a phone on an older Pinch) leaves those as stored; the app always sends both.

### Temperatures are stored in °C.

A cooking option's temperature is a whole number of °C. °F is only how a person chooses to read and type
it.

### Everything is namespaced on the shared origin.

All of Adam's apps are on `adamnc02.github.io`. Pinch's localStorage keys start with `pinch.`, its
caches with `pinch-`, its service worker is scoped to `/pinch/`, and supabase-js uses its own
`auth.storageKey` (`pinch.auth`). Every path in the app is relative.

### BLOC reads only the versioned views.

BLOC (a separate Supabase project) reads `pinch.bloc_recipes_v1` and `pinch.bloc_recipe_ingredients_v1`
and nothing else. A breaking change ships as `_v2`; `_v1` is never edited. Recipes are edited only in
Pinch. There is no export and no two-way sync.

### A Claude key never leaves the phone except to Anthropic.

As in BLOC, each person's key is saved once in Settings, kept in this device's localStorage, and
sent only to `api.anthropic.com` from the browser (`js/claude.js`). The `pinch-import` Edge Function
only fetches pages and holds no key. Do not move Claude calls to a server, or add a shared key,
without deciding that again.

### Names are shown without a "(Meal) " prefix; a stored one is kept.

BLOC names recipes "(Dinner) Carbonara", and a recipe imported from BLOC keeps that name. Pinch has the meal as its own
field, so every screen shows the name without a leading bracketed meal (`displayName` in `js/lib/recipes.js`), the
editor's name field edits only the part after it, and saving puts the stored prefix back unchanged. BLOC shows every
household recipe as "(Meal) Name" from the meal field, so a recipe made in Pinch needs no prefix.

### Pinch writes to Listly only the way Listly does.

Send to Listly inserts `listly.shopping_items` rows exactly as Listly's own `insertItem()` would (its id shape, its
append position, `never_had_items` set false, `user_id` and `created_at` left to the database) and nothing else. It never
writes `shop_completions`, the ledger bridge. Amounts on a list are always metric, whatever Show amounts as says.

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
pass/fail counts (164 tests over the pure logic in `js/lib/`). The database side is tested in
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
