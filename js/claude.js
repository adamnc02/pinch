// Claude, called straight from the browser with the person's own API key,
// the way BLOC does. The key lives only in this device's localStorage
// (prefs.js, `pinch.anthropicKey`) and goes only to api.anthropic.com. No
// Pinch server ever sees it.
//
// Used by Import from web for a page with no recipe data, and for ingredient
// lines Pinch's own parser couldn't read. Claude Haiku 5.5, low effort,
// JSON-schema output.

import { RECIPE_SCHEMA, LINES_SCHEMA, CUPS_SCHEMA, recipeFromClaude, linesFromClaude, cupMeasuresFromClaude } from './lib/claude-shape.js';
import { UNITS } from './lib/units.js';

const MODEL = 'claude-haiku-5-5';

async function call(apiKey, system, content, schema) {
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 8000,
        system,
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        messages: [{ role: 'user', content }],
      }),
    });
  } catch {
    throw new Error(navigator.onLine === false ? 'You\u2019re offline.' : 'Couldn\u2019t reach Claude. Check the connection.');
  }
  if (res.status === 401) throw new Error('Your Claude key was refused. Check it in Settings \u203a Import from web.');
  if (res.status === 429 || res.status === 529) throw new Error('Claude is busy. Try again in a minute.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Claude answered ${res.status}.`);
  }
  const data = await res.json();
  if (data.stop_reason === 'refusal' || data.stop_reason === 'max_tokens') return null;
  const text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  try { return JSON.parse(text); } catch { return null; }
}

// A page's text → the import shape, or null when there's no recipe in it.
export async function recipeFromPage(apiKey, text) {
  const out = await call(apiKey,
    'You extract one recipe from the text of a web page. Copy ingredient lines and method steps as written, ' +
    'one per array item, without inventing anything. servings is how many the recipe serves, or 0 if the page ' +
    'does not say. cuisine is an ISO 3166-1 alpha-2 country code when the page makes the cuisine clear, else "". ' +
    'If the page has no recipe, set found to false and leave the arrays empty.',
    text, RECIPE_SCHEMA);
  return recipeFromClaude(out);
}

// Ingredient lines → [{ line, qty, unit, name }] for the lines Claude could split.
export async function splitLines(apiKey, lines) {
  const out = await call(apiKey,
    'You split recipe ingredient lines into a quantity, a unit and a name. The unit must be one of: ' +
    UNITS.join(', ') + '. Use "each" for counted things (eggs, tins, cloves) and keep the count word in the ' +
    'name ("tins chopped tomatoes"). Convert fractions to decimals. Use qty 0 with unit "to taste" when no ' +
    'amount is given. Return one item per input line, in order, with `line` copied exactly.',
    lines.join('\n'), LINES_SCHEMA);
  return linesFromClaude(out, lines);
}

// Ingredient names Pinch has no density for → { densities, notCup }. Used by
// "Look up cup measures" on the recipe sheet in cups mode.
export async function cupMeasures(apiKey, names) {
  const out = await call(apiKey,
    'For each ingredient, say whether it is sensibly measured by volume in cups in home cooking (flours, sugars, ' +
    'grains, pasta, pulses, nuts, seeds, grated cheese, chopped vegetables, sauces and liquids are; whole pieces of ' +
    'meat or fish, eggs, whole fruit and vegetables, tins and packets are not), and if it is, how many grams fill ' +
    'one metric cup (250 ml) of it as it is usually measured. Use 0 grams when it is not cup-measurable. Return one ' +
    'item per input name, with `name` copied exactly.',
    names.join('\n'), CUPS_SCHEMA);
  return cupMeasuresFromClaude(out, names);
}
