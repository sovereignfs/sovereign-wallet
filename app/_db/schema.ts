import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Runtime query schema for Wallet's cards & documents track.
 *
 * This file intentionally lives under app/ because the Sovereign runtime mounts
 * the plugin app tree into Next routes. Server components/actions must not
 * import runtime query helpers from outside that mounted tree.
 */

export const walletItems = sqliteTable(
  'wallet_items',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    ownerUserId: text('owner_user_id').notNull(),
    kind: text('kind', { enum: ['card', 'document'] }).notNull(),
    kindHint: text('kind_hint'),
    storageObjectKey: text('storage_object_key'),
    encryptionVersion: text('encryption_version'),
    encryptedMetadata: text('encrypted_metadata'),
    wrappedDek: text('wrapped_dek'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('wallet_items_tenant_owner_idx').on(t.tenantId, t.ownerUserId)],
);

export const walletCardPayloads = sqliteTable(
  'wallet_card_payloads',
  {
    id: text('id').primaryKey(),
    tenantId: text('tenant_id').notNull(),
    itemId: text('item_id')
      .notNull()
      .references(() => walletItems.id),
    ownerUserId: text('owner_user_id').notNull(),
    barcodeFormat: text('barcode_format'),
    payloadEncrypted: integer('payload_encrypted', { mode: 'boolean' }).notNull().default(false),
    payload: text('payload').notNull(),
    /**
     * Optional card images (W-15), each an `sdk.storage` object key. Follow
     * the same encryption state as the card itself (`wallet_items.wrapped_dek`)
     * — plaintext bytes when the card is unencrypted, ciphertext under the
     * card's own DEK when it is. Never both at once for the same card.
     */
    frontImageKey: text('front_image_key'),
    backImageKey: text('back_image_key'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('wallet_card_payloads_item_idx').on(t.itemId)],
);

export const walletTables = {
  walletItems,
  walletCardPayloads,
};

export type WalletItem = InferSelectModel<typeof walletItems>;
export type WalletCardPayload = InferSelectModel<typeof walletCardPayloads>;
export type NewWalletItem = InferInsertModel<typeof walletItems>;
export type NewWalletCardPayload = InferInsertModel<typeof walletCardPayloads>;
