'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Button, Card, ConfirmDialog, PageHeader } from '@sovereignfs/ui';
import type { DocumentDetail } from '../_lib/documentActions';
import { deleteDocument } from '../_lib/documentActions';
import { unwrapDekWithCmk } from '@sovereignfs/sdk/e2ee-crypto';
import { decryptBlob, decryptJson } from '@sovereignfs/sdk/e2ee-object';
import { useE2eeUnlock } from '../_lib/useE2eeUnlock';
import formStyles from './CardForm.module.css';
import styles from './DocumentDetailView.module.css';

interface DecryptedMetadata {
  title: string;
  notes: string;
  originalFilename: string;
  originalContentType: string;
}

/**
 * Documents are always encrypted (SPEC: required, not opt-in) — nothing here
 * ever renders until this device's CMK is unlocked. Decryption happens
 * entirely client-side: the ciphertext is fetched from its signed URL,
 * decrypted in the browser, and rendered via a Blob URL that's revoked on
 * unmount — the runtime and server never see plaintext bytes.
 */
export function DocumentDetailView({ document: doc }: { document: DocumentDetail }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const unlock = useE2eeUnlock();
  const [metadata, setMetadata] = useState<DecryptedMetadata | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState(false);

  useEffect(() => {
    if (unlock.state !== 'unlocked' || !unlock.cmk) return;
    const cmk = unlock.cmk;
    let cancelled = false;
    let createdUrl: string | null = null;
    void (async () => {
      try {
        const dek = await unwrapDekWithCmk(doc.wrappedDek, cmk);
        const meta = await decryptJson<DecryptedMetadata>(dek, doc.encryptedMetadata);
        const res = await fetch(doc.downloadUrl);
        const ciphertext = await res.blob();
        const plaintext = await decryptBlob(dek, {
          ciphertext,
          iv: doc.blobIv,
          algorithmVersion: doc.blobAlgorithmVersion,
          contentType: meta.originalContentType,
        });
        if (cancelled) return;
        createdUrl = URL.createObjectURL(plaintext);
        setObjectUrl(createdUrl);
        setMetadata(meta);
      } catch {
        if (!cancelled) setDecryptError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [doc, unlock.state, unlock.cmk]);

  function handleDelete() {
    startDelete(async () => {
      await deleteDocument(doc.id);
    });
  }

  if (unlock.state === 'checking') return null;

  if (unlock.state !== 'unlocked') {
    return (
      <>
        <PageHeader title="🔒 Encrypted document" />
        <Card className={styles.card}>
          <p className={formStyles.help}>
            This document is encrypted.{' '}
            <Link href="/account/security" className={styles.inlineLink}>
              Unlock client-side encryption in Account → Security
            </Link>{' '}
            to view it.
          </p>
        </Card>
      </>
    );
  }

  if (decryptError) {
    return (
      <>
        <PageHeader title="🔒 Encrypted document" />
        <Card className={styles.card}>
          <p className={formStyles.error}>
            Could not decrypt this document on this device. Try unlocking with the recovery
            secret or another enrolled device.
          </p>
        </Card>
      </>
    );
  }

  if (!metadata || !objectUrl) return null; // briefly decrypting

  const isImage = metadata.originalContentType.startsWith('image/');

  return (
    <>
      <PageHeader title={metadata.title} />
      <Card className={styles.card}>
        {isImage ? (
          <img src={objectUrl} alt={metadata.title} className={styles.preview} />
        ) : (
          <a href={objectUrl} download={metadata.originalFilename}>
            Download {metadata.originalFilename}
          </a>
        )}
        <dl className={styles.fields}>
          <div className={styles.field}>
            <dt>Notes</dt>
            <dd>{metadata.notes || '—'}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Button type="button" variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
            Delete
          </Button>
        </div>
      </Card>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete this document?"
        message={`"${metadata.title}" will be permanently removed.`}
        confirmLabel={deletePending ? 'Deleting…' : 'Delete'}
        destructive
        pending={deletePending}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
