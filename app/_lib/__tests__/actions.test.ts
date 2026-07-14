import { getTableName, type Table } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Condition = { kind: 'eq'; key: string; value: unknown } | { kind: 'and'; conditions: Condition[] };

function toCamel(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_match, c: string) => c.toUpperCase());
}

// Same harness as portability.test.ts — mocks eq()/and() into an
// interpretable Condition tree so the fake db can actually filter rows,
// which is what a tenant/owner-scoping test sweep needs to be meaningful
// (a stub that always returns everything would prove nothing).
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: { name: string }, value: unknown): Condition => ({
      kind: 'eq',
      key: toCamel(column.name),
      value,
    }),
    and: (...conditions: Condition[]): Condition => ({ kind: 'and', conditions }),
  };
});

function matches(row: Row, condition?: Condition): boolean {
  if (!condition) return true;
  if (condition.kind === 'eq') return row[condition.key] === condition.value;
  return condition.conditions.every((c) => matches(row, c));
}

let sessionUserId = 'user-1';
let sessionTenantId = 't1';

vi.mock('@sovereignfs/sdk', () => ({
  sdk: {
    auth: { requireSession: vi.fn(async () => ({ user: { id: sessionUserId, tenantId: sessionTenantId } })) },
    db: { getClient: vi.fn(async () => fakeDb) },
    storage: {
      put: vi.fn(async () => undefined),
      get: vi.fn(async () => null),
      delete: vi.fn(async () => undefined),
      getSignedUrl: vi.fn(async () => 'https://example.test/signed'),
    },
  },
}));

interface Store extends Record<string, Row[]> {
  wallet_items: Row[];
  wallet_card_payloads: Row[];
}

let store: Store = { wallet_items: [], wallet_card_payloads: [] };

function resetStore() {
  store = { wallet_items: [], wallet_card_payloads: [] };
}

function project(rows: Row[], columns?: Record<string, unknown>): Row[] {
  if (!columns) return rows;
  return rows.map((row) => {
    const projected: Row = {};
    for (const key of Object.keys(columns)) projected[key] = row[key];
    return projected;
  });
}

function whereChain(rows: Row[], columns: Record<string, unknown> | undefined) {
  return {
    where: (condition?: Condition) => {
      const filtered = rows.filter((row) => matches(row, condition));
      const projected = project(filtered, columns);
      return Object.assign(Promise.resolve(projected), {
        limit: (_n: number) => Promise.resolve(projected),
        returning: (_cols: unknown) => Promise.resolve(projected),
      });
    },
  };
}

const fakeDb = {
  select(columns?: Record<string, unknown>) {
    return {
      from(table: Table) {
        const tableName = getTableName(table);
        const rows = store[tableName] ?? [];
        return {
          ...whereChain(rows, columns),
          innerJoin: (joinTable: Table, _on: unknown) => {
            const joinName = getTableName(joinTable);
            const joined = rows.map((row) => {
              const match = (store[joinName] ?? []).find((r) => r.itemId === row.id);
              return { ...match, ...row };
            });
            return whereChain(joined, columns);
          },
        };
      },
    };
  },
  insert(table: Table) {
    const tableName = getTableName(table);
    return {
      values: async (row: Row) => {
        (store[tableName] ??= []).push(row);
      },
    };
  },
  update(table: Table) {
    const tableName = getTableName(table);
    return {
      set: (patch: Row) => ({
        where: (condition?: Condition) => {
          const matched = (store[tableName] ?? []).filter((row) => matches(row, condition));
          store[tableName] = (store[tableName] ?? []).map((row) =>
            matches(row, condition) ? { ...row, ...patch } : row,
          );
          return Object.assign(Promise.resolve(matched), {
            returning: (_cols: unknown) => Promise.resolve(matched),
          });
        },
      }),
    };
  },
  delete(table: Table) {
    const tableName = getTableName(table);
    return {
      where: async (condition?: Condition) => {
        store[tableName] = (store[tableName] ?? []).filter((row) => !matches(row, condition));
      },
    };
  },
};

function seedCard(overrides: Partial<Row> = {}) {
  store.wallet_items.push({
    id: 'card-1',
    tenantId: 't1',
    ownerUserId: 'user-1',
    kind: 'card',
    kindHint: null,
    storageObjectKey: null,
    encryptionVersion: null,
    encryptedMetadata: JSON.stringify({ title: 'Costco', issuer: '', notes: '' }),
    wrappedDek: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  });
  store.wallet_card_payloads.push({
    id: 'payload-1',
    tenantId: 't1',
    itemId: 'card-1',
    ownerUserId: 'user-1',
    barcodeFormat: 'qr',
    payloadEncrypted: false,
    payload: '1234',
    frontImageKey: null,
    backImageKey: null,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
  sessionUserId = 'user-1';
  sessionTenantId = 't1';
});

describe('tenant/owner scoping — getCard', () => {
  it("returns null for another user's card in the same tenant", async () => {
    const { getCard } = await import('../actions');
    seedCard();
    sessionUserId = 'user-2'; // different owner, same tenant

    expect(await getCard('card-1')).toBeNull();
  });

  it('returns null for the same owner id in a different tenant', async () => {
    const { getCard } = await import('../actions');
    seedCard();
    sessionTenantId = 't2'; // different tenant, same nominal userId

    expect(await getCard('card-1')).toBeNull();
  });

  it("returns the card for its actual owner in its actual tenant", async () => {
    const { getCard } = await import('../actions');
    seedCard();

    const card = await getCard('card-1');
    expect(card?.id).toBe('card-1');
  });
});

describe('tenant/owner scoping — updateCard', () => {
  it("throws and makes no changes when called for another user's card", async () => {
    const { updateCard } = await import('../actions');
    seedCard();
    const originalMetadata = store.wallet_items[0]?.encryptedMetadata;
    sessionUserId = 'user-2';

    const formData = new FormData();
    formData.set('title', 'Hijacked');
    formData.set('payload', '9999');
    formData.set('barcodeFormat', 'qr');

    await expect(updateCard('card-1', formData)).rejects.toThrow();
    expect(store.wallet_items[0]?.encryptedMetadata).toBe(originalMetadata);
  });
});

describe('tenant/owner scoping — deleteCard', () => {
  it("is a no-op when called for another tenant's card of the same id", async () => {
    const { deleteCard } = await import('../actions');
    seedCard();
    sessionTenantId = 't2';

    // deleteCard() redirects (throws NEXT_REDIRECT) on success; a
    // cross-tenant call should leave the row untouched either way.
    await expect(deleteCard('card-1')).rejects.toThrow();
    expect(store.wallet_items).toHaveLength(1);
    expect(store.wallet_card_payloads).toHaveLength(1);
  });
});
