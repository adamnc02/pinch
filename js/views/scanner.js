// Scan barcode (screen 11) and the scan result (screen 12).
//
// · The camera needs HTTPS: it works on the live URL, not on LAN http.
// · BarcodeDetector where the browser has it; otherwise ZXing, loaded from a
//   pinned CDN script the first time it's needed (the pattern BLOC uses).
// · Lookup order: the household's own products (no network call, labelled
//   "In your products"), then Open Food Facts, whose crowd-sourced data is
//   always shown for confirmation before it's saved.
// · Camera refused or missing: only "Type the number" and "Enter from the
//   label", with one line saying why.

import { h, clear } from '../components/dom.js';
import { icon } from '../components/icons.js';
import { openSheet } from '../components/sheet.js';
import { toast } from '../components/toast.js';
import * as state from '../state.js';
import { fetchOff } from '../storage.js';
import { mapOffProduct, offUrl } from '../lib/off.js';
import { trimNumber } from '../lib/format.js';
import { openProductForm } from './product.js';

const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf'];

let zxingLoad = null;
function loadZxing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  zxingLoad ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = ZXING_URL;
    s.onload = () => resolve(window.ZXing);
    s.onerror = () => { zxingLoad = null; reject(new Error('The barcode reader couldn’t load.')); };
    document.head.append(s);
  });
  return zxingLoad;
}

async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats?.();
      const formats = supported ? FORMATS.filter((f) => supported.includes(f)) : FORMATS;
      if (formats.length) {
        const d = new window.BarcodeDetector({ formats });
        return async (video) => (await d.detect(video))[0]?.rawValue ?? null;
      }
    } catch { /* fall through to ZXing */ }
  }
  const Z = await loadZxing();
  const hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.ITF]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader();
  reader.setHints(hints);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    try {
      return reader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)))).getText();
    } catch {
      return null;
    }
  };
}

