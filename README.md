# Pinch — design hand-off for Claude Code

Pinch is a single-page PWA for keeping all of Adam's recipes in one place. This folder holds the finished design. Build from it; don't redesign it.

> **How to work with Adam:** he wants to *learn* to build this, not have it built for him. Work in small lessons, explain the why, and let him write the code. He follows single-file apps best (like his BLOC app) and is comfortable with imports across files (like his personal ledger app). Check how his existing lesson-plan and check-my-work skills track progress before starting.

## What's in this folder

| Path | What it is |
|---|---|
| `design/tokens.css` | **Source of truth** for colour, type, radii, shadows and the photo fades. Light + dark. Copy into the app as-is. |
| `design/reference.html` | Static HTML/CSS for every screen, built only from the tokens. Open it in a browser (`?theme=dark` forces dark). Lift the CSS class by class. |
| `design/splash.html` | The animated splash/loading screen, ready to use (`?loop` repeats it for review). |
| `screenshots/` | PNGs of every screen in light and dark, plus three splash frames. |
| `icons/` | Final app icon, Apple touch icon, maskable PWA icons and favicons, plus SVG sources. |
| `fonts/` | Plus Jakarta Sans variable woff2 (normal + italic), self-hosted so the app works offline. OFL licence included. |
| `manifest.webmanifest` | Starter PWA manifest wired to the icons. |

## Brand decisions (final)

- **Name:** Pinch
- **Palette:** Sage (green accent on cool off-whites), with a full dark mode
- **Typeface:** Plus Jakarta Sans for everything. Headings are 700 weight with −0.03em tracking. Amounts use `font-variant-numeric: tabular-nums`.
- **Icon:** salt and pepper shakers: a white salt shaker and a mint pepper shaker on sage green.
- **Icons in the UI:** Lucide-style 1.8px stroke icons. The exact paths are in the sprite at the top of `reference.html`. Lucide is fine to use directly.
- **No emoji anywhere.** Country flags are drawn as small components (see Flags below), never as emoji.

## Screens (see `screenshots/`)

### 01 Home: by meal / 02 Home: by cuisine
- **Header:** the "Pinch" wordmark on the left, a settings (gear) icon button on the right. It opens the Settings/Account sheet, which is not designed yet. Use the same bottom-sheet pattern as Add recipe.
- **Segmented control:** `By meal | By cuisine`.
  - By meal: chips `All · Breakfast · Lunch · Dinner`.
  - By cuisine: chips are `All` plus one chip per cuisine actually used, each with a small flag.
  - The chip row scrolls sideways.
- **Grid:** two columns, 12px gap, 20px side padding.
  - **Recipe card:** 200px tall. The meal photo fills the whole card. With no photo, the cuisine's flag sits centred on the `--sunk` panel.
  - The bottom of the card fades into the card colour (`--fade-card`). The title (16px/700, one line with ellipsis), the meta line (`Dinner · Italy`) and a small **export** icon button (bottom right) sit on the fade.
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
  1. **Scaler card:** `Serves 6 · recipe serves 4` on the left. On the right, − / `×1.5` / +. Steps: ×0.5, ×1, ×1.5, ×2, ×3, ×4. Every amount, including the tagged ingredients in the method, updates live.
  2. **Tabs:** a segmented control, `Ingredients | Method`.
  3. **Content:**
     - Ingredients: name on the left, scaled amount on the right, with dividers.
     - Method: numbered steps. Each step's **tagged ingredients** sit underneath it in *italic, 12.5px, muted* type as `Name amount · Name amount`, scaled like everything else.
- **Flip:** switching tabs flips the content area like a card (3D `rotateY`, about 450ms, ease-in-out). Keep the header still so the flip doesn't jar. With `prefers-reduced-motion`, cross-fade instead.

### 05 / 06 Add recipe
- A bottom sheet with a grab handle, title "New recipe" and a close button. At the top, two option tiles:
  - **Enter ingredients (05):**
    - Recipe name.
    - **Serves** stepper. This is a required integer, minimum 1.
    - **Cuisine** select with a flag.
    - **Meal**: Breakfast / Lunch / Dinner, required, choose one.
    - **Optional photo.** If it's skipped, the flag is used.
    - **Ingredients:** a `Scan barcode` button (primary) and an `Add manually` button (secondary), with added rows listed underneath.
    - Then the method editor (not drawn). Steps are free text. While writing a step, the cook taps ingredients from the recipe's list to **tag** them to that step. Store the tags as ingredient IDs so amounts scale.
  - **Import from web (06):** a multi-paragraph text box for pasting a whole recipe, then Serves and Meal, then `Read recipe`. Parse it into ingredients and steps, then drop into the same editor so the cook can check and fix the result.

### 07 Splash
`design/splash.html` is final. In 4.2s:
1. The two shakers rise in.
2. They tip towards each other and shake out salt crystals and peppercorns.
3. They settle, then "Pinch" fades in above a thin loading bar.

Play it once on launch and dismiss it when data is ready, but no sooner than about 2.8s. Dark mode uses `#101311`. Reduced motion shows a still frame.

## Behaviour and data notes
- **Backend:** Adam's **existing Supabase project**, which he shares with Ella, as his personal-ledger and Listly apps already do. Both of them get the same access to recipes. Connection details are on his laptop, so ask him for them rather than creating a new project.
- **Suggested shape:**
  - `recipes` (id, name, serves int, meal enum, cuisine/country code, photo_url null, created_by, timestamps)
  - `ingredients` (id, recipe_id, name, quantity numeric, unit, barcode null, position)
  - `steps` (id, recipe_id, position, text)
  - `step_ingredients` (step_id, ingredient_id)
- **Units:** support g, kg, ml, l, tsp, tbsp, cup, and "each". Converting between cups and g/ml is wanted, and a free API is fine if a good one exists.
- **Scaling:** amount × (target serves ÷ recipe serves). Round sensibly (for example ½ and ¼ for spoons, whole numbers for eggs).
- **Export button on each card:** export in the **JSON format that Adam's BLOC app imports**, so meals log straight into BLOC. The schema lives in the BLOC repo, so check it there. Pinch stores no nutrition data. Adam adds nutrition per ingredient in BLOC.
- **Barcode scanning:** use the camera (for example `BarcodeDetector`, with a library such as ZXing as the fallback). Look products up by barcode to fill in the ingredient name, and let the user edit the result.
- **Theme:** follow the OS by default. Settings offers System / Light / Dark by setting `data-theme` on `<html>`, as `tokens.css` expects.

## Flags
Recipes without a photo show their cuisine's flag. Build a small `<Flag code="IT" />`-style component that renders stripes and dots in CSS, like the six examples in `reference.html` (Italy, Japan, Thailand, France, Switzerland, India), or use a reliable SVG flag set. Show flags at 60×40 on cards, 20×14 in chips, with a 5px radius and a hairline shadow.

## Accessibility
- Touch targets are at least 44px.
- All icon buttons have `aria-label`s.
- The tabs are real buttons with `aria-selected`.
- Sheets use `role="dialog"`, trap focus, and close on Esc and on a scrim tap.
- Text contrast meets AA in both themes with the token colours. Don't lighten `--muted`.

## PWA `<head>`
```html
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#F4F5F1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#101311" media="(prefers-color-scheme: dark)">
```
