// flag(code, size) → a small flag, drawn as SVG (never emoji). 'lg' is the
// 60×40 card/sheet flag, 'sm' the 20×14 chip flag. A code with no drawing
// shows its letters on a neutral panel.
//
// Flags are simplified to read at 20×14: stripes, discs, crosses and stars
// in the right colours, not every emblem.

import { cuisineName } from '../lib/cuisines.js';

const W = '#F4F5F0';
const rect = (x, y, w, hh, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${fill}"/>`;
const v3 = (a, b, c) => rect(0, 0, 10, 20, a) + rect(10, 0, 10, 20, b) + rect(20, 0, 10, 20, c);
const h3 = (a, b, c) => rect(0, 0, 30, 6.67, a) + rect(0, 6.67, 30, 6.67, b) + rect(0, 13.33, 30, 6.67, c);
const disc = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
function star(cx, cy, r, fill) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.4 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
}
const stripes = (n, a, b) => Array.from({ length: n }, (_, i) => rect(0, (20 / n) * i, 30, 20 / n + 0.05, i % 2 ? b : a)).join('');
const nordic = (bg, fg) => rect(0, 0, 30, 20, bg) + rect(9, 0, 4, 20, fg) + rect(0, 8, 30, 4, fg);

const FLAGS = {
  IT: v3('#009246', W, '#CE2B37'),
  FR: v3('#0055A4', W, '#EF4135'),
  IE: v3('#169B62', W, '#FF883E'),
  NG: v3('#008751', W, '#008751'),
  PE: v3('#D91023', W, '#D91023'),
  MX: v3('#006847', W, '#CE1126') + disc(15, 10, 2.6, '#8C5A2B'),
  DE: h3('#000000', '#DD0000', '#FFCE00'),
  ES: rect(0, 0, 30, 20, '#AA151B') + rect(0, 5, 30, 10, '#F1BF00'),
  ID: rect(0, 0, 30, 10, '#CE1126') + rect(0, 10, 30, 10, W),
  TH: rect(0, 0, 30, 20, '#A51931') + rect(0, 3.33, 30, 13.34, W) + rect(0, 6.67, 30, 6.66, '#2D2A4A'),
  IN: h3('#FF9933', W, '#138808') + disc(15, 10, 2.6, 'none', 'stroke="#000080" stroke-width="0.8"'),
  JP: rect(0, 0, 30, 20, W) + disc(15, 10, 6, '#BC002D'),
  KR: rect(0, 0, 30, 20, W) + `<path d="M9 10a6 6 0 0 1 12 0a3 3 0 0 1-6 0a3 3 0 0 0-6 0z" fill="#CD2E3A"/><path d="M21 10a6 6 0 0 1-12 0a3 3 0 0 1 6 0a3 3 0 0 0 6 0z" fill="#0047A0"/>`,
  CH: rect(0, 0, 30, 20, '#DA291C') + rect(13, 4, 4, 12, '#FFFFFF') + rect(9, 8, 12, 4, '#FFFFFF'),
  SE: nordic('#006AA7', '#FECC00'),
  GR: stripes(9, '#0D5EAF', W) + rect(0, 0, 11.1, 11.1, '#0D5EAF') + rect(4.45, 0, 2.2, 11.1, W) + rect(0, 4.45, 11.1, 2.2, W),
  PT: rect(0, 0, 12, 20, '#006600') + rect(12, 0, 18, 20, '#FF0000') + disc(12, 10, 3.6, '#FFCC00'),
  GB: rect(0, 0, 30, 20, '#012169')
    + '<path d="M0 0L30 20M30 0L0 20" stroke="#FFFFFF" stroke-width="4"/>'
    + '<path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.4"/>'
    + rect(12, 0, 6, 20, '#FFFFFF') + rect(0, 7, 30, 6, '#FFFFFF') + rect(13.2, 0, 3.6, 20, '#C8102E') + rect(0, 8.2, 30, 3.6, '#C8102E'),
  US: stripes(13, '#B22234', W) + rect(0, 0, 12, 10.8, '#3C3B6E') + star(3, 3, 1.3, W) + star(7.5, 3, 1.3, W) + star(5.25, 6, 1.3, W) + star(3, 9, 1.3, W) + star(7.5, 9, 1.3, W),
  CA: rect(0, 0, 30, 20, W) + rect(0, 0, 7.5, 20, '#D52B1E') + rect(22.5, 0, 7.5, 20, '#D52B1E') + star(15, 10.3, 4.3, '#D52B1E'),
  CN: rect(0, 0, 30, 20, '#DE2910') + star(6, 6, 3.2, '#FFDE00') + star(11.5, 2.8, 1, '#FFDE00') + star(13, 5.5, 1, '#FFDE00') + star(13, 8.6, 1, '#FFDE00') + star(11.5, 11, 1, '#FFDE00'),
  VN: rect(0, 0, 30, 20, '#DA251D') + star(15, 10.5, 5.5, '#FFFF00'),
  TR: rect(0, 0, 30, 20, '#E30A17') + disc(12, 10, 5, W) + disc(13.3, 10, 4, '#E30A17') + star(18.5, 10, 2.4, W),
  PK: rect(0, 0, 7.5, 20, W) + rect(7.5, 0, 22.5, 20, '#01411C') + disc(19, 10, 5, W) + disc(20.6, 8.8, 4.3, '#01411C') + star(22, 7.6, 1.8, W),
  MA: rect(0, 0, 30, 20, '#C1272D') + star(15, 10.5, 5, 'none').replace('fill="none"', 'fill="none" stroke="#006233" stroke-width="1"'),
  LB: rect(0, 0, 30, 20, '#ED1C24') + rect(0, 5, 30, 10, W) + '<polygon points="15,5.8 19.5,13.6 10.5,13.6" fill="#00A651"/>',
  BR: rect(0, 0, 30, 20, '#009C3B') + '<polygon points="15,2.5 27,10 15,17.5 3,10" fill="#FFDF00"/>' + disc(15, 10, 4.3, '#002776'),
  AR: rect(0, 0, 30, 20, '#74ACDF') + rect(0, 6.67, 30, 6.66, W) + disc(15, 10, 1.9, '#F6B40E'),
  JM: rect(0, 0, 30, 20, '#009B3A') + '<polygon points="0,0 13,10 0,20" fill="#000000"/><polygon points="30,0 17,10 30,20" fill="#000000"/>'
    + '<path d="M0 0L30 20M30 0L0 20" stroke="#FED100" stroke-width="2.6"/>',
  ET: h3('#078930', '#FCDD09', '#DA121A') + disc(15, 10, 4, '#0F47AF') + star(15, 10.2, 2.8, '#FCDD09'),
  PH: rect(0, 0, 30, 10, '#0038A8') + rect(0, 10, 30, 10, '#CE1126') + '<polygon points="0,0 17.3,10 0,20" fill="#FFFFFF"/>' + disc(5.8, 10, 2, '#FCD116'),
  MY: stripes(14, '#CC0001', W) + rect(0, 0, 15, 11.4, '#010066') + disc(5.8, 5.7, 3.6, '#FFCC00') + disc(6.9, 5.7, 3, '#010066') + star(11, 5.7, 2.2, '#FFCC00'),
  ZA: rect(0, 0, 30, 10, '#E03C31') + rect(0, 10, 30, 10, '#001489')
    + '<path d="M0 0L15 10L0 20M15 10H30" stroke="#FFFFFF" stroke-width="6.5" fill="none"/>'
    + '<path d="M0 0L15 10L0 20M15 10H30" stroke="#007749" stroke-width="3.8" fill="none"/>'
    + '<polygon points="0,2.2 11.7,10 0,17.8" fill="#FFB612"/><polygon points="0,4 9,10 0,16" fill="#000000"/>',
};

export function flag(code, size = 'lg') {
  const span = document.createElement('span');
  span.className = `flag ${size === 'sm' ? 'sm' : ''}`.trim();
  const name = cuisineName(code);
  if (size !== 'sm') {
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', code ? `Flag of ${name}` : 'No cuisine');
  } else {
    span.setAttribute('aria-hidden', 'true');
  }
  const body = FLAGS[code];
  if (body) {
    span.innerHTML = `<svg viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
  } else {
    span.classList.add('plain');
    span.textContent = code ?? '';
  }
  return span;
}

export const hasFlag = (code) => code in FLAGS;
