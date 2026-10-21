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
23. [Send to Listly](#23-send-to-listly)
24. [Nutrition and barcodes off](#24-nutrition-and-barcodes-off)
25. [Tablets](#25-tablets)
26. [Seasonings](#26-seasonings)
27. [Cooking options and temperatures](#27-cooking-options-and-temperatures)

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
  components/         dom (h), icons, flag, sheet, stepper, toast, photo, toggle
  views/              home, recipe-sheet, editor, ingredient, product, scanner,
                      check, settings, bloc-import, signin, listly
  lib/                pure functions, all tested: recipes, scale, units, format,
                      densities, method, validate, rows, backup, off, parse,
                      bloc-import, claude-shape, cuisines, ids, shopping
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
Recipe     { id, name, serves, meal, cuisine, photoPath, blocRecipeId, ingredients[], steps[], cooking[] }
Ingredient { id, name, qty, unit, productId, seasoning }   // qty null = don't scale; seasoning §26
Step       { id, text, ingredientIds[] }          // tags, in ingredient-list order
Cooking    { id, method, name, minutes, tempC, note }      // §27; name only for 'other'
Product    { id, name, brand, barcode, basis, kcal, protein, carbs, fat, gramsPerItem, source }
Nutrition  { kcal, protein, carbs, fat, counted, missing, notCounted, complete }  // per serving
```

- `meal` ∈ `breakfast | lunch | dinner | sauce` (`MEALS`, in that order; `mealLabel('sauce')` is "Sauces");
  `cuisine` is an ISO alpha-2 code or null.
- `unit` ∈ `g kg ml l tsp tbsp cup each`, `to taste`.
- `basis` ∈ `100g | 100ml | item`; `source` ∈ `label | off | bloc`.
- Ids are `crypto.randomUUID()`, made when the row is created (`lib/ids.js`).
- `lib/rows.js` maps the five recipe tables to this shape and back (`rowsToRecipes`, `recipeToPayload`),
  ordered by `position`; `rowToProduct`, `productToRow`, `rowToNutrition` do the rest. The payload always carries
  `seasoning` on every ingredient and a `cooking` list (empty clears it); see §27 for why the database treats a
  missing key as "unchanged".

## 5. state.js and storage.js

**`state.js`** holds `{ user, householdId, recipes, products, nutrition, ingredientStatus,
densities, nutritionOn, tempUnit, status, error }`. Views call `subscribe(fn)` and re-render; only its actions change
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
(`original | written | metric | cups`), `cup` (`metric | us`), `homeMode` (`meal | cuisine`), `sideBySide`
(default true, §25), `listlyList` (the last Listly list sent to, §23). Not synced: two
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

- Chips: By meal is `All · Breakfast · Lunch · Dinner · Sauces`; By cuisine is `All` plus
  `cuisinesInUse(sorted recipes)`, each with a 20×14 flag. Switching mode resets to All; a cuisine
  whose last recipe is deleted falls back to All. The mode is remembered per device.
- Cards are alphabetical, 200 px, two columns (three from 560 px, four from 760 px, five from 1100 px). A card is a `<button>` with
  `data-recipe`; **one click listener on the grid** handles every card. Photo cards load a signed URL
  (§12); others show the 60×40 flag on `--sunk`.
- **Long press** (500 ms without moving 10 px), a right-click or the context-menu key opens the card's menu
  (`openCardMenu`, §23) instead of the recipe; the click that ends the press is swallowed, and only that one (a
  press older than 1.5 s never swallows a later tap or Enter). Cards have `-webkit-touch-callout: none` and no text
  selection, and card images ignore pointers, so iOS shows neither its callout nor an image preview.
- Loading shows skeleton cards; offline or error shows a notice with Try again; an empty filter
  says so.

## 10. The recipe sheet

`views/recipe-sheet.js` (screens 03, 04).

- **Hero:** the photo (or the flag on `--sunk`), the `--fade-sheet` fade, `MEAL · CUISINE`, Close, the
  basket (Send to Listly at the servings shown, §23), the edit pencil, the title (two lines max).
- **Servings:** opens at `recipe.serves`; − / + by one, minimum 1. Every amount is
  `scaleRecipe(recipe, servings)` then `formatAmount(...)` with the current prefs. Nothing is saved.
- **Ingredients | Method:** real tab buttons with `aria-selected`. Switching flips the content with
  the Web Animations API — 225 ms to 90°, swap, 225 ms back — so the face can change height; the
  header stays still. With `prefers-reduced-motion` it cross-fades.
- **Method:** numbered steps; under each, `stepLine(recipe, step, servings, opts)` in italics. Then the
  recipe's cooking options, if any (§27), under a Cooking heading — also when there are no steps.
- **Cups mode:** a weighed ingredient (g/kg) with no density stays as written, and a note under the list names them.
  With a Claude key on the device, **Look up cup measures** sends those names (minus ones already known to be
  weighed) to `claude.cupMeasures()`: grams per metric cup, or "not cup-measured". Densities in 0.03–2.5 g/ml are
  added to the shared `pinch.densities` (`source: 'claude'`, insert-only, `state.addDensities`) and every recipe's
  nutrition is refreshed; "not cup-measured" names are remembered on the device (`pinch.noCupMeasure`). Spoons are
  never converted in any mode.
- **Method tags** sit on a light rounded `--sunk` panel under each step.
- **Nutrition** (under Ingredients): per serving from `recipe_nutrition` — it does not change with the
  stepper — and, when any ingredient is missing, "N need nutrition" with their names, which opens
  Check ingredients and saves from there. Missing is `ingredient_nutrition`'s `no_product` or
  `unconvertible`; a seasoning is neither (§26).

The sheet re-renders when state or prefs change, and closes itself if the recipe is deleted. On a wide screen it
can show Ingredients and Method side by side (§25).

## 11. The editor and the method editor

`views/editor.js` (screens 05, 06, 14, 15). It edits a **copy**; nothing reaches state until Save.

- New recipes start on two tiles, **Enter ingredients** and **Import from web** (§15).
- Fields: name; Serves stepper (1–100); Cuisine (a native `<select>` laid invisibly over a styled box
  showing the flag, so the phone's own picker opens); Meal (four buttons, `.four`); optional photo.
- **Photo:** chosen with a file input, resized on the device (`components/photo.js`: longest side
  1600 px, JPEG 0.82), previewed, and uploaded only on Save to
  `pinch-photos/<household_id>/<recipe_id>-<suffix>.jpg`. Replacing or removing it deletes the old
  file just before the save, for the same reason as `deleteRecipe`; an uploaded file is reused if the
  save is retried.
- **Ingredients:** Scan barcode or Add manually; each row opens Add ingredient to edit or delete.
  "needs nutrition" marks a row whose `nutritionStatus()` is `no_product` or `unconvertible` — the
  same rule as the recipe card's count, so a linked product the amount can't reach ("2 each" against
  a per-100 g product with no weight of one) is marked too. A seasoning shows "seasoning" instead.
  "Check ingredients · N need nutrition" opens §14 on the draft.
- **Cooking:** after the method, §27.
- **Method editor:** steps are free text, numbered, and one is open at a time with its textarea and
  "Tap the ingredients this step uses" chips (a pressed chip shows a check). Arrows move a step
  (`moveStep`), the bin deletes it; there is no drag. Deleting an ingredient removes its tags
  (`removeIngredient`).
- **Save:** empty steps are dropped, `validateRecipe()` lists every problem at once, then the photo
  uploads and `state.saveRecipe()`. Closing with changes asks "Discard changes?".
- **Delete recipe** (edit only) asks first and says it goes for everyone in the household.
- **The name field and "(Meal) " prefixes.** A recipe imported from BLOC is stored as BLOC named it, "(Dinner)
  Lasagne". Every screen shows `displayName(name)` (the name without a leading `(Breakfast|Lunch|Dinner|Snack(s))`), and
  sorting uses it too. The editor's name field shows `splitMealPrefix(name).title` and writes `prefix + typed text`, so
  the stored prefix is kept silently; `validateRecipe` requires a name after the prefix. The BLOC import pre-selects
  the meal a "(Meal) …" name states (`mealFromPrefix`). BLOC shows household recipes as "(Meal) Name" from `meal`.

## 12. Add ingredient and products

`views/ingredient.js` (screen 09): name, amount, and a unit chip from the controlled list (`to taste`
clears the amount). Typing a name lists **household products** that match ("Nutrition · from your
products"); otherwise Scan barcode or From label. A linked product shows with Unlink. An ingredient
can be saved without a product. The **Seasoning** switch (§26) sits under the amount; while it is on there is
no product part at all. A linked product has **Edit** (the product form, for every recipe that uses it) and
Unlink. When the amount can't be counted only because the product lacks a weight of one item — `each`
against a per-100 g product, or grams against a per-item one — the sheet asks "One … weighs __ g" and
saves it on the product (`state.saveProduct`), which re-reads every recipe using it. For tsp, tbsp and cup the number box is replaced by a whole-number
stepper and – ¼ ½ ¾, so a spoon or cup amount is always a quarter; an existing amount that isn't
(a recipe's 0.33 tsp) is kept exactly, with a line saying so, until the picker is pressed.

`views/product.js` (screen 10): name, brand, optional barcode (6–14 digits, unique in the household),
nutrition per 100 g / 100 ml / item, all four macros required (0 is fine), optional weight of one
item (hidden for per-100 ml products). Saved to the household with `state.saveProduct()`. Opened with an
existing product (from Add ingredient's Edit, Check ingredients' Edit product, or a scan of one of your
products) it edits that product, and says it changes in every recipe that uses it.

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
  Scan / Products (Scan / **Edit product** when a product is linked), From the label, **Seasoning**,
  Skip for now. Seasoning marks the row (§26) and moves on; an open seasoning row has only
  "Not a seasoning". Seasonings and "to taste" rows are listed as not counted.
- An `unconvertible` row whose product only lacks the weight of one item says "…until it has the
  weight of one"; Edit product is where it is added.
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
- **Text** is split in the app by `splitRecipeText()`: Ingredients / Method headings; or, for a phone
  note with a checklist and numbered steps, the list lines are ingredients and the numbered lines the
  method (a title only if the first line is neither); otherwise short amount lines vs. sentences.
  List markers (`- [ ]`, `- [x]`, `☐`, `•`, `-`, `*`) are taken off every ingredient line
  (`stripListMarker`), and when a method is numbered, a line that doesn't start a new number continues
  the step above it (`joinWrapped`) — notes wrap long steps across lines.
- **Names are title case** (`titleCase`): every all-lower-case word capitalised, small joining words
  (and, of, with…) left alone after the first, any word part already containing a capital kept as
  written ("McVitie's", "BBQ"), hyphenated parts each ("Self-Raising"). Applied in `draftFromImport` to
  the recipe and ingredient names, and to the names Claude returns for unread lines.
- Either way `draftFromImport()` runs `parseIngredientLine()` on every ingredient line, gives every
  row a fresh id, maps the category to a meal (sauce, dressing, condiment, marinade, dip, gravy, salsa
  and pesto are `sauce`) and the cuisine words to a code, and pre-tags each step
  with the ingredients it names (`suggestTags`). **Serves and Meal come from the recipe when it says**,
  else from the form.
- Lines the parser can't read are sent once to Claude (`claude.splitLines`) when this device has a
  key; otherwise they stay as written for the cook to fix in Check ingredients.
- Names that look like a seasoning are marked one (§26) and never linked; the other ingredients whose name
  matches a household product are linked automatically. Then Check ingredients opens, then the method editor.

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
- **Appearance:** System / Light / Dark, and Ingredients and method side by side (§25).
- **Nutrition:** the Nutrition and barcodes switch (§24).
- **Temperatures:** Celsius / Fahrenheit for cooking options, under Show amounts as (§27).
- **Show amounts as:** Original (the stored number and unit, untidied: 122 g, 0.33 tsp) / As written
  (the same units, rounded for reading: 120 g) / Metric / Cups, and Cup size: Metric 250 ml / US 237 ml.
- **Import from web:** the Claude key field (password input), saved on this device only, with
  Remove — as BLOC's Settings.
- **Your data:** Import recipes from BLOC (§17); **Back up recipes** hands
  `pinch-backup-<date>.json` to the share sheet (`navigator.share` with a File, when `canShare` says
  files can go; AirDrop, Save to Files) and otherwise downloads it. A download link inside an installed
  iOS app opens a blank page, so the share sheet comes first. The file is
  `makeBackup`'s: kind, version 1, recipes, products. **Restore from a backup** checks it with `parseBackup` (never throws) and upserts every product then every recipe,
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
  - mode `original`: the stored number (up to two decimals) and unit, with no rounding or snapping;
    quarters still as glyphs;
  - mode `metric`: cups → ml; mode `cups`: g/kg (with a density) and ml/l → cups, snapped (from ⅛ cup
    up, shown as at least ≈ ¼), kept as written under ⅛ cup; spoons always stay;
  - `to taste` → "to taste"; no qty → "".
- **`densityFor(name, productName)`** — `js/lib/densities.js` (187 foods): the ingredient's whole name, the product's
  whole name, then the **longest** table name found as whole words in the ingredient's name ("Flahavan's porridge
  oats" → oats; "coconut milk" beats "milk"), then in the product's. The same rule as `pinch.ingredient_nutrition`;
  `behaviour-pinch.mjs` checks they agree. The live table (seed + Claude-sourced rows) replaces the bundled copy after
  load. No match → null, and a cup is never guessed.

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
`PASS n/n` or `FAIL`. 171 tests cover every module in `js/lib/`, including ingredient lines taken
from real recipe pages, saved Open Food Facts responses (complete, missing kcal, kJ only, a liquid),
and a BLOC backup shape whose other data must not survive `readBlocBackup`.

The database rules — RLS, the atomic save, every nutrition cell, the household move, the BLOC views,
photos, the density table matching `js/lib/densities.js`, sauces, seasonings and cooking options
(including a save from an app without them) — are tested in
`silver-octo-invention/tools/schema-test` (`behaviour-pinch.mjs`, `20261019_pinch_verify.sql`).

## 22. Limits

- **BLOC reads, never writes.** BLOC (`bloc-app` TECHNICAL §176) lists household recipes from the `bloc_*_v1`
  views and locks the ones imported from it; nothing it does is visible to Pinch, which is why Nutrition and barcodes
  is a switch (§24) rather than detected.
- **Sites that refuse server-side fetches** (several large recipe sites answer 403) can only be
  imported by pasting their text.
- **Photos of a deleted household stay in the bucket**, readable by no one: SQL can't delete Storage
  files.
- **Offline is read-only.** Pinch opens offline with its last copy; saving needs a connection.
- **A product has one nutrition basis.** A cup of a per-item product, or millilitres of a per-100 g
  product, is reported missing rather than converted.

## 23. Send to Listly

`views/listly.js` with `lib/shopping.js`. Opened from a Home card's long-press menu (`openCardMenu`, whose one action it
is) and from the basket on the recipe sheet, which passes the servings shown.

- **The sheet:** a servings stepper, the shop (the household's `listly.shopping_lists`, in Listly's order: position, then
  id, no position last; it starts on the last list sent to from this device, else the starred list, else the first),
  and the items with a tick box each, All / None, and "Add N items to <list>".
- **The wording** (`shoppingLines`): the recipe scaled to the servings, each line `Name (amount)`, the amount always in
  `formatAmount`'s `metric` mode whatever Show amounts as says, so a list never reads "≈ 1½ cups" (spoons stay spoons;
  `each` rounds to a whole number). Lines of one ingredient in one unit are added together, kg counted as g and l as ml;
  different units of one name stay separate, because g ↔ ml is never converted. "To taste" and amount-less lines are the
  name alone, and are dropped when the same name has an amount elsewhere.
- **Unticked to begin with:** "to taste" lines, and lines whose name is on the chosen list and not yet ticked off
  there (`alreadyOn`, comparing names with any trailing "(…)" removed). A box the cook has touched keeps their choice
  when the shop or the servings change.
- **The write** (`storage.addListlyItems`): one insert into `listly.shopping_items` for every item, so all land or none
  do, then `never_had_items = false` on the list, as Listly's `insertItem()` does. Each row is exactly what Listly
  writes: an 8-character id from Listly's alphabet (`listlyId`), `household_id`, `list_id`, `text`, `done: false`, and
  positions after the list's last (`appendPosition`). `user_id` and `created_at` are left to their defaults
  (`auth.uid()`, `now()`), so the partner gets Listly's usual "New stuff to buy" push five minutes later, naming this
  person. PowerSync brings the rows down to both Listly apps.
- 🚨 **Pinch is a second writer of Listly's tables.** A Listly migration that renames or tightens a column on
  `shopping_items` or `shopping_lists` (a new NOT NULL, a CHECK on `text`) breaks Send to Listly; it is listed in
  `silver-octo-invention/docs/listly-SUPABASE.md` and `pinch-SUPABASE.md`. Never write `shop_completions` from Pinch:
  that table is the ledger bridge.
- `?demo` keeps two sample lists in `localStorage['pinch.demo.listly.v1']` and never touches the network.

## 24. Nutrition and barcodes off

Settings › Nutrition › **Nutrition and barcodes**, an iOS-style switch (`components/toggle.js`). It is the person's,
not the device's: saved in their auth `user_metadata.pinch_nutrition` (`storage.setNutrition`, `supabase.auth.updateUser`),
so it follows them to every phone; missing means on. `state.start()` reads a fresh `getUser()` after loading, because
the session's copy of the user can predate a switch flipped on another phone. `?demo` keeps it in
`localStorage['pinch.demo.nutrition']`.

BLOC never writes to this project, so nothing in the data says who uses BLOC: the switch is how a person who doesn't
says so. Off (`state.nutritionOn` false):

- the recipe sheet shows no Per serving block and no "N need nutrition";
- the editor has one **Add ingredient** button instead of Scan barcode / Add manually, no "needs nutrition" marks and
  no Check ingredients link;
- Add ingredient shows no product part (no suggestions, Scan barcode or From label); a product already linked stays
  linked;
- an import goes straight from Read recipe to the method, without Check ingredients.

Nothing stored changes: products, links and `recipe_nutrition` are the same either way, and BLOC's views are unaffected.

## 25. Tablets

From 760 px wide, Home widens to 1280 px with four or five columns (§9), the recipe sheet grows to 720 px, and, from
600 px tall as well, every bottom sheet is a centred panel (600 px, rounded on all corners, no grab handle; the card menu
sits in the middle). The sticky footers keep working because the panel's bottom padding is the same 24 px they offset.

**Side by side.** `prefs.sideBySide()` is true when the `sideBySide` pref is on (the default) and the screen matches
`WIDE` (`(min-width: 760px)`, the same width as the CSS). The recipe sheet then drops the tabs and the flip, shows
Ingredients and Method as two columns under the stepper, and widens to 1040 px. It re-lays itself out when the width
crosses 760 px (a rotation) or the pref changes. The switch is Settings › Appearance › **Ingredients and method side by
side**, per device.

**Double-tap zoom** is off everywhere (`touch-action: manipulation` on `html`): a quick second tap on a stepper is a
second press. Pinch-to-zoom still works.

## 26. Seasonings

`ingredients.seasoning` (boolean, default false). A seasoning — a spice, herb, salt — is **never counted for
nutrition**: `pinch.ingredient_nutrition` gives it `not_counted` exactly like an ingredient "to taste", with no
kcal, so it never blocks `nutrition_complete`, and BLOC's `bloc_recipe_ingredients_v1` reads it as
`has_nutrition = false`. `lib/units.js` `nutritionStatus()` has the same rule for drafts, and the demo backend
too.

- **Why it exists.** A spoon of paprika against a 0 kcal per-100 g product is `unconvertible` (spoons are a
  volume; g ↔ ml is never converted), and no product at all is `no_product`: either way the recipe was never
  complete for BLOC, for an ingredient whose nutrition doesn't matter.
- **Suggested, never imposed.** `lib/cooking.js` `looksLikeSeasoning(name)` matches whole words from a short
  list (salt, pepper, paprika, cumin, oregano…) and refuses food that shares a word ("red pepper", "peppers",
  "… sauce", "… paste"). A NEW ingredient in Add ingredient follows its name until the switch is touched;
  imported ingredients start marked. A saved ingredient is never changed for the cook.
- **No product part** while on: no suggestions, no Scan barcode, no From label. A product already linked stays
  linked and is simply not counted.
- 🚨 A phone still on the previous app sends no `seasoning` key; `save_recipe` then keeps the stored flag
  (§27 has the same rule for cooking options). Without that, its first save would clear every flag.

## 27. Cooking options and temperatures

`pinch.cooking_methods`: one row per way of cooking a recipe — `method` ∈ `air_fryer oven fan_oven hob grill
microwave bbq slow_cooker other`, `name` (required for, and only for, `other`), optional `minutes` (whole,
1–1440), `temp_c` (whole °C, 20–300) and `note` (≤ 200). It hangs off `recipes` by the composite key with
`ON UPDATE / DELETE CASCADE`, so the household move carries it and deleting a recipe deletes it.
`save_recipe` writes it in the same transaction as the rest.

- **Editor:** a Cooking field after the method. Options are rows ("Air fryer · 12 min · 200°C", the note
  under it); one is open at a time, with the method chips, an Other name, Time (min), Temp (°C or °F), Note,
  up/down, delete and Done. Inputs commit on `change`, and the editor blurs the focused field before Save and
  before adding another option, so a value still being typed is kept. `cookingProblems()` (in
  `validateRecipe`, as `cooking.N`) mirrors the table's checks.
- **Recipe sheet:** after the steps, "Cooking" with one card per option.
- **Temperatures are stored in °C only.** °F is display: the person's **Temperatures** setting,
  `user_metadata.pinch_temp_unit` (`'c' | 'f'`, missing = °C), saved on their login like Nutrition and
  barcodes (`storage.tempUnit` / `setTempUnit`, `state.tempUnit`; `?demo` keeps it in
  `localStorage['pinch.demo.tempUnit']`). °F shows to the nearest 5 (180 °C → 355°F); a typed °F is stored
  as the nearest whole °C (350°F → 177 °C), which reads back as 350°F.
- 🚨 **A save from a phone still on the previous app has no `cooking` key.** `save_recipe` only replaces
  cooking options when the payload has a `cooking` array; the app always sends one, empty included, so
  deleting every option still clears them. Treating a missing key as "none" would make an un-updated phone
  wipe every recipe's cooking options the first time it saves.
- Cooking options are recipe data, not nutrition: BLOC's views don't carry them.
