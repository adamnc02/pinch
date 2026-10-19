# Pinch — design hand-off for Claude Code

Pinch is a single-page PWA that holds a household's recipes in one place. This folder holds the finished design. Build from it; don't redesign it.

> **How to work with Adam:** he is learning to build this. The repo's `lesson` and `check-my-work` skills set the order and track progress. Adam wires up the main app page (Home) himself. The rest is pre-wired in small pieces that he reviews and explains back. Pure logic comes as test-first tasks he writes himself. Check those skills before starting any work.

## What's in this folder

| Path | What it is |
|---|---|
| `design/tokens.css` | **Source of truth** for colour, type, radii, shadows, the photo fades and the page edge fades. Light + dark. Copy into the app as-is. |
| `design/reference.html` | Static HTML/CSS for screens 01–06, built only from the tokens. Open it in a browser (`?theme=dark` forces dark, `?frame=03` shows one screen). Lift the CSS class by class. |
| `design/reference-additions.html` | Screens 08–15, in the same system and with the same URL options. |
| `design/splash.html` | The animated splash/loading screen, ready to use (`?loop` repeats it for review). |
| `screenshots/` | PNGs of every screen in light and dark, plus three splash frames. |
| `icons/` | Final app icon, Apple touch icon, maskable PWA icons and favicons, plus SVG sources. |
| `fonts/` | Plus Jakarta Sans variable woff2 (normal + italic), self-hosted so the app works offline. OFL licence included. |
| `manifest.webmanifest` | Starter PWA manifest wired to the icons. |
| `_original-design/` | The first version of the reference, tokens, README and screens 01–06, kept for comparison. |

## Brand decisions (final)

- **Name:** Pinch
- **Palette:** Sage (green accent on cool off-whites), with a full dark mode
- **Typeface:** Plus Jakarta Sans for everything. Headings are 700 weight with −0.03em tracking. Amounts use `font-variant-numeric: tabular-nums`.
- **Icon:** salt and pepper shakers: a white salt shaker and a mint pepper shaker on sage green.
- **Icons in the UI:** Lucide-style 1.8px stroke icons. The exact paths are in the sprites at the top of the two reference files. Lucide is fine to use directly.
- **No emoji anywhere.** Country flags are drawn as small components (see Flags below), never as emoji.

## Screens (see `screenshots/`)

### 01 Home: by meal / 02 Home: by cuisine
- **Header:** the "Pinch" wordmark on the left, a settings (gear) icon button on the right that opens Settings (08).
- **Segmented control:** `By meal | By cuisine`.
  - By meal: chips `All · Breakfast · Lunch · Dinner`.
  - By cuisine: chips are `All` plus one chip per cuisine actually used, each with a small flag.
  - The chip row scrolls sideways.
- **Grid:** two columns, 12px gap, 20px side padding. Only the grid scrolls; the header and filters stay still.
- **Page edge fades** (as in BLOC and Listly), anchored to the scrolling box, not the page:
  - **Top:** 20px, so the grid dissolves under the filters.
  - **Bottom:** 124px, so cards fade out behind the add button.
  - Build each gradient from `--bg-rgb` with the transparent end written as `rgb(var(--bg-rgb) / 0)`. Never use `transparent`, which some browsers interpolate through black.
  - Give each fade `pointer-events: none`, so it can never swallow a tap.
- **Recipe card:** 200px tall.
  - The meal photo fills the whole card. With no photo, the cuisine's flag sits centred on the `--sunk` panel.
  - The bottom fades into the card colour (`--fade-card`). The title (16px/700, one line with ellipsis) and the meta line (`Dinner · Italy`) sit on the fade.
  - There is no button on the card: tapping it opens the recipe.
- **Add button:** a round 60px accent button, fixed bottom right, labelled "Add recipe".
- Keep the main screen uncluttered. No search bar, counts or extra chrome unless Adam asks for them.

### 03 / 04 Recipe sheet: Ingredients / Method
- Tapping a card opens a **centred** sheet over a scrim: the full width minus 16px each side, 28px radius.
- **Header:** the photo is the whole header (224px), with an eased fade at the bottom (`--fade-sheet`). With no photo, show the flag on `--sunk`.
  - **Top left, over the image:** `DINNER · ITALY` in white, 12px/700 uppercase with 0.08em tracking and a soft text shadow. No background behind it.
  - **Top right:** the close button, a 44px circle in `rgba(0,0,0,.32)` with a white ×.
  - **Bottom right, above the title:** an edit (pencil) button, a 44px surface-coloured circle.
  - **Title:** 24px/700, sitting on the fade.
