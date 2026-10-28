import type { ReceiptJSON } from '../../../shared/receipt.js';

export interface OcrImage {
  base64: string;
  mime: 'image/jpeg';
}

export type ProviderName = 'gemini' | 'claude';

export interface OcrProvider {
  name: ProviderName;
  extractReceipt(image: OcrImage): Promise<ReceiptJSON>;
}

/** 무료 한도 초과·과부하(429/529) — 보조 제공자로 넘어가거나 "잠시 후 다시"로 안내 */
export class RateLimitError extends Error {
  constructor(message = 'rate limited') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** 응답이 너무 늦음. 보조 제공자로 넘어갈 수 있도록 RateLimitError의 한 종류로 둔다 */
export class TimeoutError extends RateLimitError {
  constructor(message = 'provider timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** 보조 제공자를 포함해 vercel.json의 최대 실행 시간(60초) 안에 끝나도록 제공자마다 25초까지만 기다린다 */
export const PROVIDER_TIMEOUT_MS = 25_000;

export async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (e: unknown) {
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new TimeoutError();
    }
    throw e;
  }
}

/** AI가 사진에서 쓸 수 있는 결과를 만들지 못함 (같은 사진은 다시 해도 소용없을 가능성이 큼) */
export class UnreadableError extends Error {
  constructor(message = 'unreadable') {
    super(message);
    this.name = 'UnreadableError';
  }
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}
