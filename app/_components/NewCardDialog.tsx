'use client';

import { useState, useTransition } from 'react';
import { Button, Dialog, FormField, Input, Select, Textarea } from '@sovereignfs/ui';
import { generateDek, wrapDekWithCmk } from '@sovereignfs/sdk/e2ee-crypto';
import { encryptJson } from '@sovereignfs/sdk/e2ee-object';
import { createCard } from '../_lib/actions';
import { appendCardImage, cardImageBudget, compressCardImagesInForm } from '../_lib/cardImageForm';
import { useE2eeUnlock } from '../_lib/useE2eeUnlock';
import { FileField } from './FileField';
import styles from './CardForm.module.css';

export function NewCardDialog() {
  const [open, setOpen] = useState(false);
  const [encrypt, setEncrypt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const unlock = useE2eeUnlock();
  const canEncrypt = unlock.state === 'unlocked';

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const payload = String(formData.get('payload') ?? '').trim();
    if (!title) return setError('Display name is required.');
    if (!payload) return setError('Card payload is required.');

    startTransition(async () => {
      if (encrypt && canEncrypt && unlock.cmk) {
        try {
          const dek = await generateDek();
          const wrappedDek = await wrapDekWithCmk(dek, unlock.cmk);
          const encryptedMetadata = await encryptJson(dek, {
            title,
            issuer: String(formData.get('issuer') ?? '').trim(),
            notes: String(formData.get('notes') ?? '').trim(),
          });
          const encryptedPayload = await encryptJson(dek, payload);

          const encryptedForm = new FormData();
          encryptedForm.set('barcodeFormat', String(formData.get('barcodeFormat') ?? ''));
          encryptedForm.set('encrypted', 'true');
          encryptedForm.set('encryptedMetadata', JSON.stringify(encryptedMetadata));
          encryptedForm.set('encryptedPayload', JSON.stringify(encryptedPayload));
          encryptedForm.set('wrappedDek', JSON.stringify(wrappedDek));
          const budget = cardImageBudget(formData);
          await appendCardImage(formData, encryptedForm, 'front', dek, budget);
          await appendCardImage(formData, encryptedForm, 'back', dek, budget);
          await createCard(encryptedForm);
        } catch {
          setError('Something went wrong encrypting this card. Please try again.');
        }
        return;
      }
      await compressCardImagesInForm(formData);
      await createCard(formData);
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        + Add card
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="md" title="Add card">
        <form onSubmit={handleSubmit} className={styles.form}>
          <FormField label="Display name" required>
            {(field) => <Input {...field} name="title" required placeholder="Coffee rewards" />}
          </FormField>
          <FormField label="Issuer">
            {(field) => <Input {...field} name="issuer" placeholder="Acme Coffee Co." />}
          </FormField>
          <FormField label="Barcode format">
            {(field) => (
              <Select {...field} name="barcodeFormat" defaultValue="qr">
                <option value="qr">QR code</option>
                <option value="code128">Code 128</option>
                <option value="code39">Code 39</option>
                <option value="ean13">EAN-13</option>
                <option value="upc">UPC</option>
                <option value="other">Other</option>
              </Select>
            )}
          </FormField>
          <FormField label="Card payload" required hint="The value encoded in the barcode/QR code.">
            {(field) => <Textarea {...field} name="payload" required rows={2} />}
          </FormField>
          <FormField label="Notes">
            {(field) => <Textarea {...field} name="notes" rows={3} />}
          </FormField>
          <FormField label="Front image" hint="Optional.">
            {(field) => (
              <FileField field={field} name="frontImage" accept="image/*" hint="Image file" />
            )}
          </FormField>
          <FormField label="Back image" hint="Optional.">
            {(field) => (
              <FileField field={field} name="backImage" accept="image/*" hint="Image file" />
            )}
          </FormField>
          <label className={styles.encryptOption}>
            <input
              type="checkbox"
              checked={encrypt}
              disabled={!canEncrypt}
              onChange={(e) => setEncrypt(e.currentTarget.checked)}
            />{' '}
            Encrypt this card
          </label>
          {!canEncrypt && (
            <p className={styles.help}>
              Set up client-side encryption in Account → Security to encrypt cards. Loyalty cards
              are private either way — encryption additionally protects them from the operator or
              runtime.
            </p>
          )}
          {canEncrypt && encrypt && (
            <p className={styles.help}>
              This card will only be readable on devices where you&rsquo;ve unlocked encryption. If
              you lose your recovery secret and every enrolled device, it can&rsquo;t be recovered.
            </p>
          )}
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Adding…' : 'Add card'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