- **Below the header, in this order:**
  1. **Servings card:**
     - **Left:** "Serves" with "recipe serves 4" beneath it.
     - **Right:** − / `6` / +, which changes the servings one at a time, with a minimum of 1.
     - Every amount, including the tagged ingredients in the method, scales by (servings ÷ recipe serves) and updates live.
     - It opens at the recipe's own servings. Nothing is saved.
  2. **Tabs:** a segmented control, `Ingredients | Method`.
  3. **Content:**
     - Ingredients: name on the left, scaled amount on the right, with dividers.
     - Method: numbered steps. Each step's **tagged ingredients** sit underneath it in *italic, 12.5px, muted* type as `Name amount · Name amount`, scaled like everything else.
- **Flip:** switching tabs flips the content area like a card (3D `rotateY`, about 450ms, ease-in-out). Keep the header still so the flip doesn't jar. With `prefers-reduced-motion`, cross-fade instead.

### 05 / 06 / 15 Add recipe
- A bottom sheet with a grab handle, title "New recipe" and a close button. At the top, two option tiles:
  - **Enter ingredients (05):**
    - Recipe name.
    - **Serves** stepper. This is a required integer, minimum 1.
    - **Cuisine** select with a flag.
    - **Meal**: Breakfast / Lunch / Dinner, required, choose one.
    - **Optional photo.** If it's skipped, the flag is used.
    - **Ingredients:** `Scan barcode` (primary) and `Add manually` (secondary), with added rows underneath.
    - Then the method editor (14).
  - **Import from web (06, 15):**
    - **One box takes a link or the whole recipe's text,** then Serves and Meal, then `Read recipe`.
    - **A link is recognised** ("Link found · site") and read on the server (see Web import). Text is split into ingredients and steps.
    - **Either way, the result drops into Check ingredients (13)** and then the method editor, so the cook can check and fix it.

### 08 Settings
The same bottom-sheet pattern. It has these groups:
- **Household:** who recipes are shared with, and Sign out.
- **Appearance:** System / Light / Dark, set as `data-theme` on `<html>`, as `tokens.css` expects.
- **Show amounts as:** As written / Metric / Cups, plus **Cup size** (Metric 250 ml / US 237 ml).
- **Import from web:** the status of the household key, or the key field (see Web import).
- **Your data:** "Import recipes from BLOC" and "Back up recipes".

### 09 Add ingredient · 10 New product
- **09: a name, an amount, and a unit chosen from the controlled list.**
  - Typing a name lists matching **household products** first, so a product is only scanned once.
  - Otherwise there's Scan barcode or From label.
  - An ingredient can be saved without a product. It is then marked "needs nutrition".
- **10: a product entered from the label.**
  - Fields: name, brand, optional barcode.
  - Nutrition **per 100 g / per 100 ml / per item**, as kcal, protein, carbs and fat.
  - An optional weight of one item, so "2 tins" can become grams.
  - Products are shared with the household.

### 11 Scan barcode · 12 Scan result
- **11:**
  - A full-screen camera in both themes, with corner guides in `--brand-pepper` and a scan line.
  - A pill shows which ingredient the scan is for.
  - It has a torch toggle, "Type the number" and "Enter from the label".
  - If camera access is refused, show only those two buttons, with one line saying why.
- **12:**
  - A sheet over the paused camera, labelled with its source: "Open Food Facts", or "In your products" if the barcode is already a household product (no network call).
  - It shows the per-100 values with "Check against the label", then Edit details / Use product.

### 13 Check ingredients
Shown after an import, and from Edit for any recipe with ingredients that need nutrition.
- **Progress bar** at the top: "N of M have nutrition".
- **Linking:** ingredients whose names match a household product are linked automatically.
- **One row is open at a time.** It has:
  - rename (pencil) and delete (bin)
  - the amount and a **g | ml | cup** switch
  - Scan / Products, then From the label / Skip for now
- **The unit switch converts the stored amount:**
  - Below it, the other units are shown ("Same as 375 ml · about 200 g").
  - **Conversions only go to or from cups:**
    - ml ↔ cup is fixed arithmetic.
    - g ↔ cup needs the ingredient's density. Without one, that option is disabled, with the reason.
    - g ↔ ml is never offered.
  - So the switch shows the ingredient's own unit plus cup. An amount in cups can go to either g or ml (as in the mockup).
  - **Cups use the ¼ ½ ¾ glyphs, as BLOC does.** BLOC only prints a glyph when the value really is that quarter. A conversion *into* cups can snap to the nearest quarter, so it is shown with "≈" (e.g. "≈ ¾ cup"). Amounts typed in cups show exactly.
- **"To taste" rows** are listed as not counted.
- **Sticky footer:** `Scan next: <name>` (primary) and "Save recipe · N can be finished later".

