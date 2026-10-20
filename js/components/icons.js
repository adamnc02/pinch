// icon('gear') → an <svg class="i"> using the sprite. Stroke and size come
// from svg.i in base.css; pass a size to override.
const NS = 'http://www.w3.org/2000/svg';
export function icon(name, { size, stroke } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'i');
  svg.setAttribute('aria-hidden', 'true');
  if (size) { svg.style.width = `${size}px`; svg.style.height = `${size}px`; }
  if (stroke) svg.style.strokeWidth = stroke;
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `icons/sprite.svg#i-${name}`);
  svg.append(use);
  return svg;
}
