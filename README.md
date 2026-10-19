# Pinch

Pinch is the shared recipe library for Adam and Ella's household: a PWA with
recipes, servings scaling, unit conversion, per-step ingredient tags and
product-based nutrition that BLOC can read.

It's also a teaching project. Adam is building it lesson by lesson.

## Where things are

| Path | What it is |
|---|---|
| `CLAUDE.md` | Project rules: data model, constraints, who writes what |
| `PROGRESS.md` | Current lesson and task (the single source of truth) |
| `design-handoff/` | The final design: spec, tokens, reference HTML, screenshots, icons, fonts |
| `.claude/skills/` | The `lesson` and `check-my-work` skills that drive the curriculum |

## Running it locally

No build step and no npm. Serve the folder over HTTP (ES modules don't load
from `file://`):

```sh
python3 -m http.server 8000
```

- Mac: http://localhost:8000
- Phone (same Wi-Fi): http://<Mac LAN IP>:8000

## Live

https://adamnc02.github.io/pinch/ (GitHub Pages, served from the repo root)

## Stack

Vanilla JavaScript with native ES modules, plain CSS from the design tokens,
and later Supabase (its own `pinch` schema in the shared household project).
