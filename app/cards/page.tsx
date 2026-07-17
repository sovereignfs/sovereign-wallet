import { EmptyState, PageHeader } from '@sovereignfs/ui';
import { CardsListView } from '../_components/CardsListView';
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
        <CardsListView cards={cards} />
      )}
    </div>
  );
}
