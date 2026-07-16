/**
 * Client-side downscale/recompress for oversized images before client-side
 * encryption + upload. Server Actions cap the whole request body at a fixed
 * size (see the runtime's next.config.ts) — camera photos from iOS/Android
 * PWAs routinely exceed it on their own, let alone alongside a second image
 * in the same submission. Non-image files, and images already under
 * `maxBytes`, pass through unchanged.
 */

const MAX_DIMENSION_PX = 2000;
const DEFAULT_MAX_BYTES = 900 * 1024;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.1;

export async function compressImageIfNeeded(
  file: File,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= maxBytes) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // unsupported/corrupt image — let the upload attempt surface whatever error follows
  }

  const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob: Blob | null = null;
  for (let quality = 0.92; quality >= MIN_QUALITY; quality -= QUALITY_STEP) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= maxBytes) break;
  }
  if (!blob || blob.size >= file.size) return file; // compression didn't help — keep the original

  return new File([blob], replaceExtension(file.name, 'jpg'), { type: 'image/jpeg' });
}

function replaceExtension(name: string, ext: string): string {
  const dot = name.lastIndexOf('.');
  return `${dot === -1 ? name : name.slice(0, dot)}.${ext}`;
}
