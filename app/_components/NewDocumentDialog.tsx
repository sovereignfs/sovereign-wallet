'use client';

import { useState, useTransition } from 'react';
import { Button, Dialog, FormField, Input, Textarea } from '@sovereignfs/ui';
import { generateDek, wrapDekWithCmk } from '@sovereignfs/sdk/e2ee-crypto';
import { encryptBlob, encryptJson } from '@sovereignfs/sdk/e2ee-object';
import { createDocument } from '../_lib/documentActions';
import { FileField } from './FileField';
import formStyles from './CardForm.module.css';

/**
 * Sensitive-document upload (SPEC: client-side encryption required, not
 * opt-in — unlike loyalty cards). Only ever rendered by `DocumentUploadGate`
 * once this device's CMK is unlocked, so `unlock.cmk` is always present here;
 * still checked defensively in case the unlock state changes mid-session.
 */
export function NewDocumentDialog({ cmk }: { cmk: CryptoKey }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const notes = String(formData.get('notes') ?? '').trim();
    const file = formData.get('file');
    if (!title) return setError('Title is required.');
    if (!(file instanceof File) || file.size === 0) return setError('Choose a file to upload.');

    startTransition(async () => {
      try {
        const dek = await generateDek();
        const wrappedDek = await wrapDekWithCmk(dek, cmk);
        const encryptedBlob = await encryptBlob(dek, file);
        const encryptedMetadata = await encryptJson(dek, {
          title,
          notes,
          originalFilename: file.name,
          originalContentType: file.type,
        });

        const uploadForm = new FormData();
        uploadForm.set('ciphertext', encryptedBlob.ciphertext, 'ciphertext.bin');
        uploadForm.set('blobIv', encryptedBlob.iv);
        uploadForm.set('blobAlgorithmVersion', encryptedBlob.algorithmVersion);
        uploadForm.set('encryptedMetadata', JSON.stringify(encryptedMetadata));
        uploadForm.set('wrappedDek', JSON.stringify(wrappedDek));
        await createDocument(uploadForm);
      } catch {
        setError('Something went wrong encrypting this document. Please try again.');
      }
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        + Add document
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="md" title="Add document">
        <form onSubmit={handleSubmit} className={formStyles.form}>
          <FormField label="Title" required>
            {(field) => <Input {...field} name="title" required placeholder="Passport" />}
          </FormField>
          <FormField label="File" required hint="Encrypted in your browser before upload.">
            {(field) => <FileField field={field} name="file" hint="Any file type" />}
          </FormField>
          <FormField label="Notes">
            {(field) => <Textarea {...field} name="notes" rows={3} />}
          </FormField>
          <p className={formStyles.help}>
            This document will only be readable on devices where you&rsquo;ve unlocked encryption.
            If you lose your recovery secret and every enrolled device, it can&rsquo;t be recovered
            — not by you, not by Sovereign, not by the operator.
          </p>
          {error && <p className={formStyles.error}>{error}</p>}
          <div className={formStyles.actions}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Encrypting & uploading…' : 'Add document'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
