# Pinch curriculum

Each lesson has a goal, concepts, tagged tasks and done criteria. `check-my-work`
passes a lesson only when every done criterion is met.

**Part 1, on the phone without a backend:** 1 Setup and the design system ·
2 Home layout · 3 Home behaviour · 4 Servings and amounts · 5 Units and cups ·
6 Method and tagging · 7 Adding and editing · 8 Saving locally · 9 PWA and
deploy

**Part 2, shared and connected:** 10 The `pinch` schema · 11 Connecting
Supabase · 12 Photos · 13 Products and nutrition · 14 Import from the web ·
15 Working with BLOC · 16 Polish

**Task tags** (see `CLAUDE.md`):

- **You:** Adam writes it.
- **You · tests first:** Claude has written failing tests and a stub; Adam
  makes them pass.
- **Pre-wired:** Claude builds it on `prewire/lesson-N`; Adam reviews, answers
  the explain-back questions, and merges.

Pre-wired tasks marked *(before)* are done at the start of the lesson, before
teaching.

Sections:

- **Explore first:** Claude researches, presents 2–3 options with a
  recommendation, and Adam decides. The decision is recorded in
  `docs/design.md`.
- **Read first:** Claude reads these before teaching.

Design references point into `design-handoff/`: the screen number, its
screenshot, and the class names in the reference HTML.

---

## Lesson 1: Setup and the design system
**Goal:** The repo runs locally with the design system loaded, and Adam can
explain how every file in the skeleton gets into the page.

**Concepts:** why modules need HTTP (`file://` breaks them); `<script
type="module">`, `import`/`export` vs Python imports; CSS custom properties as
design tokens (one source of truth, like a dbt `vars` block); light/dark via
`prefers-color-scheme` and `data-theme`; self-hosted fonts and `@font-face`;
an SVG icon sprite and `<use href>`; a browser test page with no build step.

**Tasks**
1. **Pre-wired** *(before)*: the skeleton.
   - `index.html` with an empty `<main id="home">`, `css/tokens.css` (copied
     from the handoff), `css/base.css`, fonts, icons, the icon sprite, and
     `js/app.js`.
   - The test kit: `tests.html`, `tests/kit.js` and `#summary` with pass/fail
     counts.
   - A `?theme=light|dark` override for screenshots.
2. **You:** `git init`, serve it, open it on the Mac and the phone (both URLs),
   and make the first commit.
3. **You:** create `js/data.js` exporting the six sample recipes from the design
   (names, meals, cuisines), each with two or three ingredients and steps. Every
   recipe, ingredient and step has an id, and steps tag ingredients by id.
4. **You · tests first:** `js/lib/recipes.js`, `cuisinesInUse(recipes)` (unique
   cuisine codes, in a stable order). It's the first test-first task, so it's
   tiny on purpose.
5. **You:** explain back how the page loads: HTML → CSS → module graph →
   `app.js`.

**Done criteria**
- [ ] Served over HTTP with no console errors, in both themes
- [ ] Sample data has ids everywhere; steps reference ingredient ids
- [ ] `tests.html` shows all passing
- [ ] Repo initialised with at least one commit
- [ ] Adam can explain the load order and where each token comes from

---

## Lesson 2: Home layout
**Goal:** Home (screens 01 and 02) matches the design in both themes,
rendered from `data.js`.

**Read first:** `design-handoff/README.md` §01/02 and the `.app-header`,
`.filters`, `.seg`, `.chips`, `.grid`, `.card`, `.fab`, `.scroll` and
`.edge-fade` CSS in `reference.html`. Also Listly's `.edge-fade` block in
`src/index.css`.

**Concepts:**
- render functions; `document.createElement` vs `innerHTML`; `textContent` for
  any user text (XSS)
- CSS grid and flexbox; a fixed header over a scrolling region
  (`flex: 1 1 0; min-height: 0`)
- `position: absolute` overlays anchored to the scrolling box, not the page
- the edge-fade rules: `rgb(var(--bg-rgb) / 0)` and never `transparent`;
  `pointer-events: none`
- `text-overflow: ellipsis`
- the Flag component as a black box with a documented interface

**Tasks**
1. **Pre-wired** *(before)*: `js/components/flag.js` (`flag(code, size)` returns
   an element) and `js/components/icons.js` (`icon(name)` returns an `<svg>`).
