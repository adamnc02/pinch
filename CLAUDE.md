# Pinch — teaching project

## What this project is
Pinch is the shared recipe **library** for Adam and Ella's household, a PWA that
Adam is learning to build. It is a library, not a daily-use app.

- **What a recipe holds:**
  - the servings it makes, its meal (Breakfast / Lunch / Dinner), its cuisine
    (shown as a flag) and an optional photo
  - its ingredients and its method
  - for each method step, the ingredients it uses, shown in small italics
    under the step
- **The recipe sheet** has a servings stepper that rescales every amount, one
  serving at a time.
- **Nutrition:** ingredients link to products in a shared household product
  library. A product is found by barcode (Open Food Facts), by searching
  your own products, or by typing it in from the label.
- **Adding recipes:** type them in, or import from the web by pasting a link or
  the recipe's text. Pinch splits it into ingredients and steps, then walks
  through linking a product to each ingredient.
- **Working with BLOC:**
  - Each person's BLOC reads the household recipes, shows their ingredients
    read-only, and logs portions.
  - Recipes can be brought across once from a BLOC backup, picking which ones.
  - A recipe in Pinch can't be edited in BLOC.

## The design is final
`design-handoff/` holds the finished design: `README.md` (the spec), `design/tokens.css`,
`design/reference.html` (screens 01–06), `design/reference-additions.html`
(08–15), `screenshots/`, `icons/`, `fonts/`, and the splash. Build to it. Don't
redesign it. When the spec and this file disagree, raise it with Adam.

## How the work is split
Adam is learning by building, but the full design is too big to hand-write in
reasonable time. Every task in the curriculum is tagged:

- **You:** Adam writes it. Teach, set the task, review, and give graduated
  hints:
  1. a pointer to the concept
  2. the shape of the solution in plain English or pseudocode
  3. a partial snippet

  Only go further if he asks.
- **You · tests first:** a pure function. Claude writes the failing tests in
  `tests/` and a stub that throws `not implemented`, and Adam makes the tests
  pass. He may add tests. He may not change Claude's without saying why.
- **Pre-wired:** Claude builds it on a `prewire/lesson-N` branch. Adam reads the
  diff and answers 3–4 explain-back questions (what it does, why it's built
  that way, what would break if X changed). He merges it himself once his
  answers show he understands it.

**What Adam owns.** Claude never edits these without being asked for a
specific piece:

- **Home page wiring:**
  - the Home markup inside `<main id="home">`
  - `css/home.css` (header, segmented control, chips, grid, cards, the edge
    fades and the add button)
  - `js/views/home.js` (rendering and filtering)
  - `js/router.js`
- **App data:** `js/state.js` and `js/storage.js`.
- **Pure logic:** `js/lib/*.js`.
- **SQL:** the `pinch` SQL he writes in `silver-octo-invention`.

**Everything else is pre-wired:** base and component CSS, `js/components/`, the
other views, the service worker, the splash, the Supabase client and auth, the
Edge Function, the test kit, and BLOC's side.

Pre-wired code imports Adam's modules by the names the curriculum gives. Until
his function exists, its stub throws and the UI shows a placeholder.

## How Adam learns best
- Strong Python, dbt, Snowflake and SQL background. Relate JavaScript ideas to
  Python (modules ↔ imports, `map` ↔ list comprehensions, objects ↔ dicts), and
  data modelling ideas to dbt (grain, keys, bridge tables, dimensions,
  exposures, tests, one source of truth).
- Knows BLOC well (a single-file HTML PWA) and is comfortable with imports
  across files (personal ledger).
- Prefers diagnosing root causes over patching symptoms. Explain "why", not
  just "what". Keep explanations tight.

## Technical constraints (do not deviate without discussing)
- **Vanilla JavaScript with native ES modules.** No frameworks, no bundler, no
  npm and no build step in this repo. Node is installed on the Mac (other repos
  use it), but this app runs straight from the files.
- **Local dev:** `python3 -m http.server 8000` from the project root. Always give
  both URLs: `http://localhost:8000` for the Mac and
  `http://<Mac LAN IP>:8000` for the phone. LAN http can't test the service
  worker, install or the camera. Test those on the live URL.
- **Hosting:** GitHub Pages at `https://adamnc02.github.io/pinch/`. All paths
  are relative. The handoff's starter manifest still has root paths, and
  fixing them is part of Lesson 9.