### 14 Method editor
- **Steps are free text, numbered.**
- **The step being edited opens** with its text box and a "Tap the ingredients this step uses" chip list. A pressed chip has a check.
- **Tags are stored as ingredient IDs,** so the italic line under the step scales.
- **Arrows move a step up or down,** and the bin deletes it. There is no drag.
- **Deleting an ingredient removes its tags.**

### 07 Splash
`design/splash.html` is final. In 4.2s:
1. The two shakers rise in.
2. They tip towards each other and shake out salt crystals and peppercorns.
3. They settle, then "Pinch" fades in above a thin loading bar.

Play it once on launch and dismiss it when data is ready, but no sooner than about 2.8s. Dark mode uses `#101311`. Reduced motion shows a still frame.

## Behaviour and data notes
- **Backend:** the shared Supabase project that personal-f, shared-finance-ledger and Listly use (`nxekrfdagkdwhjuunsrl`). Its migrations live in the `silver-octo-invention` repo.
  - Pinch gets its own `pinch` schema, household-scoped like Listly. Both people in the household get the same access.
  - BLOC is on a separate project.
- **Shape:**
  - `recipes`: id, household_id, name, serves int, meal enum, cuisine country code, photo_path null, created_by, timestamps
  - `ingredients`: id, household_id, recipe_id, name, qty numeric null, unit, product_id null, position
  - `steps`: id, household_id, recipe_id, position, text
  - `step_ingredients`: household_id, recipe_id, step_id, ingredient_id. Composite keys, so a step can only tag its own recipe's ingredients.
  - `products`:
    - household_id, name, brand, barcode null (unique within the household)
    - nutrition basis (100 g / 100 ml / item), kcal, protein, carbs, fat
    - grams_per_item null
  - Photos go in a household-scoped Storage bucket.
- **Nutrition:**
  - It lives only on products. Recipes and ingredients carry no macro columns.
  - Per-serving nutrition is computed once, in SQL, and an ingredient that can't be converted to its product's basis is reported as missing.
  - **BLOC reads it through a versioned view.** Each person's BLOC shows household recipes with a read-only ingredient list and logs portions.
  - **No export.** Pinch doesn't export to BLOC: BLOC reads the view, so there is no export button.
  - **Imported recipes are locked in BLOC.** Recipes imported into Pinch from a BLOC backup can no longer be edited in BLOC.
- **Units:** g, kg, ml, l, tsp, tbsp, cup, "each" (with count words like tin or clove), and "to taste".
- **Scaling:** amount × (servings ÷ recipe serves). Round sensibly: ¼ ½ ¾ for spoons and cups, whole numbers for eggs.
- **Barcode scanning:** use the camera (`BarcodeDetector` where available, with a library such as ZXing as the fallback). Look up the household's products first, then Open Food Facts, and always let the user confirm or edit the result.
- **Web import** (`pinch-import` Edge Function on the shared project):
  - **Lookup order:** the page's schema.org Recipe data first; Claude for pages without it; the pasted-text path as the last resort.
  - **Text is split into amounts, units and names** by a pure function. Claude handles the lines that function can't, and suggests step tags.
  - **The Anthropic key is a function secret.** The function serves only signed-in members of the households listed in its configuration and refuses everyone else, including other households on the same project.
  - **It accepts only http(s) links,** with size and time limits.
  - **Without a household key:** each person adds their own key in Settings, stored on the device as BLOC does.
- **Theme:** follow the OS by default. Settings offers System / Light / Dark.
- **Hosting:** GitHub Pages at `https://adamnc02.github.io/pinch/`, the same origin as Adam's other apps.
  - Namespace localStorage keys and cache names with `pinch`.
  - Keep the service worker scope to `/pinch/`.
  - Give supabase-js its own `auth.storageKey`.

## Flags
Recipes without a photo show their cuisine's flag. Build a small `<Flag code="IT" />`-style component that renders stripes and dots in CSS, like the six examples in `reference.html` (Italy, Japan, Thailand, France, Switzerland, India), or use a reliable SVG flag set. Show flags at 60×40 on cards, 20×14 in chips, with a 5px radius and a hairline shadow.

## Accessibility
- Touch targets are at least 44px.
- All icon buttons have `aria-label`s.
- The tabs are real buttons with `aria-selected`.
- Sheets use `role="dialog"`, trap focus, and close on Esc and on a scrim tap.
- Text contrast meets AA in both themes with the token colours. Don't lighten `--muted`.

## PWA `<head>`
Paths are **relative**, because the app is served from `/pinch/`, not from the site root. `manifest.webmanifest` still has root paths (`"start_url": "/"`, `/icons/…`), which would launch the github.io root instead of Pinch. Fixing it is part of the deploy lesson.

```html
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#F4F5F1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101311" media="(prefers-color-scheme: dark)">
```
