'use client';

import { useState } from 'react';
import { Button, Dialog, FormField, Input, Select, Textarea } from '@sovereignfs/ui';
import { createCard } from '../_lib/actions';
import styles from './CardForm.module.css';

export function NewCardDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        + Add card
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="md" title="Add card">
        <form action={createCard} className={styles.form}>
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
          <div className={styles.actions}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add card</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
