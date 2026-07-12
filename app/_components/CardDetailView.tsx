'use client';

import { useState, useTransition } from 'react';
import { Button, Card, ConfirmDialog, FormField, Input, Select, Textarea } from '@sovereignfs/ui';
import type { CardDetail } from '../_lib/actions';
import { deleteCard, updateCard } from '../_lib/actions';
import styles from './CardDetailView.module.css';
import formStyles from './CardForm.module.css';

export function CardDetailView({ card }: { card: CardDetail }) {
  const [editing, setEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();

  function handleDelete() {
    startDelete(async () => {
      await deleteCard(card.id);
    });
  }

  if (editing) {
    return (
      <Card>
        <form
          action={updateCard.bind(null, card.id)}
          className={formStyles.form}
          onSubmit={() => setEditing(false)}
        >
          <FormField label="Display name" required>
            {(field) => (
              <Input {...field} name="title" required defaultValue={card.title} />
            )}
          </FormField>
          <FormField label="Issuer">
            {(field) => <Input {...field} name="issuer" defaultValue={card.issuer} />}
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
              <Textarea {...field} name="payload" required rows={2} defaultValue={card.payload} />
            )}
          </FormField>
          <FormField label="Notes">
            {(field) => <Textarea {...field} name="notes" rows={3} defaultValue={card.notes} />}
          </FormField>
          <div className={formStyles.actions}>
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <>
      <Card className={styles.card}>
        <dl className={styles.fields}>
          <div className={styles.field}>
            <dt>Issuer</dt>
            <dd>{card.issuer || '—'}</dd>
          </div>
          <div className={styles.field}>
            <dt>Barcode format</dt>
            <dd>{card.barcodeFormat ?? '—'}</dd>
          </div>
          <div className={styles.field}>
            <dt>Payload</dt>
            <dd className={styles.payload}>{card.payload}</dd>
          </div>
          <div className={styles.field}>
            <dt>Notes</dt>
            <dd>{card.notes || '—'}</dd>
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
        message={`"${card.title || 'Untitled card'}" will be permanently removed.`}
        confirmLabel={deletePending ? 'Deleting…' : 'Delete'}
        destructive
        pending={deletePending}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  );
}
