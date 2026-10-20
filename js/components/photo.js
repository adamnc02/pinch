// A photo straight off a phone is ~5 MB. Resize on the device before upload:
// longest side 1600 px, JPEG at 0.82, which lands around 200–400 KB.
export async function resizePhoto(file, max = 1600, quality = 0.82) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  const src = bitmap ?? (await loadImage(file));
  const w = src.width;
  const hh = src.height;
  const scale = Math.min(1, max / Math.max(w, hh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(hh * scale);
  canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
  bitmap?.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t read that photo.'))), 'image/jpeg', quality));
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Couldn’t read that photo.'));
    img.src = URL.createObjectURL(file);
  });
}
