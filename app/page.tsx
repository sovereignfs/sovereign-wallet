import { sdk } from '@sovereignfs/sdk';
import styles from './wallet.module.css';

export default async function WalletPage() {
  const session = await sdk.auth.getSession();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Wallet</h1>
      <p className={styles.lead}>
        {session ? `Hello, ${session.user.name}!` : 'Hello, world!'}
      </p>
    </div>
  );
}
