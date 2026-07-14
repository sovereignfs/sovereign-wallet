'use server';

import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sdk } from '@sovereignfs/sdk';
import { walletCardPayloads, walletItems } from '../_db/schema';
import { parseCardMetadata, serializeCardMetadata } from './cardMetadata';
import { formString, now } from './formUtils';

// DrizzleClient is typed as `unknown` in the SDK (dialect-agnostic contract).
// We cast to the SQLite type here since this plugin's manifest resolves to SQLite only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<'async', any, any>;

const BARCODE_FORMATS = ['qr', 'code128', 'code39', 'ean13', 'upc', 'other'] as const;
export type BarcodeFormat = (typeof BARCODE_FORMATS)[number];

/** Opaque ciphertext + IV, matching `EncryptedJson` from `@sovereignfs/sdk/e2ee-object`. */
export interface EncryptedField {
  ciphertext: string;
  iv: string;
  algorithmVersion: string;
}

/** Opaque wrapped DEK, matching `WrappedDek` from `@sovereignfs/sdk/e2ee-crypto`. */
export interface WrappedDekField {
  wrappedDek: string;
  algorithmVersion: string;
}

export interface CardListItem {
  id: string;
  encrypted: boolean;
  /** Empty for an encrypted card — the list view never decrypts (RFC 0060 locked-state UX). */
  title: string;
  issuer: string;
  barcodeFormat: string | null;
  updatedAt: number;
}

/**
 * A card image (W-15). `iv`/`algorithmVersion` are non-null only when the
 * card itself is encrypted — the image then travels as ciphertext under the
 * card's own DEK, decrypted client-side same as the payload/metadata. When
 * the card is unencrypted, `downloadUrl` is directly usable in `<img src>`.
 */
export interface CardImage {
  downloadUrl: string;
  iv: string | null;
  algorithmVersion: string | null;
  /** The original image MIME type, needed to reconstruct a renderable `Blob` after decrypting. */
  contentType: string | null;
}

export interface CardDetail {
  id: string;
  encrypted: boolean;
  barcodeFormat: string | null;
  createdAt: number;
  updatedAt: number;
  /** Populated when `!encrypted`; empty otherwise — decryption happens client-side. */
  title: string;
  issuer: string;
  notes: string;
  payload: string;
  frontImage: CardImage | null;
  backImage: CardImage | null;
  /** Populated when `encrypted`; `null` otherwise. */
  cipher: {
    encryptedMetadata: EncryptedField;
    encryptedPayload: EncryptedField;
    wrappedDek: WrappedDekField;
  } | null;
}

async function getContext() {
  const session = await sdk.auth.requireSession();
  const db = (await sdk.db.getClient()) as Db;
  return { db, userId: session.user.id, tenantId: session.user.tenantId };
}

/**
 * Resolves a stored `sdk.storage` image key into a signed URL + (if
 * encrypted) its cipher metadata. Degrades to `null` (no image) rather than
 * throwing if the object is missing — `getSignedUrl()` throws for a
 * nonexistent key, which would otherwise 500 the whole card page over one
 * missing image (W-17 locked-state/edge-case hardening).
 */
async function resolveCardImage(key: string | null, encrypted: boolean): Promise<CardImage | null> {
  if (!key) return null;
  const object = await sdk.storage.get(key);
  if (!object) return null;

  if (!encrypted) {
    const downloadUrl = await sdk.storage.getSignedUrl(key, { expiresInSeconds: 300 });
    return { downloadUrl, iv: null, algorithmVersion: null, contentType: object.contentType };
  }

  const blobMeta = object.metadata as
    | { iv: string; blobAlgorithmVersion: string; contentType: string }
    | null;
  if (!blobMeta) return null; // missing cipher metadata — can't be decrypted; treat as absent rather than 500ing
  const downloadUrl = await sdk.storage.getSignedUrl(key, { expiresInSeconds: 300 });
  return {
    downloadUrl,
    iv: blobMeta.iv,
    algorithmVersion: blobMeta.blobAlgorithmVersion,
    contentType: blobMeta.contentType,
  };
}

