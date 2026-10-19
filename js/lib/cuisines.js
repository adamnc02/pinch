// The cuisines a recipe can have: ISO 3166-1 alpha-2 codes, with the words
// an imported page uses for them. The flag for each is in
// js/components/flag.js; a code with no entry here shows its letters.

export const CUISINES = [
  { code: 'AR', name: 'Argentina', words: ['argentine', 'argentinian'] },
  { code: 'BR', name: 'Brazil', words: ['brazilian'] },
  { code: 'CA', name: 'Canada', words: ['canadian'] },
  { code: 'CH', name: 'Switzerland', words: ['swiss'] },
  { code: 'CN', name: 'China', words: ['chinese', 'cantonese', 'sichuan', 'szechuan'] },
  { code: 'DE', name: 'Germany', words: ['german'] },
  { code: 'ES', name: 'Spain', words: ['spanish', 'catalan', 'basque'] },
  { code: 'ET', name: 'Ethiopia', words: ['ethiopian'] },
  { code: 'FR', name: 'France', words: ['french', 'provencal'] },
  { code: 'GB', name: 'United Kingdom', words: ['british', 'english', 'scottish', 'welsh', 'uk'] },
  { code: 'GR', name: 'Greece', words: ['greek'] },
  { code: 'ID', name: 'Indonesia', words: ['indonesian', 'balinese'] },
  { code: 'IE', name: 'Ireland', words: ['irish'] },
  { code: 'IN', name: 'India', words: ['indian', 'punjabi', 'goan', 'keralan'] },
  { code: 'IT', name: 'Italy', words: ['italian', 'sicilian', 'tuscan'] },
  { code: 'JM', name: 'Jamaica', words: ['jamaican', 'caribbean'] },
  { code: 'JP', name: 'Japan', words: ['japanese'] },
  { code: 'KR', name: 'South Korea', words: ['korean'] },
  { code: 'LB', name: 'Lebanon', words: ['lebanese', 'levantine', 'middle eastern'] },
  { code: 'MA', name: 'Morocco', words: ['moroccan', 'north african'] },
  { code: 'MX', name: 'Mexico', words: ['mexican', 'tex-mex'] },
  { code: 'MY', name: 'Malaysia', words: ['malaysian', 'malay'] },
  { code: 'NG', name: 'Nigeria', words: ['nigerian', 'west african'] },
  { code: 'PE', name: 'Peru', words: ['peruvian'] },
  { code: 'PH', name: 'Philippines', words: ['filipino', 'philippine'] },
  { code: 'PK', name: 'Pakistan', words: ['pakistani'] },
  { code: 'PT', name: 'Portugal', words: ['portuguese'] },
  { code: 'SE', name: 'Sweden', words: ['swedish', 'scandinavian', 'nordic'] },
  { code: 'TH', name: 'Thailand', words: ['thai'] },
  { code: 'TR', name: 'Turkey', words: ['turkish'] },
  { code: 'US', name: 'United States', words: ['american', 'southern', 'cajun', 'usa'] },
  { code: 'VN', name: 'Vietnam', words: ['vietnamese'] },
  { code: 'ZA', name: 'South Africa', words: ['south african'] },
];

const BY_CODE = new Map(CUISINES.map((c) => [c.code, c]));

export function cuisineName(code) {
  if (!code) return '';
  return BY_CODE.get(code)?.name ?? code;
}

// A page's recipeCuisine ("Italian", "Indian, Vegetarian", "IT") as a code,
// or null when none of its words is known.
export function cuisineFromText(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  if (/^[a-z]{2}$/.test(t.trim()) && BY_CODE.has(t.trim().toUpperCase())) return t.trim().toUpperCase();
  for (const c of CUISINES) {
    if (t.includes(c.name.toLowerCase())) return c.code;
    if (c.words.some((w) => new RegExp(`\\b${w}\\b`).test(t))) return c.code;
  }
  return null;
}
