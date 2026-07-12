'use client';

import { useEffect, useRef, useState } from 'react';
import { JSBARCODE_FORMATS } from '../_lib/qr';
import styles from './CodeDisplay.module.css';

export interface CodeDisplayProps {
  format: string | null;
  payload: string;
}

/**
 * Renders a QR code or 1D barcode entirely client-side — the payload never
 * leaves the browser (SPEC: "No payload sent to an external service").
 * `qrcode` draws to canvas; `jsbarcode` draws to an inline SVG. Both load
 * lazily so the (client-only, DOM-drawing) libraries never end up in a
 * server bundle.
 */
export function CodeDisplay({ format, payload }: CodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [error, setError] = useState<string | null>(null);

  const jsbarcodeFormat = format ? JSBARCODE_FORMATS[format as keyof typeof JSBARCODE_FORMATS] : undefined;

  useEffect(() => {
    setError(null);

    if (format === 'qr') {
      if (!canvasRef.current) return;
      import('qrcode')
        .then(({ default: QRCode }) => QRCode.toCanvas(canvasRef.current, payload, { width: 200 }))
        .catch(() => setError('Could not render this payload as a QR code.'));
      return;
    }

    if (jsbarcodeFormat) {
      if (!svgRef.current) return;
      import('jsbarcode')
        .then(({ default: JsBarcode }) => {
          JsBarcode(svgRef.current, payload, { format: jsbarcodeFormat, displayValue: false });
        })
        .catch(() => setError(`Could not render this payload as ${jsbarcodeFormat}.`));
    }
  }, [format, jsbarcodeFormat, payload]);

  if (format !== 'qr' && !jsbarcodeFormat) {
    return <p className={styles.unsupported}>No preview available for this format.</p>;
  }

  return (
    <div className={styles.root}>
      {format === 'qr' ? <canvas ref={canvasRef} /> : <svg ref={svgRef} />}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
