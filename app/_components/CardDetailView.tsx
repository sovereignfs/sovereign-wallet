'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  ConfirmDialog,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@sovereignfs/ui';
import type { CardDetail } from '../_lib/actions';
import { deleteCard, updateCard } from '../_lib/actions';
import { unwrapDekWithCmk } from '@sovereignfs/sdk/e2ee-crypto';
import { decryptJson, encryptBlob, encryptJson } from '@sovereignfs/sdk/e2ee-object';
import { barcodeFormatLabel } from '../_lib/barcodeFormats';
import { useE2eeUnlock } from '../_lib/useE2eeUnlock';
import { useDecryptedImage } from '../_lib/useDecryptedImage';
import { CodeDisplay } from './CodeDisplay';
import { FileField } from './FileField';
import styles from './CardDetailView.module.css';
import formStyles from './CardForm.module.css';

/** Encrypts an optional `${side}Image` file (if present) and appends it to `target`. */
async function appendCardImage(
  source: FormData,
  target: FormData,
  side: 'front' | 'back',
  dek: CryptoKey | null,
) {
  const file = source.get(`${side}Image`);
  if (!(file instanceof File) || file.size === 0) return;
  if (!dek) {
    target.set(`${side}Image`, file);
    return;
  }
  const encrypted = await encryptBlob(dek, file);
  target.set(`${side}Image`, encrypted.ciphertext, `${side}.bin`);
  target.set(`${side}ImageIv`, encrypted.iv);
  target.set(`${side}ImageAlgorithmVersion`, encrypted.algorithmVersion);
  target.set(`${side}ImageContentType`, file.type);
}

interface DecryptedCard {
  title: string;
  issuer: string;
  notes: string;
  payload: string;
}

/**
 * Renders a card's detail view. For an encrypted card, nothing is decrypted
 * until this device's CMK is unlocked (`useE2eeUnlock`) — the server never
 * sees plaintext, and this component shows a locked-state placeholder
 * instead of the card content when it isn't unlocked (RFC 0060).
 */
