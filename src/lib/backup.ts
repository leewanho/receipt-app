import type { Receipt } from '../types';
import { listAllWithImages, saveReceipt } from './db';

interface BackupFile {
  version: 1;
  exportedAt: string;
  receipts: { receipt: Receipt; imageDataUrl: string | null }[];
}

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = async (url: string): Promise<Blob> => (await fetch(url)).blob();

export async function createBackupFile(now = new Date()): Promise<File> {
  const all = await listAllWithImages();
  const body: BackupFile = {
    version: 1,
    exportedAt: now.toISOString(),
    receipts: await Promise.all(
      all.map(async ({ receipt, image }) => ({
        receipt,
        imageDataUrl: image ? await blobToDataUrl(image) : null,
      })),
    ),
  };
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return new File([JSON.stringify(body)], `영수증백업_${stamp}.json`, { type: 'application/json' });
}

const MAX_BACKUP_BYTES = 200 * 1024 * 1024;
const MAX_RECEIPTS = 20_000;

const isStr = (v: unknown): v is string => typeof v === 'string';
const isNumOrNull = (v: unknown): boolean => v === null || (typeof v === 'number' && Number.isFinite(v));
const isStrOrNull = (v: unknown): boolean => v === null || isStr(v);

/** 영수증 한 건이 우리가 저장하는 모양인지 확인하고, 모르는 필드는 버린다 */
function cleanReceipt(raw: unknown): Receipt {
  const r = (raw ?? {}) as Record<string, unknown>;
  const ok =
    isStr(r.id) && r.id.length > 0 && r.id.length <= 100 &&
    typeof r.createdAt === 'number' &&
    isStrOrNull(r.date) && isStrOrNull(r.merchant) && isNumOrNull(r.total) &&
    isStrOrNull(r.cardCompany) && isStrOrNull(r.businessNo) &&
    isNumOrNull(r.supplyAmount) && isNumOrNull(r.vat) &&
    (r.paymentMethod === null || r.paymentMethod === 'card' || r.paymentMethod === 'cash') &&
    isStr(r.memo) && Array.isArray(r.items) && Array.isArray(r.lowConfidence);
  if (!ok) throw new Error('invalid receipt');
  return {
    id: r.id as string,
    createdAt: r.createdAt as number,
    date: r.date as string | null,
    merchant: r.merchant as string | null,
    total: r.total as number | null,
    paymentMethod: r.paymentMethod as Receipt['paymentMethod'],
    cardCompany: r.cardCompany as string | null,
    businessNo: r.businessNo as string | null,
    supplyAmount: r.supplyAmount as number | null,
    vat: r.vat as number | null,
    memo: (r.memo as string).slice(0, 1000),
    items: (r.items as unknown[]).slice(0, 100).map((i) => {
      const it = (i ?? {}) as Record<string, unknown>;
      return {
        name: isStr(it.name) ? it.name.slice(0, 200) : '',
        quantity: typeof it.quantity === 'number' ? it.quantity : null,
        amount: typeof it.amount === 'number' ? it.amount : null,
      };
    }),
    lowConfidence: [],
  };
}

function parseBackup(text: string): BackupFile {
  const data: unknown = JSON.parse(text);
  const b = data as Partial<BackupFile> | null;
  if (!b || b.version !== 1 || !Array.isArray(b.receipts) || b.receipts.length > MAX_RECEIPTS) {
    throw new Error('invalid backup');
  }
  return {
    version: 1,
    exportedAt: isStr(b.exportedAt) ? b.exportedAt : '',
    receipts: b.receipts.map((entry) => {
      const e = (entry ?? {}) as { receipt?: unknown; imageDataUrl?: unknown };
      const url = isStr(e.imageDataUrl) && e.imageDataUrl.startsWith('data:image/') ? e.imageDataUrl : null;
      return { receipt: cleanReceipt(e.receipt), imageDataUrl: url };
    }),
  };
}

/** 백업 파일을 불러온다. 같은 영수증(id)은 덮어쓰고 나머지는 그대로 둔다. 불러온 개수를 돌려준다 */
export async function restoreBackup(file: File): Promise<number> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('backup too large');
  const backup = parseBackup(await file.text());
  for (const { receipt, imageDataUrl } of backup.receipts) {
    await saveReceipt(receipt, imageDataUrl ? await dataUrlToBlob(imageDataUrl) : undefined);
  }
  return backup.receipts.length;
}
