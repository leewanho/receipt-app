import { normalizeReceipt, type OcrErrorCode, type ReceiptJSON } from '../../shared/receipt';
import { PIN_STORAGE_KEY } from '../config/limits';
import { blobToBase64 } from './image';

/** 오류는 원인이 아니라 "할 일"로 안내한다 */
export const OCR_ERROR_MESSAGES: Record<OcrErrorCode | 'OFFLINE', string> = {
  BUSY: '지금 사람이 많아요. 잠시 후 다시 눌러주세요.',
  DAILY_LIMIT: '오늘은 여기까지예요. 내일 다시 눌러주세요.',
  BAD_PIN: '비밀번호가 맞지 않아요. 다시 입력해 주세요.',
  BAD_IMAGE: '사진을 읽지 못했어요. 다시 찍어주세요.',
  SERVER: '잠시 문제가 생겼어요. 조금 뒤에 다시 눌러주세요.',
  OFFLINE: '인터넷 연결을 확인하고 다시 눌러주세요.',
};

export class OcrClientError extends Error {
  constructor(readonly code: OcrErrorCode | 'OFFLINE') {
    super(OCR_ERROR_MESSAGES[code]);
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

const KNOWN_CODES: OcrErrorCode[] = ['BUSY', 'BAD_PIN', 'DAILY_LIMIT', 'BAD_IMAGE', 'SERVER'];

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
