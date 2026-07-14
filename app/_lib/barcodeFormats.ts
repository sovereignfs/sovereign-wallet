/** Human-readable labels for the barcode format enum stored on a card — keep in sync with the `<option>` lists in NewCardDialog and CardDetailView's edit form. */
export const BARCODE_FORMAT_LABELS: Record<string, string> = {
  qr: 'QR code',
  code128: 'Code 128',
  code39: 'Code 39',
  ean13: 'EAN-13',
  upc: 'UPC',
  other: 'Other',
};

export function barcodeFormatLabel(format: string | null): string {
  if (!format) return '—';
  return BARCODE_FORMAT_LABELS[format] ?? format;
}