2. **You:** the header (wordmark and settings button), the segmented control
   and the chip row, in `css/home.css` and `js/views/home.js`.
3. **You:** the card grid. Each card shows its photo, or the flag on `--sunk`,
   then the `--fade-card` fade, title and meta. There's no button on the card.
4. **You:** the scroll area with the top and bottom edge fades, and the add
   button above them.
5. **You:** compare with screenshots 01 and 02 in light and dark, and fix the
   differences.

**Done criteria**
- [ ] Cards render from data; a title containing `<img src=x onerror=alert(1)>`
      shows as text and runs nothing
- [ ] Only the grid scrolls; the header and filters stay still
- [ ] Both edge fades show, use `--bg-rgb`, never use `transparent`, and never
      block a tap (tap a card through the bottom fade)
- [ ] Long titles truncate with an ellipsis
- [ ] Matches screenshots 01/02 in both themes (Claude compares headless
      screenshots at 390×844)
- [ ] All icon buttons have `aria-label`s; touch targets are at least 44px

---

## Lesson 3: Home behaviour
**Goal:** Filtering works, and tapping a card opens that recipe through a URL,
so back and refresh behave.

**Concepts:** UI state vs data (what's stored vs what's derived); event
delegation (one listener on the grid, not one per card); hash routing
(`#/`, `#/recipe/<id>`) and `hashchange`; the URL as state; deriving the chips
from the data; empty states.

**Tasks**
1. **Pre-wired** *(before)*: `js/components/sheet.js`.
   - It provides `openSheet(content, {kind: 'centre'|'bottom'})` and
     `closeSheet()`.
   - It handles the scrim, `role="dialog"`, the focus trap, Esc and a scrim
     tap.
   - A placeholder recipe sheet shows the recipe's name.
2. **You:** By meal / By cuisine switching. Cuisine chips come from
   `cuisinesInUse`, each with a small flag. Switching mode resets the chip to
   All.
3. **You · tests first:** `js/lib/recipes.js`, `filterRecipes(recipes, {mode,
   value})`.
4. **You:** `js/router.js`. `#/recipe/<id>` opens the sheet, closing it goes
   back to `#/`, and an unknown id shows a friendly message.
5. **You:** the add button opens an empty bottom sheet (the form arrives in
   Lesson 7), and the gear opens an empty Settings sheet.

**Done criteria**
- [ ] Filters work in both modes; a chip only exists for a cuisine in use
- [ ] One click listener handles every card
- [ ] Back, forward and refresh keep the right view; deep links work
- [ ] Unknown recipe id doesn't crash
- [ ] Filter tests pass

---

## Lesson 4: Servings and amounts
**Goal:** The recipe sheet (screens 03 and 04) shows scaled amounts as you step
servings up and down.

**Concepts:** pure functions vs DOM code; deriving the scale factor (servings ÷
serves) instead of storing it; never mutating the source object (spread);
`??`; rounding for humans; why `0.1 + 0.2 !== 0.3` and how to compare floats;
the glyph rule from BLOC's `fmtInch` (only print ¼ ½ ¾ when the value really
is that quarter).

**Tasks**
1. **Pre-wired** *(before)*: the recipe sheet UI.
   - Hero, tags, close and edit buttons, title, servings card (− / N / +,
     minimum 1), Ingredients | Method tabs and the flip.
   - It calls `scaleRecipe` and `formatAmount` from Adam's modules.
2. **You · tests first:** `js/lib/scale.js`.
   - `scaleRecipe(recipe, servings)` returns a new recipe with scaled
     quantities.
   - `qty: null` stays null, and the original is never mutated.
3. **You · tests first:** `js/lib/format.js`, `formatAmount(qty, unit)`.
   - Whole numbers for `each`.
   - Sensible rounding for g/ml (no `0.333…`, no `600.0000001 g`).
   - Spoons and cups in quarters with glyphs. A value that isn't a clean
     quarter keeps its decimal here (the "≈" snap belongs to Lesson 5).
4. **You:** explain back the flip: why the header stays still and what
   `prefers-reduced-motion` changes.

