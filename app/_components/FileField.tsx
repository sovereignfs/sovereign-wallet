'use client';

import { useState } from 'react';
import type { FormFieldRenderProps } from '@sovereignfs/ui';
import styles from './FileField.module.css';

function ImageIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

/**
 * Dropzone-style file picker matching the platform's established upload
 * pattern (Console's asset-upload settings, Account's import dropzone): a
 * `<label>` wrapping a visually hidden file input, so clicking anywhere in
 * the box opens the native picker natively — no ref/onClick needed.
 *
 * `field.required` is deliberately dropped onto the input: `display:none`
 * doesn't bar an element from HTML5 constraint validation (unlike
 * `disabled`), so a required hidden file input silently blocks form
 * submission with no visible bubble to explain why. Callers that need the
 * file to be required already validate it themselves before submitting
 * (see NewDocumentDialog).
 */
export function FileField({
  field,
  name,
  accept,
  hint,
}: {
  field: FormFieldRenderProps;
  name: string;
  accept?: string;
  hint: string;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <label htmlFor={field.id} className={styles.dropZone}>
      <input
        id={field.id}
        aria-describedby={field['aria-describedby']}
        aria-invalid={field['aria-invalid']}
        type="file"
        name={name}
        accept={accept}
        className={styles.hiddenInput}
        onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? null)}
      />
      <span className={styles.icon}>
        <ImageIcon />
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{fileName ?? 'Choose a file'}</span>
        <span className={styles.hint}>
          {fileName ? 'Click to choose a different file.' : hint}
        </span>
      </span>
    </label>
  );
}