- **Shared origin.** All of Adam's apps are on `adamnc02.github.io`.
  - Namespace every `localStorage` key and cache name with `pinch`.
  - Keep the service worker's scope to `/pinch/`.
  - Give supabase-js its own `auth.storageKey`.
- **Backend (from Lesson 10):**
  - The shared Supabase project `nxekrfdagkdwhjuunsrl` (personal-f,
    shared-finance-ledger, Listly). Pinch gets its own `pinch` schema,
    household-scoped like Listly.
  - supabase-js is loaded as a pinned ES module from a CDN, directly, without
    PowerSync.
  - The publishable anon key plus RLS is the model. Never commit a secret.
- **Accounts.** Each person uses one account across all the apps. BLOC is on a
  **different** project (`pinch` is never on BLOC's database), so BLOC signs in
  to this one separately.

## Core data rules
- **Recipe:** `{ id, name, serves, meal, cuisine, photoPath, ingredients[], steps[] }`.
  `serves` is what the recipe makes. The stepper never changes it.
- **Ingredient:** `{ id, name, qty, unit, productId }`.
  - `qty` is a number, and `null` means "don't scale" (e.g. "to taste").
  - `unit` is from the controlled list: g, kg, ml, l, tsp, tbsp, cup, each,
    "to taste".
  - `productId` is optional.
- **Step:** `{ id, text, ingredientIds[] }`.
  - Tags reference ingredients **by id**. A quantity is never copied onto a
    step: it's computed, so the stepper applies to steps too.
  - Ingredient and step ids (`crypto.randomUUID()`) are made when the form row
    is created, so a step can tag an ingredient added in the same unsaved
    edit.
- **Only the original qty and unit are stored.** Scaled and converted amounts
  are calculated for display.
- **Conversions only go to or from cups:**
  - Volume units (tsp, tbsp, cup, ml, l) convert by fixed arithmetic.
  - g/kg ↔ cup needs the ingredient's density.
  - g ↔ ml is never offered.
  - Cups show ¼ ½ ¾ glyphs. A value snapped to a quarter shows "≈". A
    value that really is a quarter shows without it.
- **Nutrition lives only on products** (per 100 g, per 100 ml or per item:
  kcal, protein, carbs and fat, the four BLOC uses).
  - Recipes and ingredients carry no macro columns.
  - Per-serving nutrition is computed once, in SQL (`pinch.recipe_nutrition`).
  - An ingredient whose amount can't reach its product's basis under the rules
    above is reported as missing, never guessed.
- **BLOC reads only the versioned views** (`pinch.bloc_recipes_v1`,
  `pinch.bloc_recipe_ingredients_v1`). Recipes are edited only in Pinch. There
  is no export and no two-way sync.

## Work outside this repo
Pre-wired work in other repos follows the `app-session` skill's branch, PR and
verify workflow.

- **silver-octo-invention** (`/Users/adamcox/Documents/GitHub/silver-octo-invention`):
  the shared project's migrations, docs, PGlite harness and Edge Functions.
  - Adam writes the `pinch` SQL. Claude adds harness tests and docs, and
    handles the PR, merge (= deploy) and live verification.
  - Read its README and `MIGRATION-LESSONS.md` before any migration.
- **bloc-app** (`/Users/adamcox/Documents/GitHub/bloc-app`): BLOC's side, in
  Lesson 15. The scope is in `.claude/skills/lesson/references/bloc-integration.md`.

## Related repos (read only unless the section above says otherwise)
- Listly: `/Users/adamcox/Documents/GitHub/listly` (household sharing; `.edge-fade` in `src/index.css`)
- shared-finance-ledger: `/Users/adamcox/Documents/GitHub/shared-finance-ledger`
- personal-ledger: `/Users/adamcox/Documents/GitHub/personal-ledger`
- silver-octo-invention: `/Users/adamcox/Documents/GitHub/silver-octo-invention`
- BLOC: `/Users/adamcox/Documents/GitHub/bloc-app` (scanner, Open Food Facts lookup, `fmtInch` glyph rule)
- BLOC's migrations: `/Users/adamcox/Documents/GitHub/super-duper-octo-barnacle`

## Lessons and progress
- `PROGRESS.md` is the single source of truth for where Adam is. Only the
  `lesson` and `check-my-work` skills change it.
- `/lesson` gives the current or next lesson. `/check-my-work` checks his work
  against the lesson's done criteria and advances him when he passes.
