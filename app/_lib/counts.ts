import { and, count, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { sdk } from '@sovereignfs/sdk';
import { walletItems } from '../_db/schema';

// DrizzleClient is typed as `unknown` in the SDK (dialect-agnostic contract).
// We cast to the SQLite type here since this plugin's manifest resolves to SQLite only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<'async', any, any>;

export interface WalletItemCounts {
  cards: number;
  documents: number;
}

/** Per-kind counts of the current user's own wallet items. */
export async function getWalletItemCounts(): Promise<WalletItemCounts> {
  const session = await sdk.auth.getSession();
  if (!session) return { cards: 0, documents: 0 };

  const db = (await sdk.db.getClient()) as Db;
  const rows = await db
    .select({ kind: walletItems.kind, count: count() })
    .from(walletItems)
    .where(
      and(
        eq(walletItems.tenantId, session.user.tenantId),
        eq(walletItems.ownerUserId, session.user.id),
      ),
    )
    .groupBy(walletItems.kind);

  const counts: WalletItemCounts = { cards: 0, documents: 0 };
  for (const row of rows) {
    if (row.kind === 'card') counts.cards = row.count;
    if (row.kind === 'document') counts.documents = row.count;
  }
  return counts;
}
