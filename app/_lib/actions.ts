'use server';

import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sdk } from '@sovereignfs/sdk';
import { walletCardPayloads, walletItems } from '../_db/schema';
import { parseCardMetadata, serializeCardMetadata } from './cardMetadata';

// DrizzleClient is typed as `unknown` in the SDK (dialect-agnostic contract).
// We cast to the SQLite type here since this plugin's manifest resolves to SQLite only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<'async', any, any>;

const BARCODE_FORMATS = ['qr', 'code128', 'code39', 'ean13', 'upc', 'other'] as const;
export type BarcodeFormat = (typeof BARCODE_FORMATS)[number];

export interface CardListItem {
  id: string;
  title: string;
  issuer: string;
  barcodeFormat: string | null;
  updatedAt: number;
}

export interface CardDetail {
  id: string;
  title: string;
  issuer: string;
  notes: string;
  barcodeFormat: string | null;
  payload: string;
  createdAt: number;
  updatedAt: number;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

async function getContext() {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;
  return { db, userId: session.user.id, tenantId: session.user.tenantId };
}

function formString(formData: FormData, key: string, fallback = '') {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : fallback;
}

export async function listCards(): Promise<CardListItem[]> {
  const { db, userId, tenantId } = await getContext();

  const rows = await db
    .select({
      id: walletItems.id,
      encryptedMetadata: walletItems.encryptedMetadata,
      updatedAt: walletItems.updatedAt,
      barcodeFormat: walletCardPayloads.barcodeFormat,
    })
    .from(walletItems)
    .leftJoin(walletCardPayloads, eq(walletCardPayloads.itemId, walletItems.id))
    .where(
      and(
        eq(walletItems.tenantId, tenantId),
        eq(walletItems.ownerUserId, userId),
        eq(walletItems.kind, 'card'),
      ),
    )
    .orderBy(desc(walletItems.updatedAt));

  return rows.map((row) => {
    const metadata = parseCardMetadata(row.encryptedMetadata);
    return {
      id: row.id,
      title: metadata.title,
      issuer: metadata.issuer,
      barcodeFormat: row.barcodeFormat,
      updatedAt: row.updatedAt,
    };
  });
}

export async function getCard(cardId: string): Promise<CardDetail | null> {
  const { db, userId, tenantId } = await getContext();

  const rows = await db
    .select({
      id: walletItems.id,
      encryptedMetadata: walletItems.encryptedMetadata,
      createdAt: walletItems.createdAt,
      updatedAt: walletItems.updatedAt,
      barcodeFormat: walletCardPayloads.barcodeFormat,
      payload: walletCardPayloads.payload,
    })
    .from(walletItems)
    .innerJoin(walletCardPayloads, eq(walletCardPayloads.itemId, walletItems.id))
    .where(
      and(
        eq(walletItems.id, cardId),
        eq(walletItems.tenantId, tenantId),
        eq(walletItems.ownerUserId, userId),
        eq(walletItems.kind, 'card'),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const metadata = parseCardMetadata(row.encryptedMetadata);
  return {
    id: row.id,
    title: metadata.title,
    issuer: metadata.issuer,
    notes: metadata.notes,
    barcodeFormat: row.barcodeFormat,
    payload: row.payload,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createCard(formData: FormData) {
  const { db, userId, tenantId } = await getContext();

  const title = formString(formData, 'title');
  if (!title) throw new Error('Display name is required.');
  const payload = formString(formData, 'payload');
  if (!payload) throw new Error('Card payload is required.');

  const issuer = formString(formData, 'issuer');
  const notes = formString(formData, 'notes');
  const barcodeFormatRaw = formString(formData, 'barcodeFormat');
  const barcodeFormat = (
    BARCODE_FORMATS as readonly string[]
  ).includes(barcodeFormatRaw)
    ? barcodeFormatRaw
    : 'other';

  const itemId = randomUUID();
  const ts = now();

  await db.insert(walletItems).values({
    id: itemId,
    tenantId,
    ownerUserId: userId,
    kind: 'card',
    encryptedMetadata: serializeCardMetadata({ title, issuer, notes }),
    createdAt: ts,
    updatedAt: ts,
  });

  await db.insert(walletCardPayloads).values({
    id: randomUUID(),
    tenantId,
    itemId,
    ownerUserId: userId,
    barcodeFormat,
    payloadEncrypted: false,
    payload,
    createdAt: ts,
    updatedAt: ts,
  });

  revalidatePath('/wallet');
  revalidatePath('/wallet/cards');
  redirect(`/wallet/cards/${itemId}`);
}

export async function updateCard(cardId: string, formData: FormData) {
  const { db, userId, tenantId } = await getContext();

  const title = formString(formData, 'title');
  if (!title) throw new Error('Display name is required.');
  const payload = formString(formData, 'payload');
  if (!payload) throw new Error('Card payload is required.');

  const issuer = formString(formData, 'issuer');
  const notes = formString(formData, 'notes');
  const barcodeFormatRaw = formString(formData, 'barcodeFormat');
  const barcodeFormat = (
    BARCODE_FORMATS as readonly string[]
  ).includes(barcodeFormatRaw)
    ? barcodeFormatRaw
    : 'other';

  const ts = now();

  const updatedItems = await db
    .update(walletItems)
    .set({
      encryptedMetadata: serializeCardMetadata({ title, issuer, notes }),
      updatedAt: ts,
    })
    .where(
      and(
        eq(walletItems.id, cardId),
        eq(walletItems.tenantId, tenantId),
        eq(walletItems.ownerUserId, userId),
        eq(walletItems.kind, 'card'),
      ),
    )
    .returning({ id: walletItems.id });

  if (updatedItems.length === 0) throw new Error('Card not found.');

  await db
    .update(walletCardPayloads)
    .set({ barcodeFormat, payload, updatedAt: ts })
    .where(
      and(
        eq(walletCardPayloads.itemId, cardId),
        eq(walletCardPayloads.tenantId, tenantId),
        eq(walletCardPayloads.ownerUserId, userId),
      ),
    );

  revalidatePath('/wallet');
  revalidatePath('/wallet/cards');
  revalidatePath(`/wallet/cards/${cardId}`);
}

export async function deleteCard(cardId: string) {
  const { db, userId, tenantId } = await getContext();

  await db
    .delete(walletCardPayloads)
    .where(
      and(
        eq(walletCardPayloads.itemId, cardId),
        eq(walletCardPayloads.tenantId, tenantId),
        eq(walletCardPayloads.ownerUserId, userId),
      ),
    );

  await db
    .delete(walletItems)
    .where(
      and(
        eq(walletItems.id, cardId),
        eq(walletItems.tenantId, tenantId),
        eq(walletItems.ownerUserId, userId),
        eq(walletItems.kind, 'card'),
      ),
    );

  revalidatePath('/wallet');
  revalidatePath('/wallet/cards');
  redirect('/wallet/cards');
}
