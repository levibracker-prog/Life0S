// Bereitet ein hochgeladenes Foto als Hintergrund auf: wird auf höchstens
// IMAGE_MAX_SIDE Pixel verkleinert und als JPEG gespeichert. Kaputte,
// unlesbare oder zu große Dateien werden mit einer lesbaren Meldung abgelehnt.

import {
  IMAGE_FALLBACK_SIDES, IMAGE_MAX_BYTES, IMAGE_MAX_FILE_BYTES, IMAGE_MAX_PIXELS, IMAGE_QUALITIES,
} from '../config.js';

export class ImageError extends Error {}

// Skaliert Breite und Höhe so, dass die längere Seite höchstens `max` misst.
// Bilder, die schon klein genug sind, bleiben unverändert.
export function fitSize(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function toBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new ImageError('Das Bild konnte nicht gelesen werden.'));
    reader.readAsDataURL(blob);
  });
}

async function decode(file) {
  try {
    // "from-image" richtet Handyfotos nach den EXIF-Daten aus.
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError('Das Bild lässt sich nicht öffnen. Die Datei ist beschädigt oder das Format wird nicht unterstützt (JPEG, PNG, WebP gehen).');
  }
}

export async function prepareBackgroundPhoto(file, limits = {}) {
  const maxFileBytes = limits.maxFileBytes ?? IMAGE_MAX_FILE_BYTES;
  const maxBytes = limits.maxBytes ?? IMAGE_MAX_BYTES;
  const sides = limits.sides ?? IMAGE_FALLBACK_SIDES;
  const qualities = limits.qualities ?? IMAGE_QUALITIES;

  if (file.type && !file.type.startsWith('image/')) throw new ImageError('Das ist keine Bilddatei.');
  if (file.size === 0) throw new ImageError('Die Datei ist leer.');
  if (file.size > maxFileBytes) {
    throw new ImageError(`Die Datei ist zu groß (über ${Math.round(maxFileBytes / 1024 / 1024)} MB). Nimm ein kleineres Bild.`);
  }

  const bitmap = await decode(file);
  try {
    if (bitmap.width * bitmap.height > IMAGE_MAX_PIXELS) {
      throw new ImageError('Das Bild hat zu viele Pixel. Nimm ein kleineres Bild.');
    }
    // Erst die größte erlaubte Seite, bei zu großer Datei schrittweise kleiner.
    for (const side of sides) {
      const { width, height } = fitSize(bitmap.width, bitmap.height, side);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new ImageError('Das Bild konnte nicht verarbeitet werden.');
      // Weißer Grund, damit transparente PNGs im JPEG nicht schwarz werden.
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, width, height);
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await toBlob(canvas, quality);
        if (!blob) throw new ImageError('Das Bild konnte nicht umgewandelt werden.');
        if (blob.size <= maxBytes) {
          return { dataUrl: await readAsDataUrl(blob), width, height, bytes: blob.size };
        }
      }
    }
  } finally {
    bitmap.close?.();
  }
  throw new ImageError('Das Bild bleibt auch verkleinert zu groß, weil es sehr detailreich ist. Nimm ein anderes.');
}
