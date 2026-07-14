'use client';

import { useEffect, useState } from 'react';
import { decryptBlob } from '@sovereignfs/sdk/e2ee-object';
import type { CardImage } from './actions';

/**
 * Resolves a `CardImage` (W-15) into a renderable URL. Unencrypted images are
 * already directly servable via their signed URL; encrypted ones are fetched
 * as ciphertext and decrypted client-side into an object URL, which is
 * revoked on unmount/change so the decrypted bytes don't linger in memory.
 */
export function useDecryptedImage(image: CardImage | null, dek: CryptoKey | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!image) {
      setUrl(null);
      return;
    }
    if (!image.iv) {
      setUrl(image.downloadUrl);
      return;
    }
    if (!dek) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    void (async () => {
      try {
        const res = await fetch(image.downloadUrl);
        const ciphertext = await res.blob();
        const plaintext = await decryptBlob(dek, {
          ciphertext,
          iv: image.iv as string,
          algorithmVersion: image.algorithmVersion as string,
          contentType: image.contentType ?? 'application/octet-stream',
        });
        if (cancelled) return;
        createdUrl = URL.createObjectURL(plaintext);
        setUrl(createdUrl);
      } catch {
        if (!cancelled) setUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [image, dek]);

  return url;
}