export async function listCards(): Promise<CardListItem[]> {
  const { db, userId, tenantId } = await getContext();

  const rows = await db
    .select({
      id: walletItems.id,
      encryptedMetadata: walletItems.encryptedMetadata,
      encryptionVersion: walletItems.encryptionVersion,
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
    const encrypted = row.encryptionVersion !== null;
    // The list view never decrypts — only plaintext title/issuer are ever assembled here.
    const metadata = encrypted ? { title: '', issuer: '' } : parseCardMetadata(row.encryptedMetadata);
    return {
      id: row.id,
      encrypted,
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
      encryptionVersion: walletItems.encryptionVersion,
      wrappedDek: walletItems.wrappedDek,
      createdAt: walletItems.createdAt,
      updatedAt: walletItems.updatedAt,
      barcodeFormat: walletCardPayloads.barcodeFormat,
      payload: walletCardPayloads.payload,
      frontImageKey: walletCardPayloads.frontImageKey,
      backImageKey: walletCardPayloads.backImageKey,
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

  const encrypted = row.encryptionVersion !== null;
  const [frontImage, backImage] = await Promise.all([
    resolveCardImage(row.frontImageKey, encrypted),
    resolveCardImage(row.backImageKey, encrypted),
  ]);

  if (encrypted) {
    if (!row.wrappedDek) throw new Error('Encrypted card is missing its wrapped key.');
    return {
      id: row.id,
      encrypted: true,
      title: '',
      issuer: '',
      notes: '',
      payload: '',
      barcodeFormat: row.barcodeFormat,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      frontImage,
      backImage,
      cipher: {
        encryptedMetadata: JSON.parse(row.encryptedMetadata ?? 'null') as EncryptedField,
        encryptedPayload: JSON.parse(row.payload) as EncryptedField,
        wrappedDek: JSON.parse(row.wrappedDek) as WrappedDekField,
      },
    };
  }

  const metadata = parseCardMetadata(row.encryptedMetadata);
  return {
    id: row.id,
    encrypted: false,
    title: metadata.title,
    issuer: metadata.issuer,
    notes: metadata.notes,
    barcodeFormat: row.barcodeFormat,
    payload: row.payload,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    frontImage,
    backImage,
    cipher: null,
  };
}

/** Parses and validates the client-encrypted fields a form submits when "Encrypt this card" is checked. */
function encryptedFormFields(formData: FormData) {
  const encryptedMetadata = formString(formData, 'encryptedMetadata');
  const encryptedPayload = formString(formData, 'encryptedPayload');
  const wrappedDekRaw = formString(formData, 'wrappedDek');
  if (!encryptedMetadata || !encryptedPayload || !wrappedDekRaw) {
    throw new Error('Missing encrypted card data.');
  }
  return {
    encryptedMetadata,
    encryptedPayload,
    wrappedDek: JSON.parse(wrappedDekRaw) as WrappedDekField,
  };
}

function barcodeFormatFrom(formData: FormData): string {
  const raw = formString(formData, 'barcodeFormat');
  return (BARCODE_FORMATS as readonly string[]).includes(raw) ? raw : 'other';
}

/**
 * Uploads an optional `${side}Image` file from the form via `sdk.storage`
 * (W-15). If the card is encrypted, the client has already encrypted the
 * bytes and sends `${side}ImageIv`/`${side}ImageAlgorithmVersion` alongside —
 * stored as opaque `sdk.storage` metadata, same shape as documents. Returns
 * `undefined` when no file was submitted (caller should leave the existing
 * key, if any, unchanged) or the new object's key otherwise.
 */
async function uploadCardImage(
  formData: FormData,
  side: 'front' | 'back',
  ownerUserId: string,
): Promise<string | undefined> {
  const file = formData.get(`${side}Image`);
  if (!(file instanceof File) || file.size === 0) return undefined;

  const iv = formString(formData, `${side}ImageIv`);
  const algorithmVersion = formString(formData, `${side}ImageAlgorithmVersion`);
  const contentType = formString(formData, `${side}ImageContentType`);
  const key = `cards/${randomUUID()}`;
  await sdk.storage.put({
    key,
    body: file,
    contentType: iv ? 'application/octet-stream' : file.type,
    ownerUserId,
    metadata: iv ? { iv, blobAlgorithmVersion: algorithmVersion, contentType } : null,
  });
  return key;
}

export async function createCard(formData: FormData) {
  const { db, userId, tenantId } = await getContext();
  const barcodeFormat = barcodeFormatFrom(formData);
  const itemId = randomUUID();
  const ts = now();
  const [frontImageKey, backImageKey] = await Promise.all([
    uploadCardImage(formData, 'front', userId),
    uploadCardImage(formData, 'back', userId),
  ]);

  if (formString(formData, 'encrypted') === 'true') {
    const { encryptedMetadata, encryptedPayload, wrappedDek } = encryptedFormFields(formData);

    await db.insert(walletItems).values({
      id: itemId,
      tenantId,
      ownerUserId: userId,
      kind: 'card',
      encryptedMetadata,
      encryptionVersion: wrappedDek.algorithmVersion,
      wrappedDek: JSON.stringify(wrappedDek),
      createdAt: ts,
      updatedAt: ts,
    });

    await db.insert(walletCardPayloads).values({
      id: randomUUID(),
      tenantId,
      itemId,
      ownerUserId: userId,
      barcodeFormat,
      payloadEncrypted: true,
      payload: encryptedPayload,
      frontImageKey: frontImageKey ?? null,
      backImageKey: backImageKey ?? null,
      createdAt: ts,
      updatedAt: ts,
    });
  } else {
    const title = formString(formData, 'title');
    if (!title) throw new Error('Display name is required.');
    const payload = formString(formData, 'payload');
    if (!payload) throw new Error('Card payload is required.');
    const issuer = formString(formData, 'issuer');
    const notes = formString(formData, 'notes');

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
      frontImageKey: frontImageKey ?? null,
      backImageKey: backImageKey ?? null,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  revalidatePath('/wallet');
  revalidatePath('/wallet/cards');
  redirect(`/wallet/cards/${itemId}`);
}

export async function updateCard(cardId: string, formData: FormData) {
  const { db, userId, tenantId } = await getContext();
  const barcodeFormat = barcodeFormatFrom(formData);
  const ts = now();

  const cardScope = and(
    eq(walletItems.id, cardId),
    eq(walletItems.tenantId, tenantId),
    eq(walletItems.ownerUserId, userId),
    eq(walletItems.kind, 'card'),
  );
  const payloadScope = and(
    eq(walletCardPayloads.itemId, cardId),
    eq(walletCardPayloads.tenantId, tenantId),
    eq(walletCardPayloads.ownerUserId, userId),
  );

  const existing = await db
    .select({ frontImageKey: walletCardPayloads.frontImageKey, backImageKey: walletCardPayloads.backImageKey })
    .from(walletCardPayloads)
    .where(payloadScope)
    .limit(1);
  const previous = existing[0];
  // Verify ownership before uploading anything — a crafted request for a
  // cardId the caller doesn't own must not upload orphaned storage objects
  // under its own account before the (rejected) DB write below.
  if (!previous) throw new Error('Card not found.');

  const [newFrontImageKey, newBackImageKey] = await Promise.all([
    uploadCardImage(formData, 'front', userId),
    uploadCardImage(formData, 'back', userId),
  ]);
  // A new upload replaces the old object; the old bytes are deleted once the
  // new one is safely stored, matching the RFC 0044 storage-object lifecycle.
  await Promise.all([
    newFrontImageKey && previous?.frontImageKey
      ? sdk.storage.delete(previous.frontImageKey)
      : Promise.resolve(),
    newBackImageKey && previous?.backImageKey
      ? sdk.storage.delete(previous.backImageKey)
      : Promise.resolve(),
  ]);
  const imagePatch = {
    ...(newFrontImageKey !== undefined && { frontImageKey: newFrontImageKey }),
    ...(newBackImageKey !== undefined && { backImageKey: newBackImageKey }),
  };

  if (formString(formData, 'encrypted') === 'true') {
    const { encryptedMetadata, encryptedPayload, wrappedDek } = encryptedFormFields(formData);

    const updatedItems = await db
      .update(walletItems)
      .set({
        encryptedMetadata,
        encryptionVersion: wrappedDek.algorithmVersion,
        wrappedDek: JSON.stringify(wrappedDek),
        updatedAt: ts,
      })
      .where(cardScope)
      .returning({ id: walletItems.id });
    if (updatedItems.length === 0) throw new Error('Card not found.');

    await db
      .update(walletCardPayloads)
      .set({
        barcodeFormat,
        payloadEncrypted: true,
        payload: encryptedPayload,
        ...imagePatch,
        updatedAt: ts,
      })
      .where(payloadScope);
  } else {
    const title = formString(formData, 'title');
    if (!title) throw new Error('Display name is required.');
    const payload = formString(formData, 'payload');
    if (!payload) throw new Error('Card payload is required.');
    const issuer = formString(formData, 'issuer');
    const notes = formString(formData, 'notes');

    const updatedItems = await db
      .update(walletItems)
      .set({ encryptedMetadata: serializeCardMetadata({ title, issuer, notes }), updatedAt: ts })
      .where(cardScope)
      .returning({ id: walletItems.id });
    if (updatedItems.length === 0) throw new Error('Card not found.');

    await db
      .update(walletCardPayloads)
      .set({ barcodeFormat, payloadEncrypted: false, payload, ...imagePatch, updatedAt: ts })
      .where(payloadScope);
  }

  revalidatePath('/wallet');
  revalidatePath('/wallet/cards');
  revalidatePath(`/wallet/cards/${cardId}`);
}

export async function deleteCard(cardId: string) {
  const { db, userId, tenantId } = await getContext();

  const payloadScope = and(
    eq(walletCardPayloads.itemId, cardId),
    eq(walletCardPayloads.tenantId, tenantId),
    eq(walletCardPayloads.ownerUserId, userId),
  );
  const existing = await db
    .select({ frontImageKey: walletCardPayloads.frontImageKey, backImageKey: walletCardPayloads.backImageKey })
    .from(walletCardPayloads)
    .where(payloadScope)
    .limit(1);
  const previous = existing[0];
  await Promise.all([
    previous?.frontImageKey ? sdk.storage.delete(previous.frontImageKey) : Promise.resolve(),
    previous?.backImageKey ? sdk.storage.delete(previous.backImageKey) : Promise.resolve(),
  ]);

  await db.delete(walletCardPayloads).where(payloadScope);

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
