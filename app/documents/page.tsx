import Link from 'next/link';
import { Card, EmptyState, PageHeader } from '@sovereignfs/ui';
import { DocumentUploadGate, EncryptionRequiredNotice } from '../_components/DocumentUploadGate';
import { listDocuments } from '../_lib/documentActions';
import styles from './page.module.css';

export default async function DocumentsPage() {
  const documents = await listDocuments();

  return (
    <div className={styles.page}>
      <PageHeader
        title="Documents"
        description="Sensitive documents, always encrypted client-side."
        action={<DocumentUploadGate />}
      />
      <EncryptionRequiredNotice />

      {documents.length === 0 ? (
        <EmptyState
          icon="package"
          heading="No documents yet"
          description="Add your first sensitive document."
        />
      ) : (
        <section className={styles.documentGrid} aria-label="Documents">
          {documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/wallet/documents/${doc.id}`}
              className={styles.documentLink}
            >
              <Card interactive className={styles.documentTile}>
                <h2 className={styles.documentTitle}>🔒 Encrypted document</h2>
              </Card>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