// openScanner({ forName, onProduct(product) }) — onProduct gets a SAVED
// household product.
export function openScanner({ forName = null, onProduct }) {
  let stream = null;
  let running = false;
  let paused = false;
  let torch = false;
  const failed = new Set();   // codes already looked up and not usable: never re-looked-up in this scan
  const resume = () => { paused = false; };
  const video = h('video', { class: 'camera-video', playsinline: true, muted: true, autoplay: true });
  video.muted = true;
  video.setAttribute('playsinline', '');
  const say = h('div', { class: 'say' }, 'Line up the barcode', h('span', {}, 'It scans on its own'));
  const torchBtn = h('button', { class: 'round', type: 'button', 'aria-label': 'Torch', 'aria-pressed': 'false', hidden: true, onclick: toggleTorch }, icon('flash'));
  const finder = h('div', { class: 'viewfinder', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('div', { class: 'line' }));
  const body = h('div', { class: 'camera' },
    video,
    h('div', { class: 'top' },
      h('button', { class: 'round', type: 'button', 'aria-label': 'Close scanner', onclick: () => sheet.close() }, icon('x')),
      forName ? h('span', { class: 'ctx' }, 'Scanning for ', h('em', {}, forName)) : h('span'),
      torchBtn),
    finder, say,
    h('div', { class: 'bottom' },
      h('button', { class: 'btn', type: 'button', onclick: typeNumber }, icon('keyboard'), 'Type the number'),
      h('button', { class: 'btn', type: 'button', onclick: fromLabel }, 'Enter from the label')));

  const sheet = openSheet(body, { kind: 'camera', label: 'Scan barcode', onClose: stop });

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) return blocked('This browser can’t use the camera here. The camera needs the installed app or an https address.');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (e) {
      return blocked(e?.name === 'NotAllowedError' ? 'Camera access is off for Pinch. Allow it in Settings, or type the number.' : 'No camera is available. Type the number or enter it from the label.');
    }
    if (sheet.closed) { stop(); return; }
    video.srcObject = stream;
    await video.play().catch(() => {});
    const track = stream.getVideoTracks()[0];
    torchBtn.hidden = !track?.getCapabilities?.().torch;
    let detect;
    try { detect = await makeDetector(); } catch (e) { return blocked(e.message); }
    running = true;
    const loop = async () => {
      if (!running) return;
      if (!paused && video.readyState >= 2 && video.videoWidth) {
        const code = await detect(video).catch(() => null);
        if (code && /^\d{6,14}$/.test(code) && !failed.has(code)) { paused = true; found(code); }
      }
      if (running) setTimeout(loop, 120);
    };
    loop();
  }

  function blocked(message) {
    body.classList.add('blocked');
    clear(say, message);
  }

  function stop() {
    running = false;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    torch = !torch;
    try { await track.applyConstraints({ advanced: [{ torch }] }); torchBtn.setAttribute('aria-pressed', String(torch)); } catch { torch = !torch; }
  }

  function typeNumber() {
    paused = true;
    const input = h('input', { class: 'input', inputmode: 'numeric', autocomplete: 'off', placeholder: 'e.g. 5000157024671', autofocus: true, 'aria-label': 'Barcode number' });
    const err = h('p', { class: 'field-error', role: 'alert' });
    const go = () => {
      const code = input.value.replace(/\s/g, '');
      if (!/^\d{6,14}$/.test(code)) { err.textContent = 'A barcode is 6 to 14 digits.'; return; }
      s.close();
      found(code);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    const s = openSheet(h('div', { class: 'type-number' },
      h('h2', {}, 'Type the number'), input, err,
      h('button', { class: 'btn primary big', type: 'button', onclick: go }, 'Look it up')), { kind: 'bottom', label: 'Type the number', onClose: () => { paused = false; } });
  }

  function fromLabel() {
    paused = true;
    openProductForm({
      initial: { name: forName ?? '' },
      onSaved: (p) => { sheet.close({ force: true }); onProduct(p); },
      onClose: resume,
    });
  }

  async function found(code) {
    navigator.vibrate?.(30);
    const mine = state.productByBarcode(code);
    if (mine) return showResult({ product: mine, source: 'mine', missing: [] });
    clear(say, 'Looking it up…', h('span', {}, code));
    try {
      const res = mapOffProduct(await fetchOff(offUrl(code)), code);
      if (!res.ok) {
        clear(say, 'Not found on Open Food Facts', h('span', {}, 'Enter it from the label instead'));
        failed.add(code);
        openProductForm({ initial: { name: forName ?? '', barcode: code }, onSaved: (p) => { sheet.close({ force: true }); onProduct(p); }, onClose: resume });
        return;
      }
      showResult({ product: res.product, source: 'off', missing: res.missing, sizeLabel: res.sizeLabel });
    } catch {
      clear(say, 'Couldn’t reach Open Food Facts', h('span', {}, 'Check the connection, or enter it from the label'));
      failed.add(code);
      paused = false;
    }
  }

  function showResult({ product, source, missing, sizeLabel }) {
    const per = { '100g': 'Per 100 g', '100ml': 'Per 100 ml', item: 'Per item' }[product.basis];
    const val = (v, u) => (v == null ? '—' : `${trimNumber(v, 1)} ${u}`);
    const usable = !missing.length;
    const r = openSheet(h('div', { class: 'scan-result' },
      h('span', { class: 'src' }, source === 'mine' ? 'In your products' : 'Open Food Facts'),
      h('div', { class: 'found' }, h('span', { class: 'pk' }, icon('package')),
        h('div', {}, h('h3', {}, product.name || 'Unnamed product'), h('p', {}, [product.brand, sizeLabel].filter(Boolean).join(' · ') || product.barcode))),
      h('div', { class: 'nut' },
        h('div', { class: 'hd' }, h('span', {}, per), h('span', {}, source === 'mine' ? 'Saved in your household' : 'Check against the label')),
        h('div', { class: 'r' }, 'Energy', h('b', {}, val(product.kcal, 'kcal'))),
        h('div', { class: 'r' }, 'Protein', h('b', {}, val(product.protein, 'g'))),
        h('div', { class: 'r' }, 'Carbs', h('b', {}, val(product.carbs, 'g'))),
        h('div', { class: 'r' }, 'Fat', h('b', {}, val(product.fat, 'g')))),
      usable ? null : h('p', { class: 'hint' }, `Open Food Facts has no ${missing.join(', ')} for this. Edit details to add ${missing.length > 1 ? 'them' : 'it'} from the label.`),
      h('div', { class: 'two' },
        h('button', { class: 'btn secondary big', type: 'button', onclick: edit }, 'Edit details'),
        h('button', { class: 'btn primary big', type: 'button', disabled: !usable, onclick: use }, 'Use product'))),
    { kind: 'bottom', label: 'Product found', className: 'sheet-result', onClose: () => { paused = false; clear(say, 'Line up the barcode', h('span', {}, 'It scans on its own')); } });

    function edit() {
      r.close({ force: true });
      paused = true;
      openProductForm({ initial: product, title: source === 'mine' ? 'Edit product' : 'New product', onSaved: (p) => { sheet.close({ force: true }); onProduct(p); }, onClose: resume });
    }
    async function use() {
      try {
        const saved = source === 'mine' ? product : await state.saveProduct(product);
        await r.close({ force: true });
        await sheet.close({ force: true });
        onProduct(saved);
      } catch (e) {
        toast(e.message, { error: true });
      }
    }
  }

  start();
  return sheet;
}
