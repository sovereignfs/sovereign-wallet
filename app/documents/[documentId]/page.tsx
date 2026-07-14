import { notFound } from 'next/navigation';
import { BackLink } from '../../_components/BackLink';
import { DocumentDetailView } from '../../_components/DocumentDetailView';
import { getDocument } from '../../_lib/documentActions';
import styles from './page.module.css';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const document = await getDocument(documentId);
  if (!document) notFound();

  return (
    <div className={styles.page}>
      <BackLink href="/wallet/documents">Back to documents</BackLink>
      <DocumentDetailView document={document} />
    </div>
  );
}
