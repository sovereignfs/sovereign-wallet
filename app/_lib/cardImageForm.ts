import { encryptBlob } from '@sovereignfs/sdk/e2ee-object';
import { compressImageIfNeeded } from './imageCompression';

/**
 * Total client-side compression budget shared across whichever card images
 * are present in one submission (front and/or back), so two photos in the
 * same submission don't together exceed the Server Action body limit even
 * though each individually would fit.
 */
const CARD_IMAGE_BUDGET_BYTES = 900 * 1024;

function presentCardImageSides(formData: FormData): Array<'front' | 'back'> {
  return (['front', 'back'] as const).filter((side) => {
    const file = formData.get(`${side}Image`);
    return file instanceof File && file.size > 0;
  });
}

/** Per-image compression budget for this submission — split evenly across whichever sides are present. */
export function cardImageBudget(formData: FormData): number {
  const count = presentCardImageSides(formData).length;
  return count > 0 ? Math.floor(CARD_IMAGE_BUDGET_BYTES / count) : CARD_IMAGE_BUDGET_BYTES;
}

/**
 * Encrypts an optional `${side}Image` file (if present) and appends it to
 * `target`, compressing first if it's an oversized image. `maxBytes` should
 * come from `cardImageBudget` computed once per submission so front/back
 * share the same budget.
 */
export async function appendCardImage(
  source: FormData,
  target: FormData,
  side: 'front' | 'back',
  dek: CryptoKey | null,
  maxBytes: number,
) {
  const file = source.get(`${side}Image`);
  if (!(file instanceof File) || file.size === 0) return;
  const compressed = await compressImageIfNeeded(file, maxBytes);
  if (!dek) {
    target.set(`${side}Image`, compressed, compressed.name);
    return;
  }
  const encrypted = await encryptBlob(dek, compressed);
  target.set(`${side}Image`, encrypted.ciphertext, `${side}.bin`);
  target.set(`${side}ImageIv`, encrypted.iv);
  target.set(`${side}ImageAlgorithmVersion`, encrypted.algorithmVersion);
  target.set(`${side}ImageContentType`, compressed.type);
}

/**
 * Compresses any oversized front/back image already in `formData`, in
 * place — for the unencrypted card path, which submits `formData` directly
 * to `createCard`/`updateCard` rather than building a separate FormData.
 */
export async function compressCardImagesInForm(formData: FormData): Promise<void> {
  const budget = cardImageBudget(formData);
  for (const side of presentCardImageSides(formData)) {
    const file = formData.get(`${side}Image`) as File;
    const compressed = await compressImageIfNeeded(file, budget);
    if (compressed !== file) formData.set(`${side}Image`, compressed, compressed.name);
  }
}
