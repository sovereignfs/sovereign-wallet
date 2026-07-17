'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@sovereignfs/ui';
import { unwrapDekWithCmk } from '@sovereignfs/sdk/e2ee-crypto';
import { decryptJson } from '@sovereignfs/sdk/e2ee-object';
import type { DocumentListItem } from '../_lib/documentActions';
import { useE2eeUnlock } from '../_lib/useE2eeUnlock';
import styles from '../documents/page.module.css';

interface DecryptedDocumentMeta {
  title: string;
}

/**
 * Decrypts and shows just the title for one document tile — never
 * notes/filename/content-type, which stay hidden until the detail page.
 * Falls back to the generic locked label if decryption fails.
 */
function EncryptedDocumentTile({ document: doc, cmk }: { document: DocumentListItem; cmk: CryptoKey }) {
  const [title, setTitle] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const cipher = doc.cipher;
    let cancelled = false;
    void (async () => {
      try {
        const dek = await unwrapDekWithCmk(cipher.wrappedDek, cmk);
        const meta = await decryptJson<DecryptedDocumentMeta>(dek, cipher.encryptedMetadata);
        if (!cancelled) setTitle(meta.title);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, cmk]);

  if (failed || !title) {
    return <h2 className={styles.documentTitle}>🔒 Encrypted document</h2>;
  }

  return <h2 className={styles.documentTitle}>🔒 {title}</h2>;
}

/** Document list grid. Calls `useE2eeUnlock()` once and shares the result across every tile. */
export function DocumentsListView({ documents }: { documents: DocumentListItem[] }) {
  const unlock = useE2eeUnlock();

  return (
    <section className={styles.documentGrid} aria-label="Documents">
      {documents.map((doc) => (
        <Link key={doc.id} href={`/wallet/documents/${doc.id}`} className={styles.documentLink}>
          <Card interactive className={styles.documentTile}>
            {unlock.state === 'unlocked' && unlock.cmk ? (
              <EncryptedDocumentTile document={doc} cmk={unlock.cmk} />
            ) : (
              <h2 className={styles.documentTitle}>🔒 Encrypted document</h2>
            )}
          </Card>
        </Link>
      ))}
    </section>
  );
}