**Done criteria**
- [ ] Stepping servings updates every amount, including the method's tag lines
- [ ] Servings never goes below 1; the recipe's `serves` never changes
- [ ] `scaleRecipe` never mutates its input (tested)
- [ ] `formatAmount` tests pass, including null, `each`, tiny amounts and
      quarters
- [ ] Sheet matches screenshots 03/04 in both themes

---

## Lesson 5: Units and cups
**Goal:** Amounts can show as written, in metric, or in cups, following
Settings, with conversions only to and from cups.

**Explore first:** where densities (g per cup) come from.

- Options: a hand-curated table for common ingredients, USDA FoodData Central
  portion data, and other free sources.
- `curl` flour, sugar, rice, oats and butter.
- The densities must later live in a `pinch.densities` table, because
  nutrition is computed in SQL. Favour data (a table) over code.

**Concepts:**
- Converting through a base unit, like conforming to one grain in dbt.
- Volume units are fixed arithmetic: tsp 5 ml, tbsp 15 ml, a metric cup
  250 ml, a US cup ≈ 236.6 ml.
- Two separate questions:
  - which cup a *stored* "cup" means: a data decision, so record it
  - which cup to *display*: a setting
- **The cups-only rule:**
  - volume ↔ cup is fixed
  - g ↔ cup needs a density
  - g ↔ ml is never offered, and asking for it returns "can't convert"
    rather than guessing
- Snapping into cups gives the nearest quarter with "≈".
- A controlled unit vocabulary as data quality.

**Tasks**
1. **Pre-wired** *(before)*: the Settings sheet (screen 08) with theme, "Show
   amounts as" and cup size working. The other groups are disabled until their
   lesson.
2. **You · tests first:** `js/lib/units.js`.
   - `convert(qty, fromUnit, toUnit, {density, cup})` returns `{qty}` or
     `{error}`.
   - Tests cover both cup standards, g ↔ cup with and without a density, and
     g ↔ ml refused.
3. **You:** `js/lib/densities.js`, the starter density table from the
   decision, keyed by ingredient name.
4. **You · tests first:** extend `formatAmount` with the display mode: As
   written / Metric / Cups, including the "≈" snap into cups.
5. **You:** record in `docs/design.md` what a stored "cup" means.

**Done criteria**
- [ ] Decisions recorded in `docs/design.md`
- [ ] Only the original qty and unit are stored; conversion is display-only
- [ ] g ↔ ml is never produced; unknown density says so, never guesses
- [ ] Cups show ¼ ½ ¾; snapped values show "≈", exact ones don't
- [ ] Changing Settings updates the open recipe sheet; all tests pass

---

## Lesson 6: Method and tagging
**Goal:** The Method tab shows each step's tagged ingredients, scaled, in
italics, and the data stays consistent when ingredients change.

**Concepts:**
- **A many-to-many relationship as a bridge.** In the object it's
  `ingredientIds` on a step; in Lesson 10 it becomes `step_ingredients`.
- **Reference by id, not by name or position.**
- **Derive, don't copy.** Step lines come from the same `scaleRecipe` +
  `formatAmount`.
- **Referential integrity by hand.** Removing an ingredient must clear it from
  every step.
- **Immutable array moves** (swap without mutating).

**Tasks**
1. **You · tests first:** `js/lib/method.js`, `stepLine(recipe, step, servings,
   mode)`.
   - Returns `Name amount · Name amount` in ingredient-list order.
   - An unknown id is ignored.
2. **You · tests first:** `removeIngredient(recipe, id)`, which clears the
   ingredient from every step's tags, and `moveStep(recipe, stepId, ±1)`.
3. **You:** check against screenshot 04 that the pre-wired Method tab now shows
   your lines and scales with the stepper.
