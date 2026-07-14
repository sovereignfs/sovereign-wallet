'use server';

import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sdk } from '@sovereignfs/sdk';
import { walletItems } from '../_db/schema';
import type { EncryptedField, WrappedDekField } from './actions';
import { formString, now } from './formUtils';

// DrizzleClient is typed as `unknown` in the SDK (dialect-agnostic contract).
// We cast to the SQLite type here since this plugin's manifest resolves to SQLite only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<'async', any, any>;

/**
 * Sensitive documents (SPEC: "client-side encrypted object required" — unlike
 * loyalty cards, there is no plaintext path here at all; W-11's opt-in model
 * doesn't apply). The binary ciphertext lives in `sdk.storage`
 * (`documents/<id>`); `wallet_items` holds only the wrapped DEK and encrypted
 * metadata, mirroring the encrypted-card shape from `actions.ts`.
 */
export interface DocumentListItem {
  id: string;
  updatedAt: number;
}

export interface DocumentDetail {
  id: string;
  createdAt: number;
  updatedAt: number;
  wrappedDek: WrappedDekField;
  encryptedMetadata: EncryptedField;
  /** IV + algorithm version for the storage object's ciphertext (`sdk.storage` metadata). */
  blobIv: string;
  blobAlgorithmVersion: string;
  /** Short-lived signed download URL for the ciphertext bytes. */
  downloadUrl: string;
}

async function getContext() {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;
  return { db, userId: session.user.id, tenantId: session.user.tenantId };
}

export async function listDocuments(): Promise<DocumentListItem[]> {
  const { db, userId, tenantId } = await getContext();

  const rows = await db
    .select({ id: walletItems.id, updatedAt: walletItems.updatedAt })
    .from(walletItems)
    .where(
      and(
        eq(walletItems.tenantId, tenantId),
        eq(walletItems.ownerUserId, userId),
        eq(walletItems.kind, 'document'),
      ),
    )
    .orderBy(desc(walletItems.updatedAt));

  return rows;
}

export async function getDocument(id: string): Promise<DocumentDetail | null> {
  const { db, userId, tenantId } = await getContext();

  const rows = await db
    .select({
      id: walletItems.id,
      encryptedMetadata: walletItems.encryptedMetadata,
      wrappedDek: walletItems.wrappedDek,
      storageObjectKey: walletItems.storageObjectKey,
      createdAt: walletItems.createdAt,
      updatedAt: walletItems.updatedAt,
    })
    .from(walletItems)
    .where(
      and(
        eq(walletItems.id, id),
        eq(walletItems.tenantId, tenantId),
        eq(walletItems.ownerUserId, userId),
        eq(walletItems.kind, 'document'),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row || !row.storageObjectKey || !row.wrappedDek || !row.encryptedMetadata) return null;

  const object = await sdk.storage.get(row.storageObjectKey);
  if (!object) return null;
  const blobMeta = object.metadata as { iv: string; blobAlgorithmVersion: string } | null;
  if (!blobMeta) return null;

  const downloadUrl = await sdk.storage.getSignedUrl(row.storageObjectKey, {
    expiresInSeconds: 300,
  });

  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    wrappedDek: JSON.parse(row.wrappedDek) as WrappedDekField,
    encryptedMetadata: JSON.parse(row.encryptedMetadata) as EncryptedField,
    blobIv: blobMeta.iv,
    blobAlgorithmVersion: blobMeta.blobAlgorithmVersion,
    downloadUrl,
  };
}

export async function createDocument(formData: FormData) {
  const { db, userId, tenantId } = await getContext();

  const ciphertext = formData.get('ciphertext');
  const iv = formString(formData, 'blobIv');
  const blobAlgorithmVersion = formString(formData, 'blobAlgorithmVersion');
  const encryptedMetadata = formString(formData, 'encryptedMetadata');
  const wrappedDekRaw = formString(formData, 'wrappedDek');
  if (
    !(ciphertext instanceof Blob) ||
    !iv ||
    !blobAlgorithmVersion ||
    !encryptedMetadata ||
    !wrappedDekRaw
  ) {
    throw new Error('Missing encrypted document data.');
  }
  const wrappedDek = JSON.parse(wrappedDekRaw) as WrappedDekField;

  const key = `documents/${randomUUID()}`;
  await sdk.storage.put({
    key,
    body: ciphertext,
    // Never the real content type — that's inside the encrypted metadata.
    contentType: 'application/octet-stream',
    ownerUserId: userId,
    metadata: { iv, blobAlgorithmVersion },
  });

  const itemId = randomUUID();
  const ts = now();
  await db.insert(walletItems).values({
    id: itemId,
    tenantId,
    ownerUserId: userId,
    kind: 'document',
    storageObjectKey: key,
    encryptionVersion: wrappedDek.algorithmVersion,
    encryptedMetadata,
    wrappedDek: wrappedDekRaw,
    createdAt: ts,
    updatedAt: ts,
  });

  revalidatePath('/wallet');
  revalidatePath('/wallet/documents');
  redirect(`/wallet/documents/${itemId}`);
}

export async function deleteDocument(id: string) {
  const { db, userId, tenantId } = await getContext();

  const rows = await db
    .select({ storageObjectKey: walletItems.storageObjectKey })
    .from(walletItems)
    .where(
      and(
        eq(walletItems.id, id),
        eq(walletItems.tenantId, tenantId),
        eq(walletItems.ownerUserId, userId),
        eq(walletItems.kind, 'document'),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return;

  if (row.storageObjectKey) {
    await sdk.storage.delete(row.storageObjectKey);
  }
  await db
    .delete(walletItems)
    .where(
      and(
        eq(walletItems.id, id),
        eq(walletItems.tenantId, tenantId),
        eq(walletItems.ownerUserId, userId),
        eq(walletItems.kind, 'document'),
      ),
    );

  revalidatePath('/wallet');
  revalidatePath('/wallet/documents');
  redirect('/wallet/documents');
}
