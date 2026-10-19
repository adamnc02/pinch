# BLOC integration

How Pinch and BLOC work together. The `lesson` skill reads this for Lessons 10,
13, 14 and 15.

BLOC facts below were read from `bloc-app` main at `2e50a98` (2026-10-16).
Line numbers drift. Search by function name and re-check before relying on
anything here.

---

## 1. The shape of it

- **Pinch is the household's shared recipe library.**
  - Adam and Ella author recipes there, with methods and products, including
    nutrition.
  - It is a library, not a daily-use app.
- **BLOC stays per person.** Each of them logs their own portions in their
  own BLOC.
- **Pinch → BLOC (ongoing).** BLOC reads household recipes through two
  versioned views. It shows each recipe's ingredients read-only and logs
  portions. No files.
- **BLOC → Pinch (one-off).**
  - Adam (or Ella) picks some existing BLOC recipes and imports them from a
    BLOC backup.
  - From then on, those recipes are locked in BLOC.
  - No BLOC change is needed to produce the file.
- **One editable copy.** A recipe is edited only in Pinch. Nothing in BLOC
  writes back.

```
Pinch (shared project nxekrfdagkdwhjuunsrl, schema pinch)   BLOC (own project pinfjcxwwbbbwfqppqsj)
  products · recipes · ingredients · steps
  recipe_nutrition (view)
  bloc_recipes_v1 · bloc_recipe_ingredients_v1 ─── read, as the same person ──▶ household recipes
                                                                                 (read-only) → log a portion
  ◀──────────── bloc-backup-<date>.json, one-off, pick which recipes ─────────── exportData()
```

**Accounts.**
- Each person uses one account everywhere.
- The two projects have separate auth, so BLOC connects to the shared project
  once ("Household recipes · Connect"). With Google OAuth, that's one tap with
  the same Google account.

## 2. BLOC facts that shape the design

- **BLOC is local-first.**
  - Its source of truth is the `state` object in localStorage.
  - Its Supabase tables are a one-way mirror.
  - Its `recipe_ingredients` mirror has no macro columns.
- **Four macros only:** kcal, protein, carbs and fats.
- **A BLOC recipe is two objects joined by exact name:**
  - an entry in `state.recipes`
  - a food-library twin in `state.foodLibrary` with `source: 'recipe'`

  On the twin, `per100kcal/p/c/f` hold **per-serving** values
  (`_persistRecipe`). Pickers and logging read the twin.
- **Logging a recipe is per serving.**
  - `confirmRecipeLogTarget` → `openNutrServingModal` asks for servings eaten.
  - The diary entry copies the numbers (`{name, grams, servings, kcal, protein,
    carbs, fats, source}`), so later edits never change past logs.
- **Recipe ingredients copy their numbers** rather than link to a food:
  `{name, brand, grams, kcal, protein, carbs, fats, per1kcal…per1f?, source}`.
  - **Weight-based** (`barcode` / `library` / `manual-weight`): `grams` is a
    weight, and ml is treated as g.
  - **Per item** (`manual`) and **nested recipe** (`recipe`): `grams` holds a
    **count** (`isWeightEditableIngredient`).
- **Ingredients don't keep a barcode.**
  - Food-library entries do (`barcode`, local state only).
  - So an ingredient's barcode can be recovered by matching its name against
    `foodLibrary`.
- **Backup.**
  - `exportData()` shares `JSON.stringify(state)` as
    `bloc-backup-<date>.json`.
  - It contains `recipes`, `foodLibrary`, and everything else: training,
    diary, body data and settings.
  - BLOC recipe ids look like `recipe_<timestamp>`.
- **Scanner.** It uses native `BarcodeDetector` where available, with a
  fallback (near `_nativeDetector`). Lookup is Open Food Facts v2 from the
  browser (`fetchOFFProduct`). Treat it as a reference, not code to copy
  blindly.
- **Glyphs.** `fmtInch` prints ¼ ½ ¾ only when a value really is that quarter.
  Pinch follows the same rule, plus "≈" when it snaps a conversion.

## 3. BLOC → Pinch: one-off import (Lesson 15)

**Input:** a BLOC backup. Pinch then:

1. **Reads only `recipes` and `foodLibrary`.** Everything else is discarded and
   never stored or uploaded.
2. **Lists the recipes** with a checkbox each, showing servings and BLOC's
   per-serving kcal. The person ticks the ones to bring across.
3. **Maps each ticked recipe:**
   - **The recipe:**
     - `name` and `servings` become `name` and `serves`.
     - `meal` and `cuisine` are asked for, because BLOC doesn't have them.
     - The method is empty and can be added later.
     - BLOC's `id` is kept as `bloc_recipe_id`.
   - **Each ingredient becomes an ingredient linked to a product:**
     - **Weight-based:** qty = `grams`, unit `g`. The product is per 100 g, at
       `kcal / grams × 100` (likewise p/c/f), or `per1* × 100` when present.
     - **Per item (`manual`):** qty = `grams` (a count), unit `each`. The
       product is per item, at `kcal / grams`.
     - **Nested recipe (`recipe`):** flagged for the person to resolve, never
       imported silently.
   - **Product matching, in order:**
     1. recover a barcode by matching the ingredient name against
        `foodLibrary`
     2. reuse a household product with that barcode
     3. otherwise reuse one with the same name
     4. only then create a new product
