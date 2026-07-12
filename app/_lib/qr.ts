import type { BarcodeFormat } from './actions';

/** jsbarcode's format constant for each 1D `BarcodeFormat`. `qr` and `other`
 *  are rendered by different paths (see CodeDisplay) and have no entry here. */
export const JSBARCODE_FORMATS: Partial<Record<BarcodeFormat, string>> = {
  code128: 'CODE128',
  code39: 'CODE39',
  ean13: 'EAN13',
  upc: 'UPC',
};
