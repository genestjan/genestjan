import { fitWithin } from './helpers';

/** Read an image file, shrink it to at most 1280px on the long side and return a JPEG data URL. */
export async function downscaleToDataUrl(file: File, max = 1280, quality = 0.8): Promise<string> {
  const bmp = await createImageBitmap(file);
  const { w, h } = fitWithin(bmp.width, bmp.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the photo');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}
