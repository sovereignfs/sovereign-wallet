'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@sovereignfs/ui';
import { unwrapDekWithCmk } from '@sovereignfs/sdk/e2ee-crypto';
import { decryptJson } from '@sovereignfs/sdk/e2ee-object';
import type { CardListItem } from '../_lib/actions';
import { useE2eeUnlock } from '../_lib/useE2eeUnlock';
import styles from '../cards/page.module.css';

interface DecryptedCardMeta {
  title: string;
  issuer: string;
}

/**
 * Decrypts and shows just title/issuer for one encrypted card tile — never
 * notes/payload, which stay hidden until the detail page. Falls back to the
 * generic locked label if decryption fails (e.g. a stale CMK).
 */
function EncryptedCardTile({ card, cmk }: { card: CardListItem; cmk: CryptoKey }) {
  const [meta, setMeta] = useState<DecryptedCardMeta | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!card.cipher) return;
    const cipher = card.cipher;
    let cancelled = false;
    void (async () => {
      try {
        const dek = await unwrapDekWithCmk(cipher.wrappedDek, cmk);
        const decrypted = await decryptJson<DecryptedCardMeta>(dek, cipher.encryptedMetadata);
        if (!cancelled) setMeta(decrypted);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card, cmk]);

  if (failed || !meta) {
    return <h2 className={styles.cardTitle}>🔒 Encrypted card</h2>;
  }

  return (
    <>
      <h2 className={styles.cardTitle}>🔒 {meta.title || 'Untitled card'}</h2>
      {meta.issuer && <p className={styles.cardIssuer}>{meta.issuer}</p>}
    </>
  );
}

/** Card list grid. Calls `useE2eeUnlock()` once and shares the result across every encrypted tile. */
export function CardsListView({ cards }: { cards: CardListItem[] }) {
  const unlock = useE2eeUnlock();

  return (
    <section className={styles.cardGrid} aria-label="Cards">
      {cards.map((card) => (
        <Link key={card.id} href={`/wallet/cards/${card.id}`} className={styles.cardLink}>
          <Card interactive className={styles.cardTile}>
            {card.encrypted ? (
              unlock.state === 'unlocked' && unlock.cmk ? (
                <EncryptedCardTile card={card} cmk={unlock.cmk} />
              ) : (
                <h2 className={styles.cardTitle}>🔒 Encrypted card</h2>
              )
            ) : (
              <>
                <h2 className={styles.cardTitle}>{card.title || 'Untitled card'}</h2>
                {card.issuer && <p className={styles.cardIssuer}>{card.issuer}</p>}
              </>
            )}
          </Card>
        </Link>
      ))}
    </section>
  );
}