export function CardDetailView({ card }: { card: CardDetail }) {
  const [editing, setEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savePending, startSave] = useTransition();

  const unlock = useE2eeUnlock();
  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptedCard | null>(null);
  const [decryptError, setDecryptError] = useState(false);
  const frontImageUrl = useDecryptedImage(card.frontImage, card.encrypted ? dek : null);
  const backImageUrl = useDecryptedImage(card.backImage, card.encrypted ? dek : null);

  useEffect(() => {
    if (!card.encrypted || !card.cipher) return;
    if (unlock.state !== 'unlocked' || !unlock.cmk) return;
    const cipher = card.cipher;
    const cmk = unlock.cmk;
    let cancelled = false;
    void (async () => {
      try {
        const unwrappedDek = await unwrapDekWithCmk(cipher.wrappedDek, cmk);
        const metadata = await decryptJson<{ title: string; issuer: string; notes: string }>(
          unwrappedDek,
          cipher.encryptedMetadata,
        );
        const payload = await decryptJson<string>(unwrappedDek, cipher.encryptedPayload);
        if (cancelled) return;
        setDek(unwrappedDek);
        setDecrypted({ ...metadata, payload });
      } catch {
        if (!cancelled) setDecryptError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card, unlock.state, unlock.cmk]);

  function handleDelete() {
    startDelete(async () => {
      await deleteCard(card.id);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    const formData = new FormData(e.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const payload = String(formData.get('payload') ?? '').trim();
    if (!title) return setSaveError('Display name is required.');
    if (!payload) return setSaveError('Card payload is required.');

    startSave(async () => {
      if (card.encrypted && card.cipher) {
        if (!dek) {
          setSaveError('Encryption key is not available. Please reload and try again.');
          return;
        }
        try {
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
          encryptedForm.set('wrappedDek', JSON.stringify(card.cipher.wrappedDek));
          await appendCardImage(formData, encryptedForm, 'front', dek);
          await appendCardImage(formData, encryptedForm, 'back', dek);
          await updateCard(card.id, encryptedForm);
          setEditing(false);
        } catch {
          setSaveError('Something went wrong encrypting this card. Please try again.');
        }
        return;
      }
      await updateCard(card.id, formData);
      setEditing(false);
    });
  }

  if (card.encrypted) {
    if (unlock.state === 'checking') return null;
    if (unlock.state !== 'unlocked') {
      return (
        <>
          <PageHeader title="🔒 Encrypted card" />
          <Card className={styles.card}>
            <p className={formStyles.help}>
              This card is encrypted.{' '}
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
          <PageHeader title="🔒 Encrypted card" />
          <Card className={styles.card}>
            <p className={formStyles.error}>
              Could not decrypt this card on this device. Try unlocking with the recovery secret
              or another enrolled device.
            </p>
          </Card>
        </>
      );
    }
    if (!decrypted) return null; // briefly decrypting
  }

  const display = card.encrypted && decrypted ? decrypted : card;

  if (editing) {
    return (
      <>
        <PageHeader title={display.title || 'Untitled card'} />
        <Card>
          <form onSubmit={handleSubmit} className={formStyles.form}>
          <FormField label="Display name" required>
            {(field) => <Input {...field} name="title" required defaultValue={display.title} />}
          </FormField>
          <FormField label="Issuer">
            {(field) => <Input {...field} name="issuer" defaultValue={display.issuer} />}
          </FormField>
          <FormField label="Barcode format">
            {(field) => (
              <Select {...field} name="barcodeFormat" defaultValue={card.barcodeFormat ?? 'qr'}>
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
            {(field) => (
              <Textarea
                {...field}
                name="payload"
                required
                rows={2}
                defaultValue={display.payload}
              />
            )}
          </FormField>
          <FormField label="Notes">
            {(field) => <Textarea {...field} name="notes" rows={3} defaultValue={display.notes} />}
          </FormField>
          <FormField
            label="Front image"
            hint={card.frontImage ? 'Replace the current image.' : 'Optional.'}
          >
            {(field) => (
              <FileField field={field} name="frontImage" accept="image/*" hint="Image file" />
            )}
          </FormField>
          <FormField
            label="Back image"
            hint={card.backImage ? 'Replace the current image.' : 'Optional.'}
          >
            {(field) => (
              <FileField field={field} name="backImage" accept="image/*" hint="Image file" />
            )}
          </FormField>
          {saveError && <p className={formStyles.error}>{saveError}</p>}
          <div className={formStyles.actions}>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={savePending}>
              {savePending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={display.title || 'Untitled card'} />
      <Card className={styles.card}>
        {card.encrypted && <p className={styles.encryptedBadge}>🔒 Encrypted</p>}
        <CodeDisplay format={card.barcodeFormat} payload={display.payload} />
        {(frontImageUrl || backImageUrl) && (
          <div className={styles.images}>
            {frontImageUrl && <img src={frontImageUrl} alt="Card front" className={styles.image} />}
            {backImageUrl && <img src={backImageUrl} alt="Card back" className={styles.image} />}
          </div>
        )}
        <dl className={styles.fields}>
          <div className={styles.field}>
            <dt>Issuer</dt>
            <dd>{display.issuer || '—'}</dd>
          </div>
          <div className={styles.field}>
            <dt>Barcode format</dt>
            <dd>{barcodeFormatLabel(card.barcodeFormat)}</dd>
          </div>
          <div className={styles.field}>
            <dt>Payload</dt>
            <dd className={styles.payload}>{display.payload}</dd>
          </div>
          <div className={styles.field}>
            <dt>Notes</dt>
            <dd>{display.notes || '—'}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button type="button" variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
            Delete
          </Button>
        </div>
      </Card>
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete this card?"
        message={`"${display.title || 'Untitled card'}" will be permanently removed.`}
        confirmLabel={deletePending ? 'Deleting…' : 'Delete'}
        destructive
        pending={deletePending}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
