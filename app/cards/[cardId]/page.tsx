import { notFound } from 'next/navigation';
import { BackLink } from '../../_components/BackLink';
import { CardDetailView } from '../../_components/CardDetailView';
import { getCard } from '../../_lib/actions';
import styles from './page.module.css';

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  const card = await getCard(cardId);
  if (!card) notFound();

  return (
    <div className={styles.page}>
      <BackLink href="/wallet/cards">Back to cards</BackLink>
      <CardDetailView card={card} />
    </div>
  );
}