4. *(Optional stretch)* A step that uses part of an ingredient ("half the
   butter"). Discuss the data model first. Nutrition works from whole
   ingredients, so this must not affect it.

**Done criteria**
- [ ] Tag lines scale with servings and follow the display mode
- [ ] Steps survive renaming and reordering ingredients (tested)
- [ ] Removing an ingredient leaves no dangling id (tested)
- [ ] `moveStep` doesn't mutate its input (tested)

---

## Lesson 7: Adding and editing
**Goal:** Create, edit and delete recipes in memory, including the method and
its tags.

**Concepts:** one source of truth plus re-render on change, like a dbt DAG
where only the source table is written to; ids at row creation, not at save;
validation as a pure function returning every problem at once; dirty state and
"discard changes?".

**Tasks**
1. **Pre-wired** *(before)*:
   - the New/Edit recipe sheet (screen 05)
   - Add ingredient without products yet (screen 09: name, amount, unit chips)
   - the method editor (screen 14)

   They call Adam's `state.js` and `validateRecipe`.
2. **You:** `js/state.js` holds recipes and exposes `getRecipes`, `getRecipe`,
   `saveRecipe` and `deleteRecipe`, with `subscribe(fn)` for re-rendering.
   Views stop importing `data.js`.
3. **You · tests first:** `js/lib/validate.js`, `validateRecipe(recipe)`.
   - Name is required, serves is a whole number ≥ 1, meal is required, qty is
     a number or null.
   - Every tag points at an ingredient of the same recipe.
4. **You:** wire the edit (pencil) button and delete with confirmation. Home and
   the sheet update without a reload.

**Done criteria**
- [ ] New and edited recipes appear immediately on Home and in the sheet
- [ ] Only `state.js` changes recipe data
- [ ] An ingredient added in the same unsaved edit can be tagged
- [ ] Editing keeps existing ids; empty qty saves as `null`
- [ ] Step text and names containing HTML display as text
- [ ] Validation tests pass

---

## Lesson 8: Saving locally
**Goal:** Recipes survive a refresh, behind a storage interface that Supabase
can later replace without touching views or state.

**Concepts:** `localStorage` and JSON; `async`/`await` (lightly, vs asyncio); an
interface designed for the backend you'll have, not the one you have; a schema
`version` and upgrading stored data; the shared origin, so the key is
`pinch.v1`; corrupt-data handling.

**Tasks**
1. **You:** `js/storage.js` with async `listRecipes`, `saveRecipe`,
   `deleteRecipe` and `loadAll`, backed by localStorage. Only this file
   mentions `localStorage`.
2. **You:** load into `state.js` on start, with a loading state; save through
   storage.
3. **Pre-wired:** Settings › "Back up recipes" and a restore option, calling
   your `exportAll` and `importAll`.
4. **You · tests first:** `js/lib/backup.js`, `parseBackup(text)`.
   - It validates the version and shape.
   - It returns `{recipes}` or `{error}`, and never throws on bad input.

**Done criteria**
- [ ] Recipes, steps and tags survive refresh and restart
- [ ] Only `storage.js` mentions `localStorage`; the key is namespaced
- [ ] Back up → clear site data → restore brings everything back
- [ ] Corrupt stored data shows a message, not a crash; tests pass

---

## Lesson 9: PWA and deploy
**Goal:** Pinch is live at `https://adamnc02.github.io/pinch/`, installed on
Adam's phone, and opens offline with the splash.

**Concepts:**
- **The service worker lifecycle:** install, activate and fetch.
- **Cache-first for the app shell.**
- **Versioned, prefixed cache names** (`pinch-shell-v1`). Activate deletes only
  `pinch-` caches.
- **Scope under `/pinch/`.** It must never cover `/`, because Adam's other
  apps live there.
- **Why root paths break under a sub-path.**
- **Verifying a deploy by fetching the served bytes,** not trusting
  "published".

**Tasks**
1. **Pre-wired** *(before)*: `sw.js`, its registration, the update check, and
   the splash (shown once, dismissed when data is ready but no sooner than
   2.8 s; a still frame with reduced motion).
2. **You:** find and fix everything that assumes the site root, starting with
   the handoff's `manifest.webmanifest` (`start_url`, icon paths) and any `/`
   paths in `index.html`.
3. **You:** create the `pinch` GitHub repo, push, enable Pages, and confirm the
   served `manifest.webmanifest` and `sw.js` with `curl`.
4. **You:** install from the live URL, then turn on airplane mode and reopen.
5. **You:** a short `README.md`: run, test, deploy, and bump the cache version.

**Done criteria**
- [ ] Live URL works, including deep links like `#/recipe/<id>`
- [ ] Installs as "Pinch" with the right icon, and opens offline
- [ ] No root-absolute paths anywhere; SW scope is `/pinch/`
- [ ] A change plus a cache bump reaches the phone; old `pinch-` caches go
- [ ] Adam can explain install, activate and fetch in his own words

---

## Lesson 10: The `pinch` schema
**Goal:** A `pinch` schema on the shared project, household-shared like Listly,
tested in PGlite and deployed by merge.

**Read first:** `silver-octo-invention/README.md`, `docs/listly-SUPABASE.md`,
the Listly schema and RLS migrations, the depends-on section of
`docs/shared-finance-ledger-SUPABASE.md`, `MIGRATION-LESSONS.md` in full, and
`references/bloc-integration.md`.

**Concepts:**
- **One project, one schema per app.**
- **Reusing the existing household.** Listly's policies call
  `shared_finance_ledger.my_household_ids()`, which creates a cross-schema
  dependency that must be documented.
- **Grain of each table.**
- **`household_id` on every table,** so each policy is a one-liner.
- **Composite foreign keys** so `step_ingredients` can only link a step to its
  own recipe's ingredients, and `on delete cascade`.
- **Ordering and constraints:** `position` columns, the unit list as a check
  constraint, `meal` as a check or enum, and client-generated uuids.
- **Atomic saves:** `pinch.save_recipe(payload jsonb)` (`security invoker`),
  because several supabase-js calls can fail halfway.
- **`pinch.densities`** seeded from Lesson 5's table.
- **Deploying:**
  - Merge = deploy, through Supabase's GitHub integration. Never the SQL
    editor.
  - Afterwards: Exposed schemas and Redirect URLs.
  - No PowerSync: leave the shared publication alone.

**Tasks**
1. **You:** summarise the Listly sharing pattern in `docs/design.md`, then draft
   the tables (`recipes`, `ingredients`, `steps`, `step_ingredients`,
   `densities`) with grain, keys, types and constraints, plus the
   `save_recipe` contract.
2. **You:** on a feature branch in `silver-octo-invention`, write
   `supabase/migrations/<timestamp>_pinch_schema.sql`.
3. **Pre-wired:** PGlite verify and behaviour tests, `docs/pinch-SUPABASE.md`,
   the README row and the depends-on note. Adam explains what each test
   proves.
4. **Pre-wired:** the PR, merge, the check-run, and read-only verification of
   live state. Adam adds `pinch` to Exposed schemas and the Pages and
   localhost URLs to Redirect URLs.

**Done criteria**
- [ ] Grain of each table stated; no nutrition columns on these tables
- [ ] Every table has `household_id` and the household RLS pattern
- [ ] A cross-recipe tag is rejected; `save_recipe` is all-or-nothing (tested)
- [ ] Harness passes, including: a household member can read and write; an
      outsider can't
- [ ] No other app's schema changed
- [ ] Live: applied per the check-run, exposed, redirect URLs added

---

## Lesson 11: Connecting Supabase
**Goal:** Pinch reads and writes the shared project, Ella sees the same
recipes, and the views and state didn't change.

**Read first:** how Listly signs in and learns the household id.

**Concepts:** anon key vs service key (and why the anon key is safe with RLS);
`db: { schema: 'pinch' }`; a custom `auth.storageKey` on the shared origin;
mapping four tables to one nested object and back (pure functions, like a dbt
staging model then a mart); error and loading UI; redirect URLs that fail
silently.

**Tasks**
1. **Pre-wired** *(before)*: `js/supabase.js`, sign-in matching Listly, and the
   Settings › Household group.
2. **You · tests first:** `js/lib/rows.js`, `rowsToRecipes(rows)` and
   `recipeToPayload(recipe)`, ordered by `position`.
3. **You:** reimplement `storage.js` against Supabase with the same signatures,
   saving through `save_recipe`.
4. **You:** upload the Lesson 8 backup; then Ella adds a recipe with tagged
   steps and Adam sees it.

**Done criteria**
- [ ] `state.js` and the views needed no changes (or Adam can justify any)
- [ ] Order and tags round-trip exactly; a failed save leaves no partial rows
- [ ] Network errors show a message
- [ ] No secret in the repo; custom `auth.storageKey` set
- [ ] Shared access confirmed with Ella's account

---

## Lesson 12: Photos
**Goal:** A recipe can have a photo, stored privately for the household, shown
on the card and the sheet header.

**Concepts:**
- Supabase Storage buckets and object paths (`<household_id>/<recipe_id>.jpg`).
- Storage RLS policies written against the path, not a table.
- Signed URLs vs public URLs.
- Resizing on the device before upload (a photo straight off the phone is
  5 MB).
- Falling back to the flag.

**Tasks**
1. **You:** the bucket and its policies (a migration in `silver-octo-invention`,
   same process as Lesson 10): household members only.
2. **Pre-wired:** the "Add a photo" picker, resize and upload, and signed-URL
   loading with caching.
3. **You:** wire `photoPath` through `rows.js` and Home's card media.

**Done criteria**
- [ ] Photos show on cards and the sheet; no photo shows the flag
- [ ] An outsider can't read a household photo (tested in the harness)
- [ ] Uploaded images are resized; deleting a recipe deletes its photo

---

## Lesson 13: Products and nutrition
**Goal:** Ingredients link to household products, found by scanning, search or
the label, and each recipe shows per-serving nutrition computed in SQL.

**Read first:**
- BLOC's scanner setup (`_nativeDetector` and its fallback) and
  `fetchOFFProduct` in `bloc-app/index.html`.
- `references/bloc-integration.md` §4.

**Explore first:**
- Barcode decoding on iOS Safari today: is `BarcodeDetector` available, and
  which fallback loads as a pinned ES module from a CDN?
- Open Food Facts v2:
  - the fields needed
  - per 100 ml for liquids
  - CORS, rate limits and the User-Agent etiquette
- `curl` real barcodes from the kitchen, including one missing kcal.

**Concepts:**
- **The product as a dimension:** one row per product per household, an
  optional barcode unique within the household, and `ingredients.product_id`
  nullable.
- **Nutrition basis:** per 100 g, per 100 ml or per item, plus
  `grams_per_item`.
- **When an ingredient's nutrition can be computed, under the cups-only rule:**
  - weight units → per 100 g
  - volume units → per 100 ml
  - cup → g only through a density
  - `each` → per item, or per 100 g via `grams_per_item`
  - g ↔ ml never, so the ingredient is reported missing
- **Compute once, in SQL:** `pinch.recipe_nutrition` (`security_invoker`).
- **Additive migrations** on a live schema.
- **Confirming crowd-sourced data** before saving it.
- **The camera needs HTTPS,** so test it on the live URL.

**Tasks**
1. **You:** the migration: `pinch.products`, `ingredients.product_id`, and the
   `recipe_nutrition` view. Pre-wired harness tests cover each rule above.
2. **You · tests first:** `js/lib/off.js`, `mapOffProduct(json)`. It's tested
   against saved responses: complete, missing kcal, and a liquid.
3. **Pre-wired:**
   - the scanner (screen 11)
   - the scan result (12)
   - New product from the label (10)
   - product suggestions in Add ingredient (09)
4. **You:** show per-serving kcal, protein, carbs and fat on the recipe sheet
   from `recipe_nutrition`, with "N need nutrition" and which ones.

**Done criteria**
- [ ] Decisions recorded in `docs/design.md`
- [ ] Nutrition lives only on `products`
- [ ] On the phone: a scan fills a product after confirmation; scanning it
      again finds the household product with no network call
- [ ] Manual products work with no barcode
- [ ] Per-serving values come only from the view and don't change with servings
- [ ] Every conversion rule above is covered by a harness test, g ↔ ml included
- [ ] Ella can use products Adam created

---

## Lesson 14: Import from the web
**Goal:** Paste a link or a recipe's text, and Pinch turns it into a recipe you
check ingredient by ingredient (screens 15 and 13).

**Explore first:**
- `curl` 8–10 recipe sites Adam uses and check which publish schema.org
  `Recipe` JSON-LD.
- Note how they write ingredient lines and steps (`HowToStep`,
  `HowToSection`).

**Concepts:**
- **Why the browser can't fetch other sites (CORS),** and why the fetch runs in
  an Edge Function.
- **JSON-LD and schema.org as a published contract.**
- **Parsing as a pure, heavily tested function:** `"2 x 400g tins chickpeas,
  drained"` → qty, unit, name. It's like a dbt staging model for messy
  sources.
- **Claude as the fallback,** for pages without JSON-LD, unparsed lines and
  step-tag suggestions.
- **The key:**
  - It's a function secret, used only for members of the households in
    `PINCH_AI_HOUSEHOLDS`, and the function checks membership as the caller.
  - Without it, each person's own key (kept on their device, as in BLOC) is
    sent with each request and never stored.
- **Abuse guards:** http(s) only, size and time limits.

**Tasks**
1. **You · tests first:** `js/lib/parse.js`.
   - `parseIngredientLine(text)` handles fractions, ranges, "x 400g",
     unicode glyphs and "to taste".
   - `splitRecipeText(text)` finds the ingredients and method in pasted text.
   - `recipeFromJsonLd(html)` turns a page's HTML into a draft recipe.
2. **Pre-wired:** the `pinch-import` Edge Function in `silver-octo-invention`.
   It does the fetch, the household guard, JSON-LD first, then Claude, with
   the same draft output shape.
3. **Pre-wired:** the import tile flow (15), Check ingredients (13) with the
   unit switch and "Scan next", and the per-person key field in Settings.
4. **You:** end to end on the phone. Import three real recipes, one by link,
   one where the link fails, and one by pasted text, and finish them all.

**Done criteria**
- [ ] Parser tests pass on lines collected from the explored sites
- [ ] A household member can import; a signed-in non-member is refused (tested)
- [ ] No key in the repo; a per-person key is never stored server-side
- [ ] Imported ingredients can be renamed, deleted, unit-switched and linked
- [ ] A failed link falls back to asking for the text

---

## Lesson 15: Working with BLOC
**Goal:** Bring chosen recipes across from BLOC once, and let each BLOC read the
household's recipes, show them read-only and log portions.

**Read first:** `references/bloc-integration.md` in full, re-checked against
`bloc-app` main.

**Concepts:**
- **One editable copy.** Recipes are edited only in Pinch; BLOC only reads.
- **Reading someone else's export defensively.** Take `recipes` and
  `foodLibrary` from a BLOC backup and drop everything else.
- **Mapping BLOC's copied totals back to product facts.**
- **Reconciliation as a test.**
- **Versioned views as a published interface,** like a dbt exposure.
- **Servings made vs portions eaten.**

**Tasks**
1. **You · tests first:** `js/lib/bloc-import.js`.
   - `readBlocBackup(json)` returns recipes only.
   - `mapBlocRecipe(recipe, foodLibrary)` returns a draft plus products.
   - `reconcile(draft, blocRecipe)` compares the per-serving figures.
2. **Pre-wired:** Settings › "Import recipes from BLOC": choose the file, tick
   recipes, see the reconciliation, save. Each saved recipe keeps
   `bloc_recipe_id`.
3. **You:** the views `pinch.bloc_recipes_v1` and
   `pinch.bloc_recipe_ingredients_v1` (a migration, same process as Lesson
   10), and `docs/bloc-contract.md` documenting their columns.
4. **Pre-wired:** BLOC's side in `bloc-app` (§4.3 of `bloc-integration.md`).
5. **You:** end to end on both phones.
   - Import some BLOC recipes; the personal copies become locked in BLOC.
   - Each person connects BLOC and logs a portion.
   - Edit a recipe in Pinch, refresh BLOC, and check that past logs didn't
     change.

**Done criteria**
- [ ] Only `recipes` and `foodLibrary` are read from a backup; nothing else is
      stored
- [ ] Imports reconcile with BLOC within rounding; re-running doesn't duplicate
- [ ] The views use `security_invoker` and are documented
- [ ] Both BLOCs list household recipes with read-only ingredients, log
      portions, and work offline from cache
- [ ] Incomplete recipes show as not loggable, with the reason
- [ ] A recipe imported from BLOC can no longer be edited in BLOC

---

## Lesson 16: Polish
**Goal:** Adam picks at least three.

**Options:**
- a cooking mode: one step at a time, large text, its tagged ingredients, and
  the screen kept awake
- search
- send ingredients to Listly as a shopping list
- partial-ingredient steps
- an offline read cache of Supabase data
- realtime updates when Ella edits
- a Pinch-side product library screen
- the splash on first install only

**Done criteria**
- [ ] At least three completed, each passing its own check
- [ ] Tests pass; no console errors; deployed with the cache bumped
