/**
 * Plaintext-for-now shape stored (as JSON) in `wallet_items.encrypted_metadata`.
 *
 * Loyalty cards are "encryption recommended", not required (SPEC's cards &
 * documents data-class table) — unlike sensitive documents, which mandate
 * client-side encryption. Until W-11 wires up the encrypted/locked-state
 * path (open question 10: encrypted by default vs opt-in), this column holds
 * plain JSON and `encryption_version`/`wrapped_dek` stay null.
 */
export interface CardMetadata {
  title: string;
  issuer: string;
  notes: string;
}

export function serializeCardMetadata(metadata: CardMetadata): string {
  return JSON.stringify(metadata);
}

export function parseCardMetadata(raw: string | null): CardMetadata {
  if (!raw) return { title: '', issuer: '', notes: '' };
  try {
    const parsed = JSON.parse(raw) as Partial<CardMetadata>;
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      issuer: typeof parsed.issuer === 'string' ? parsed.issuer : '',
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    };
  } catch {
    return { title: '', issuer: '', notes: '' };
  }
}
