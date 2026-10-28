import { normalizeReceipt, type OcrErrorCode, type ReceiptJSON } from '../../shared/receipt';
import { PIN_STORAGE_KEY } from '../config/limits';
import { blobToBase64 } from './image';
import { describeProblem } from './problem';

export class OcrClientError extends Error {
  constructor(readonly code: OcrErrorCode | 'OFFLINE') {
    super(describeProblem(code, 1).message);
    this.name = 'OcrClientError';
  }
}

export const getStoredPin = (): string | null => {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const storePin = (pin: string): void => {
  try {
    localStorage.setItem(PIN_STORAGE_KEY, pin);
  } catch {
    /* 저장이 막힌 브라우저에서는 다음에 다시 입력하면 된다 */
  }
};

export const clearPin = (): void => {
  try {
    localStorage.removeItem(PIN_STORAGE_KEY);
  } catch {
    /* 무시 */
  }
};

const KNOWN_CODES: OcrErrorCode[] = ['BUSY', 'TIMEOUT', 'UNREADABLE', 'BAD_PIN', 'DAILY_LIMIT', 'BAD_IMAGE', 'SERVER'];

/** 압축된 사진 한 장을 서버로 보내 인식 결과를 받는다 */
export async function extractReceipt(image: Blob, pin: string): Promise<ReceiptJSON> {
  let res: Response;
  try {
    res = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-pin': pin },
      body: JSON.stringify({ image: await blobToBase64(image) }),
    });
  } catch {
    throw new OcrClientError('OFFLINE');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { code?: OcrErrorCode };
    throw new OcrClientError(body.code && KNOWN_CODES.includes(body.code) ? body.code : 'SERVER');
  }
  return normalizeReceipt(await res.json());
}
