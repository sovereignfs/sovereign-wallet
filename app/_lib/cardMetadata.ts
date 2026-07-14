/**
 * Plaintext shape stored (as JSON) in `wallet_items.encrypted_metadata` for
 * an unencrypted card. Loyalty cards are "encryption recommended", not
 * required (SPEC's cards & documents data-class table, open question 10 —
 * resolved: opt-in per card, not encrypted by default) — unlike sensitive
 * documents, which mandate client-side encryption (W-12+). When a card is
 * encrypted (`wallet_items.encryption_version` non-null), this same column
 * instead holds an `EncryptedJson` shape (`{ ciphertext, iv, algorithmVersion
 * }` from `@sovereignfs/sdk/e2ee-object`) and this type is never stored
 * server-side — see `useE2eeUnlock`/`CardDetailView` for the client-side
 * encrypt/decrypt path.
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
