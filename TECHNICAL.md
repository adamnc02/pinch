# Pinch — technical reference

How Pinch is built, module by module. The rules that must not be quietly undone are in `README.md`;
the database is in `silver-octo-invention/docs/pinch-SUPABASE.md`.

## Table of contents

1. [Stack and shape](#1-stack-and-shape)
2. [Boot](#2-boot)
3. [Design tokens and CSS](#3-design-tokens-and-css)
4. [The data model](#4-the-data-model)
5. [state.js and storage.js](#5-statejs-and-storagejs)
6. [Per-device preferences](#6-per-device-preferences)
7. [Routing](#7-routing)
8. [Sheets](#8-sheets)
9. [Home](#9-home)
10. [The recipe sheet](#10-the-recipe-sheet)
11. [The editor and the method editor](#11-the-editor-and-the-method-editor)
12. [Add ingredient and products](#12-add-ingredient-and-products)
13. [The barcode scanner](#13-the-barcode-scanner)
14. [Check ingredients](#14-check-ingredients)
15. [Import from the web](#15-import-from-the-web)
16. [Settings, household, backup](#16-settings-household-backup)
17. [Import from BLOC](#17-import-from-bloc)
18. [Amounts: scaling, units and formatting](#18-amounts-scaling-units-and-formatting)
19. [Flags](#19-flags)
20. [Service worker, splash and deploy](#20-service-worker-splash-and-deploy)
21. [Tests](#21-tests)
22. [Limits](#22-limits)

---

## 1. Stack and shape

Vanilla JavaScript ES modules, loaded straight from the files. `index.html` loads one classic script
(`js/theme-param.js`, before first paint) and one module (`js/app.js`); everything else arrives
through imports. Third-party code is two pinned CDN files: supabase-js
(`cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm`) and, only when the scanner needs a
fallback, ZXing (`@zxing/library@0.21.3`).

```
index.html            the shell: splash markup, #home, #signin, #layers
sw.js                 service worker (§20)
manifest.webmanifest  relative paths, scope ./
tests.html, tests/    the browser test kit (§21)
css/
  tokens.css          the design tokens, light and dark — the source of truth
  base.css            element defaults, svg.i, .icon-btn, .visually-hidden
  home.css            Home and sign-in
  components.css      controls and every sheet (screens 03–15)
  splash.css          the launch splash
js/
  app.js              boot, auth, routes, splash, service worker registration
  claude.js           Claude from the browser with this device's key (as BLOC)
  supabase.js         the client (pinch schema, own storageKey, PKCE)
  storage.js          the only module that touches Supabase or stored data
  state.js            the one in-memory source of truth, with subscribe()
  prefs.js            per-device settings
  router.js           hash routes
  demo-data.js        the sample recipes for ?demo
  components/         dom (h), icons, flag, sheet, stepper, toast, photo
  views/              home, recipe-sheet, editor, ingredient, product, scanner,
                      check, settings, bloc-import, signin
  lib/                pure functions, all tested: recipes, scale, units, format,
                      densities, method, validate, rows, backup, off, parse,
                      bloc-import, claude-shape, cuisines, ids
icons/, fonts/        app icon set, the sprite, self-hosted Plus Jakarta Sans
```

`js/components/dom.js` exports `h(tag, attrs, ...children)`. Children that are strings become text
nodes, so recipe names, steps and product names can never be parsed as HTML. The only `innerHTML` in
the app is `flag.js`, from constant SVG strings.

## 2. Boot

`app.js`, in order:

1. `applyTheme()` (the pre-paint script already set `data-theme`).
2. The splash in `index.html` is already playing (§20).
3. **Demo** (`?demo`): Home with the sample data, no auth.
4. Otherwise `supabase.auth.getSession()`. A session shows Home and calls `state.start(user)`; none
   shows sign-in. A PKCE return (`?code=`) is exchanged by supabase-js and then stripped from the
   address bar. `onAuthStateChange` switches between the two when the user id changes.
5. When state leaves `loading`, the splash is dismissed and the current route is shown.

**Sign-in** (`views/signin.js`) offers Google OAuth and email/password, with sign-up and password
reset. Every redirect is `redirectTarget()` — this page's origin and path — which must be on the
project's Redirect URLs list or Supabase silently sends the browser to the Site URL instead.

## 3. Design tokens and CSS

`css/tokens.css` is the design's token file, unchanged: colour (light, and dark by OS or
`data-theme`), Plus Jakarta Sans (self-hosted woff2, so it works offline), type sizes, radii, the
44 px `--tap`, shadows, and the two photo fades. Nothing else defines a colour except the error reds
(`#B3261E` / `#8A1F17`, dark `#F2B8B2`) and the camera's fixed palette.

Theme: `data-theme` on `<html>`. `js/theme-param.js` sets it before the first paint from `?theme=`
or `pinch.prefs.theme`; `prefs.applyTheme()` keeps it and both `theme-color` metas in step.

Home's page edge fades follow BLOC and Listly: anchored to the scrolling box, built from
`rgb(var(--bg-rgb) / 0)` (never `transparent`, which some browsers interpolate through black), and
`pointer-events: none` so a fade never swallows a tap.

## 4. The data model

```js
Recipe     { id, name, serves, meal, cuisine, photoPath, blocRecipeId, ingredients[], steps[] }
Ingredient { id, name, qty, unit, productId }     // qty null = don't scale
Step       { id, text, ingredientIds[] }          // tags, in ingredient-list order
Product    { id, name, brand, barcode, basis, kcal, protein, carbs, fat, gramsPerItem, source }
Nutrition  { kcal, protein, carbs, fat, counted, missing, notCounted, complete }  // per serving
```

- `meal` ∈ `breakfast | lunch | dinner`; `cuisine` is an ISO alpha-2 code or null.
- `unit` ∈ `g kg ml l tsp tbsp cup each`, `to taste`.
- `basis` ∈ `100g | 100ml | item`; `source` ∈ `label | off | bloc`.
- Ids are `crypto.randomUUID()`, made when the row is created (`lib/ids.js`).
- `lib/rows.js` maps the four tables to this shape and back (`rowsToRecipes`, `recipeToPayload`),
  ordered by `position`; `rowToProduct`, `productToRow`, `rowToNutrition` do the rest.

## 5. state.js and storage.js

**`state.js`** holds `{ user, householdId, recipes, products, nutrition, ingredientStatus,
densities, status, error }`. Views call `subscribe(fn)` and re-render; only its actions change
data, and each writes through `storage.js` first:

| Action | Does |
|---|---|
| `start(user)` | shows the cached copy at once (if any), then `ensureHousehold()` + `loadAll()`. On failure with a cache: `status: 'offline'`; without: `'error'`. |
| `saveRecipe(recipe)` | `save_recipe`, then refreshes that recipe's nutrition from the views |
| `deleteRecipe(id)` | removes the photo through the Storage API, then deletes the row (in that order: for a recipe that moved household, the row naming the file is what lets this household delete it) |
| `saveProduct(p)` / `deleteProduct(id)` | upsert / delete, then refresh nutrition for every recipe using it |

Lookups: `getRecipe`, `getProduct`, `productByBarcode`, `searchProducts(text)` (every word must
match name or brand), `matchProduct(name)` (exact name, then singular/plural), and
`densityForIngredient(i)`.

**`storage.js`** is the only module that talks to Supabase or to stored data. Two backends behind
one interface:

- **supabase** — `loadAll` reads the four recipe tables, products, both nutrition views and
  densities in parallel (paged at 1000 rows), and stores the result in `localStorage['pinch.cache.v1']`
  with the user id, so Pinch opens offline with what it last saw. Writes need a connection.
- **demo** (`?demo`) — `demo-data.js` in `localStorage['pinch.demo.v1']`, with a small in-browser
  nutrition calculation. Never touches the network.

Errors are turned into sentences: PGRST106 says `pinch` isn't in Exposed schemas; offline says so.

The household id comes from `shared_finance_ledger.ensure_household()`. It is never cached across
sessions; joining another household reloads the page so no write can use a stale id.

## 6. Per-device preferences

`localStorage['pinch.prefs']`: `theme` (`system | light | dark`), `amounts`
(`written | metric | cups`), `cup` (`metric | us`), `homeMode` (`meal | cuisine`). Not synced: two
people can read one recipe in different units. `onPrefs(fn)` lets the open recipe sheet re-render
when they change.

`localStorage['pinch.anthropicKey']` is the person's own Claude key, entered once in Settings, as in
BLOC. It stays on this device and is sent only to `api.anthropic.com`, by `js/claude.js`.

## 7. Routing

Hash routes, so back, forward, refresh and deep links work on GitHub Pages:

| Hash | Shows |
|---|---|
| `#/` (or none) | Home |
| `#/recipe/<uuid>` | Home with that recipe's sheet open |

Tapping a card calls `openRecipe(id)`, which `pushState`s `{ pinchFromHome: true }`. Closing the sheet
calls `leaveRecipe()` (idempotent until the next route change): `history.back()` when Home pushed it, otherwise (a deep link) a `replaceState`
to `#/`, so Back never reopens a closed recipe. An unknown id shows "That recipe isn't in your
household" and goes Home. Add recipe and Settings are not routed.

## 8. Sheets

`components/sheet.js` — `openSheet(content, { kind, label, onClose, beforeClose })`:

- `kind: 'centre'` — the recipe sheet: full width minus 16 px, 28 px radius, centred.
- `kind: 'bottom'` — every other sheet: grab handle, from 44 px below the top.
- `kind: 'camera'` — the full-screen scanner, no scrim.

`role="dialog"`, `aria-modal`, focus moved in and trapped (Tab / Shift-Tab), **Esc and a scrim tap
close the top sheet**, focus returns to the opener. Sheets **stack**: opening one makes the one below
`inert` and hidden until the top closes, so a sub-screen's Back returns exactly where the cook was
(the scan result keeps the camera visible below it). `beforeClose()` can refuse — the editor uses it
for "Discard changes?" and to stay open while a save or import is in flight; Check ingredients opened
from a saved recipe asks before discarding its changes. `confirmSheet()` is a small centred yes/no; `sheetHead()` is the
Back / title / Close row.

## 9. Home

`views/home.js` (screens 01, 02). The header (wordmark, Settings), `By meal | By cuisine`, the chip
row, the grid between the two edge fades, and the 60 px add button.

- Chips: By meal is `All · Breakfast · Lunch · Dinner`; By cuisine is `All` plus
  `cuisinesInUse(sorted recipes)`, each with a 20×14 flag. Switching mode resets to All; a cuisine
  whose last recipe is deleted falls back to All. The mode is remembered per device.
- Cards are alphabetical, 200 px, two columns (three from 560 px). A card is a `<button>` with
  `data-recipe`; **one click listener on the grid** handles every card. Photo cards load a signed URL
  (§12); others show the 60×40 flag on `--sunk`.
- Loading shows skeleton cards; offline or error shows a notice with Try again; an empty filter
  says so.

## 10. The recipe sheet

`views/recipe-sheet.js` (screens 03, 04).

- **Hero:** the photo (or the flag on `--sunk`), the `--fade-sheet` fade, `MEAL · CUISINE`, Close, the
  edit pencil, the title (two lines max).
- **Servings:** opens at `recipe.serves`; − / + by one, minimum 1. Every amount is
  `scaleRecipe(recipe, servings)` then `formatAmount(...)` with the current prefs. Nothing is saved.
- **Ingredients | Method:** real tab buttons with `aria-selected`. Switching flips the content with
  the Web Animations API — 225 ms to 90°, swap, 225 ms back — so the face can change height; the
  header stays still. With `prefers-reduced-motion` it cross-fades.
- **Method:** numbered steps; under each, `stepLine(recipe, step, servings, opts)` in italics.
- **Nutrition** (under Ingredients): per serving from `recipe_nutrition` — it does not change with the
  stepper — and, when any ingredient is missing, "N need nutrition" with their names, which opens
  Check ingredients and saves from there.

The sheet re-renders when state or prefs change, and closes itself if the recipe is deleted.

## 11. The editor and the method editor

`views/editor.js` (screens 05, 06, 14, 15). It edits a **copy**; nothing reaches state until Save.

- New recipes start on two tiles, **Enter ingredients** and **Import from web** (§15).
- Fields: name; Serves stepper (1–100); Cuisine (a native `<select>` laid invisibly over a styled box
  showing the flag, so the phone's own picker opens); Meal (three buttons); optional photo.
- **Photo:** chosen with a file input, resized on the device (`components/photo.js`: longest side
  1600 px, JPEG 0.82), previewed, and uploaded only on Save to
  `pinch-photos/<household_id>/<recipe_id>-<suffix>.jpg`. Replacing or removing it deletes the old
  file just before the save, for the same reason as `deleteRecipe`; an uploaded file is reused if the
  save is retried.
- **Ingredients:** Scan barcode or Add manually; each row opens Add ingredient to edit or delete.
  "needs nutrition" marks rows without a product, and "Check ingredients · N need nutrition" opens
  §14 on the draft.
- **Method editor:** steps are free text, numbered, and one is open at a time with its textarea and
  "Tap the ingredients this step uses" chips (a pressed chip shows a check). Arrows move a step
  (`moveStep`), the bin deletes it; there is no drag. Deleting an ingredient removes its tags
  (`removeIngredient`).
- **Save:** empty steps are dropped, `validateRecipe()` lists every problem at once, then the photo
  uploads and `state.saveRecipe()`. Closing with changes asks "Discard changes?".
- **Delete recipe** (edit only) asks first and says it goes for everyone in the household.

## 12. Add ingredient and products

`views/ingredient.js` (screen 09): name, amount, and a unit chip from the controlled list (`to taste`
clears the amount). Typing a name lists **household products** that match ("Nutrition · from your
products"); otherwise Scan barcode or From label. A linked product shows with Unlink. An ingredient
can be saved without a product.

`views/product.js` (screen 10): name, brand, optional barcode (6–14 digits, unique in the household),
nutrition per 100 g / 100 ml / item, all four macros required (0 is fine), optional weight of one
item (hidden for per-100 ml products). Saved to the household with `state.saveProduct()`.

Photos and Open Food Facts images are never stored as products; a product has no image.

## 13. The barcode scanner

`views/scanner.js` (screens 11, 12). The camera needs https, so it works on the live URL only.

- `getUserMedia({ facingMode: environment })` into a full-screen `<video>` with the corner guides
  and the scan line. The torch toggle shows only when the track reports `torch`.
- Detection: `BarcodeDetector` with EAN-13/8, UPC-A/E, Code 128 and ITF where available; otherwise
  ZXing's `MultiFormatReader` on a canvas frame, loaded the first time it's needed. Every 120 ms
  until a 6–14 digit code is found. A code that wasn't found, or couldn't be looked up, is not
  looked up again in the same scan; the camera pauses while a form is open over it and resumes when
  it closes.
- **Lookup order:** the household's own products first (labelled "In your products", no network
  call), then Open Food Facts v2 (`lib/off.js`, `mapOffProduct`). OFF data is shown "Check against
  the label" with Edit details / Use product; a product missing kcal (or any macro) can't be used
  until edited. Not found opens New product with the barcode filled in.
- Camera refused or missing: only "Type the number" and "Enter from the label", with one line saying
  why.

## 14. Check ingredients

`views/check.js` (screen 13). Opened after an import, from the editor, and from a recipe's
"N need nutrition".

- Progress: `N of M have nutrition`, where M is the ingredients that will be counted (not "to taste").
- Status per row uses `nutritionStatus()` (§18): done, needs nutrition, or "this amount can't be
  counted against it" when a product is linked but the units can't meet.
- **One row is open at a time**: Rename (opens Add ingredient), Delete, the amount, the unit switch,
  Scan / Products, From the label / Skip for now.
- **The unit switch converts the stored amount** using `unitOptions(unit, density)`: the
  ingredient's own unit plus cup, and cups can go to g (needs a density) or ml. A disabled option
  says why. Below it, the other units: "Same as 375 ml · about 200 g (plain flour density)". Into
  cups the amount snaps to a quarter; into g or ml it rounds.
- Sticky footer: `Scan next: <name>` and the finish button ("Next: the method" after an import,
  "Save recipe" from a saved recipe), with "· N can be finished later".

## 15. Import from the web

The **Import from web** tile: one box takes a link or the whole recipe's text, then Serves and Meal,
then **Read recipe**. A link shows "Link found · site".

- **A link** goes to the `pinch-import` Edge Function (`{ mode: 'url' }`), which only fetches the page
  (browsers can't, CORS). It returns the page's schema.org `Recipe` JSON-LD, or, when there is none,
  the page's text — which the app sends to Claude itself with this device's key
  (`claude.recipeFromPage`). With no key saved, the cook is asked to add one in Settings or paste the
  text. A page that can't be read (many large sites refuse server-side fetches with 403) asks for the
  text instead.
- **Text** is split in the app by `splitRecipeText()` (Ingredients / Method headings, or short
  amount lines vs. sentences).
- Either way `draftFromImport()` runs `parseIngredientLine()` on every ingredient line, gives every
  row a fresh id, maps the category to a meal and the cuisine words to a code, and pre-tags each step
  with the ingredients it names (`suggestTags`). **Serves and Meal come from the recipe when it says**,
  else from the form.
- Lines the parser can't read are sent once to Claude (`claude.splitLines`) when this device has a
  key; otherwise they stay as written for the cook to fix in Check ingredients.
- Ingredients whose name matches a household product are linked automatically, then Check
  ingredients opens, then the method editor.

**Claude, from the browser** (`js/claude.js`): the same pattern as BLOC — `fetch` to
`api.anthropic.com/v1/messages` with `x-api-key` (the device's key) and
`anthropic-dangerous-direct-browser-access: true`; model `claude-haiku-5-5`, effort `low`, a JSON
schema for the answer. `js/lib/claude-shape.js` holds the two schemas and turns each answer into
Pinch's shapes (tested). No Pinch server sees the key; the Edge Function holds none.

## 16. Settings, household, backup

`views/settings.js` (screen 08):

- **Household:** how many people share it; the household code (`create_household_link_code()`
  returns the existing one — the same code as Listly and Shared Ledger) with Copy; Join a household
  (`redeem_household_link_code()`, then a reload); Sign out (also clears the offline cache, the remembered photo URLs and the service worker's cached
  photos).
- **Appearance:** System / Light / Dark.
- **Show amounts as:** As written / Metric / Cups, and Cup size: Metric 250 ml / US 237 ml.
- **Import from web:** the Claude key field (password input), saved on this device only, with
  Remove — as BLOC's Settings.
- **Your data:** Import recipes from BLOC (§17); **Back up recipes** downloads
  `pinch-backup-<date>.json` (`makeBackup`: kind, version 1, recipes, products); **Restore from a
  backup** checks it with `parseBackup` (never throws) and upserts every product then every recipe,
  replacing any with the same id.

## 17. Import from BLOC

`views/bloc-import.js` with `lib/bloc-import.js`. A one-off bring-across from a BLOC backup: the full backup from
BLOC's Settings › My data › Backup › Export › Local file (BLOC's single-recipe share file is a different shape and is
refused as "no BLOC recipes").

1. `readBlocBackup()` keeps **only** each recipe's id, name, servings, ingredients and per-serving
   figures, and the food library's name, brand and barcode. Nothing else in the file is read, kept
   or uploaded.
2. The person ticks recipes and gives each a meal (required) and a cuisine (optional) — BLOC has
   neither. A recipe already imported (same `bloc_recipe_id`) is marked and will be replaced.
3. `mapBlocRecipe()` turns each ingredient into one linked to a product:
   - weight-based (`barcode`, `library`, `manual-weight`): qty = grams, unit g, product per 100 g
     from `per1*` × 100 or total ÷ grams × 100;
   - per item (`manual`): qty = the count, unit each, product per item = total ÷ count;
   - nested BLOC recipe: listed as a problem, never imported silently.
   Products are matched by a barcode recovered from the food library, then that barcode in the
   household, then name and brand, and only then created (once per import).
4. Products are saved, then recipes (with `bloc_recipe_id`), and the result screen shows Pinch's
   per-serving figures from `recipe_nutrition` beside BLOC's, flagging any beyond rounding
   (1 kcal / 1 g, or 2 %).

The recipes BLOC reads back are in the `bloc_recipes_v1` views; BLOC's side of that is in the
`bloc-app` repo, not here.

## 18. Amounts: scaling, units and formatting

- **`scaleRecipe(recipe, servings)`** — a new recipe with every non-null qty × servings ÷ serves.
  Never mutates; `serves` unchanged.
- **`convert(qty, from, to, { density, cup })`** — `{ qty }` or `{ error }`. Volume by fixed
  arithmetic (tsp 5, tbsp 15, l 1000, a stored cup 250, a US display cup 236.6); g/kg ↔ cup via
  density (g per ml); g ↔ ml always an error.
- **`unitOptions(unit, density)`** — what Check ingredients offers (§14).
- **`nutritionStatus(ingredient, product, density)`** — the same cell rules as the
  `ingredient_nutrition` view, for drafts.
- **`formatAmount(qty, unit, { mode, cup, density })`**:
  - `each`: a whole number, at least 1;
  - g/ml: one decimal under 10, whole under 100, nearest 5 above, kg/l from 1000;
  - tsp/tbsp/cup: ¼ ½ ¾ glyphs for a real quarter, else snapped with "≈"; under ⅛ the decimal;
  - mode `metric`: cups → ml; mode `cups`: g/kg (with a density) and ml/l → cups, snapped, kept as
    written under ¼ cup; spoons always stay;
  - `to taste` → "to taste"; no qty → "".
- **`densityFor(name, productName)`** — `js/lib/densities.js`, whole-name match, ingredient then
  product. The live table replaces it after load.

## 19. Flags

`components/flag.js` — `flag(code, 'lg' | 'sm')` returns a span holding an SVG (viewBox 30×20,
stretched to 60×40 or 20×14, 5 px radius, hairline shadow). 33 countries are drawn, simplified to
read at chip size; an unknown code shows its letters on a plain panel. Never emoji. The cuisine
list and the words an imported page uses for each are in `lib/cuisines.js`.

## 20. Service worker, splash and deploy

**`sw.js`**, registered from `app.js` with scope `./` (= `/pinch/`) on https only.

- Install precaches `SHELL_FILES` (every css, js, icon and font file plus `index.html` and the
  manifest) into `pinch-shell-<VERSION>` and skips waiting. Activate deletes **only** other
  `pinch-` caches and claims clients.
- Fetch: same-origin files cache-first (navigations get the cached `index.html`); the CDN modules and
  photo signed URLs cache-first in `pinch-runtime-v1`; everything else (the database, auth, the
  import function, Open Food Facts) goes to the network. `tests.html` and `tests/` are never cached.
- A new worker takes over on the next launch; `app.js` reloads at the next moment no sheet is open.
- Photo signed URLs last a week and are remembered in `localStorage['pinch.photoUrls.v1']`, so the
  same URL — and so the cached image — is used offline.

**The splash** (`index.html` + `css/splash.css`) is the design's 4.2 s animation. `app.js` dismisses
it when the data is ready, no sooner than 2.8 s; with reduced motion it is a still frame and goes as
soon as the data is ready.

**Deploy:** GitHub Pages serves `main` from the repo root. Bump `VERSION` in `sw.js` whenever a shell
file changes, and add new shell files to `SHELL_FILES`. Confirm with `curl` against the live URL.

## 21. Tests

`tests.html` runs every file in `tests/` in the browser through `tests/kit.js` (describe / test /
assertEqual / assertThrows, ~100 lines, no build). `#summary` shows the counts and the page title is
`PASS n/n` or `FAIL`. 113 tests cover every module in `js/lib/`, including ingredient lines taken
from real recipe pages, saved Open Food Facts responses (complete, missing kcal, kJ only, a liquid),
and a BLOC backup shape whose other data must not survive `readBlocBackup`.

The database rules — RLS, the atomic save, every nutrition cell, the household move, the BLOC views,
photos, and the density table matching `js/lib/densities.js` — are tested in
`silver-octo-invention/tools/schema-test` (`behaviour-pinch.mjs`, `20261019_pinch_verify.sql`).

## 22. Limits

- **BLOC's side is not built.** The `bloc_recipes_v1` views exist, but BLOC (`bloc-app`) does not yet
  connect to this project, list household recipes or lock imported ones.
- **Sites that refuse server-side fetches** (several large recipe sites answer 403) can only be
  imported by pasting their text.
- **Photos of a deleted household stay in the bucket**, readable by no one: SQL can't delete Storage
  files.
- **Offline is read-only.** Pinch opens offline with its last copy; saving needs a connection.
- **A product has one nutrition basis.** A cup of a per-item product, or millilitres of a per-100 g
  product, is reported missing rather than converted.
