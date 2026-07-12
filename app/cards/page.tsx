import Link from 'next/link';
import { Card, EmptyState, PageHeader } from '@sovereignfs/ui';
import { NewCardDialog } from '../_components/NewCardDialog';
import { listCards } from '../_lib/actions';
import styles from './page.module.css';

export default async function CardsPage() {
  const cards = await listCards();

  return (
    <div className={styles.page}>
      <PageHeader
        title="Cards"
        description="Loyalty and membership cards."
        action={<NewCardDialog />}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon="package"
          heading="No cards yet"
          description="Add your first loyalty or membership card."
        />
      ) : (
        <section className={styles.cardGrid} aria-label="Cards">
          {cards.map((card) => (
            <Link key={card.id} href={`/wallet/cards/${card.id}`} className={styles.cardLink}>
              <Card interactive className={styles.cardTile}>
                <h2 className={styles.cardTitle}>{card.title || 'Untitled card'}</h2>
                {card.issuer && <p className={styles.cardIssuer}>{card.issuer}</p>}
              </Card>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
