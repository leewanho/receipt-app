import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Receipt } from '../types';

interface ReceiptDB extends DBSchema {
  receipts: { key: string; value: Receipt };
  images: { key: string; value: { receiptId: string; blob: Blob } };
}

let dbPromise: Promise<IDBPDatabase<ReceiptDB>> | null = null;

function db(): Promise<IDBPDatabase<ReceiptDB>> {
  dbPromise ??= openDB<ReceiptDB>('receipt-app', 1, {
    upgrade(d) {
      d.createObjectStore('receipts', { keyPath: 'id' });
      d.createObjectStore('images', { keyPath: 'receiptId' });
    },
  });
  return dbPromise;
}

/** 최신 영수증(날짜, 같은 날이면 나중에 넣은 것)이 위로 오도록 */
export async function listReceipts(): Promise<Receipt[]> {
  const all = await (await db()).getAll('receipts');
  return all.sort((a, b) => {
    const ad = a.date ?? '';
    const bd = b.date ?? '';
    return ad === bd ? b.createdAt - a.createdAt : ad < bd ? 1 : -1;
  });
}

export async function saveReceipt(receipt: Receipt, image?: Blob): Promise<void> {
  const d = await db();
  const tx = d.transaction(['receipts', 'images'], 'readwrite');
  await tx.objectStore('receipts').put(receipt);
  if (image) await tx.objectStore('images').put({ receiptId: receipt.id, blob: image });
  await tx.done;
}

export async function getImage(receiptId: string): Promise<Blob | undefined> {
  return (await (await db()).get('images', receiptId))?.blob;
}

export async function deleteReceipt(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['receipts', 'images'], 'readwrite');
  await tx.objectStore('receipts').delete(id);
  await tx.objectStore('images').delete(id);
  await tx.done;
}

export async function listAllWithImages(): Promise<{ receipt: Receipt; image?: Blob }[]> {
  const d = await db();
  const receipts = await d.getAll('receipts');
  return Promise.all(
    receipts.map(async (receipt) => ({ receipt, image: (await d.get('images', receipt.id))?.blob })),
  );
}
