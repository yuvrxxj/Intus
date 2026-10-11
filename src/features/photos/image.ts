// Browser only: turns a chosen picture into the small, clean file that is uploaded.
import { fitWithin, LIMITS, type ImageType } from './model.ts';

export interface PreparedImage {
  blob: Blob;
  type: ImageType;
  width: number;
  height: number;
}

const UNREADABLE = 'That picture could not be read. Use a JPEG, PNG or WebP photo.';

/** Decodes the file with its camera rotation applied, so a portrait photo is not saved on its side. */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // fall through to the image element, which older browsers decode more widely
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(UNREADABLE);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: ImageType, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Redraws the picture onto a canvas at most 1280 px on its longest side and saves that. Only the pixels are copied, so
 * the camera's details (the location in GPS tags, the phone model, the time) are not in the result. WebP where the
 * browser can write it, JPEG otherwise; the quality steps down until the file is under the 2 MiB the bucket allows.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const decoded = await decode(file);
  try {
    const { width, height } = fitWithin(decoded.width, decoded.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot resize pictures');
    context.drawImage(decoded.source, 0, 0, width, height);

    let type: ImageType = 'image/webp';
    let quality: number = LIMITS.quality;
    let blob = await toBlob(canvas, type, quality);
    // a browser that cannot write WebP quietly hands back a PNG
    if (!blob || blob.type !== 'image/webp') {
      type = 'image/jpeg';
      blob = await toBlob(canvas, type, quality);
    }
    while (blob && blob.size > LIMITS.maxBytes && quality > 0.4) {
      quality -= 0.1;
      blob = await toBlob(canvas, type, quality);
    }
    if (!blob || blob.type !== type) throw new Error('This browser could not save the picture');
    if (blob.size > LIMITS.maxBytes) throw new Error('That picture is too detailed to shrink under 2 MB. Try another one');
    return { blob, type, width, height };
  } finally {
    decoded.release();
  }
}