4. **Reconciles before saving.** Pinch's per-serving macros (from
   `recipe_nutrition`) sit beside BLOC's `per_serving_*`, and differences
   beyond rounding are highlighted.
5. **Re-running is safe.** A recipe whose `bloc_recipe_id` already exists is
   skipped or offered as a replacement, never duplicated.

## 4. Pinch → BLOC

### 4.1 Nutrition is computed once, in SQL (Lesson 13)

`pinch.recipe_nutrition` (`security_invoker`) is the only place the maths
lives. For each ingredient with a product, the amount is brought to the
product's basis under the cups-only rule:

| ingredient unit | per 100 g product | per 100 ml product | per item product |
|---|---|---|---|
| g, kg | ✓ | ✗ (g ↔ ml never) | via `grams_per_item` |
| ml, l, tsp, tbsp | ✗ (ml ↔ g never) | ✓ | ✗ |
| cup | via density (cup → g) | ✓ (cup → ml) | ✗ |
| each | via `grams_per_item` | ✗ | ✓ |
| to taste | not counted | not counted | not counted |

- An ✗ counts as **missing**. It is never guessed.
- Totals are summed and divided by `serves`. Scaling never enters into it.
- The densities come from `pinch.densities`.

### 4.2 The contract: two versioned views (Lesson 15)

Adam writes these as a published interface, like a dbt exposure. BLOC reads
only these, never the base tables. A breaking change means `_v2`, never an
edit to `_v1`. Both are `security_invoker`, so household RLS applies to BLOC's
reads.

**`pinch.bloc_recipes_v1`**, one row per recipe:

| column | meaning |
|---|---|
| `id` | Pinch recipe uuid, the stable key in BLOC |
| `name`, `meal`, `cuisine` | as in Pinch |
| `serves` | servings the recipe makes |
| `kcal`, `protein`, `carbs`, `fats` | per serving |
| `nutrition_complete`, `missing_count` | whether every counted ingredient has nutrition |
| `bloc_recipe_id` | the BLOC recipe it was imported from, or null |
| `updated_at` | the latest change to the recipe or any product it uses |

**`pinch.bloc_recipe_ingredients_v1`**, one row per ingredient, for the
read-only list:

| column | meaning |
|---|---|
| `recipe_id`, `position` | key and order |
| `name`, `qty`, `unit` | as written in Pinch (for one recipe's worth, unscaled) |
| `kcal`, `protein`, `carbs`, `fats` | this ingredient's totals, or null if missing |
| `has_nutrition` | false when missing or not counted |

### 4.3 BLOC changes (built in `bloc-app` as pre-wired work)

Use the `app-session` skill.

1. **Connect.**
   - A second supabase-js client for the shared project, with its own
     `auth.storageKey`, because both apps share the github.io origin.
   - A Settings row: "Household recipes · Connect / Disconnect".
   - BLOC's URL must be on the shared project's Redirect URLs allow-list.
2. **Fetch and cache.**
   - Read both views on open and on refresh into `state.householdRecipes`,
     **not** `state.recipes` / `foodLibrary`.
   - That keeps them out of BLOC's own Supabase mirror and its name-joined
     twin logic, and they still work offline.
3. **Show.**
   - Household recipes appear in the log routes (Fuel › Shortcuts › Recipes;
     Add food › Recipes) with a household marker.
   - Opening one shows its ingredient list **read-only**: no edit, add, delete
     or scan.
   - Incomplete ones are not loggable, with "N ingredients need nutrition in
     Pinch".
4. **Lock imported personal recipes.**
   - A personal recipe whose `id` equals some household recipe's
     `bloc_recipe_id` is no longer editable.
   - It is hidden from the pickers and the builder, so the household version
     is the only one shown.
   - Past diary entries are untouched.
5. **Log.**
   - Servings eaten × per-serving, through the existing serving modal.
   - The diary entry is a snapshot with `source: 'household-recipe'` and
     `householdRecipeId`.
   - Audit every reader of diary entries with `source === 'recipe'` (re-open,
     edit, "save meal as recipe", the `meal_items` mirror), and decide what
     each does for the new source.
6. **Degrade quietly.**
   - Not connected: the feature is hidden.
   - Offline: the cache is used.
   - A failed fetch keeps the cache and says so.
   - Coach and demo modes are unaffected.
7. **Regression.** Personal recipes, the builder, the existing imports and the
   share sheet all behave exactly as before.

## 5. Web import and the Claude key (Lesson 14)

- **The `pinch-import` Edge Function** lives in `silver-octo-invention`, on the
  shared project.
- **How it reads a link:**
  - it fetches the URL and uses schema.org `Recipe` JSON-LD when present
  - otherwise, it sends the page text to Claude
  - either way, it returns one draft shape
- **How it handles pasted text:** it's parsed in the app, and only the lines
  the parser can't read go to Claude.
- **The key:**
  - It's a function secret, used only when the caller's JWT is valid **and**
    `shared_finance_ledger.my_household_ids()` (called as the caller)
    includes a household listed in the `PINCH_AI_HOUSEHOLDS` secret.
  - Everyone else is refused, including other households on the same
    project.
  - Without a household key, each person's own key (kept on their device, as
    in BLOC) is sent with each request, used for that request only, and never
    stored or logged.
- **Guards:** http(s) only; a response size cap; a timeout; a small daily cap
  per household.
- **The model:** a small, cheap model. Check the `claude-api` skill for the
  current model id when building.
