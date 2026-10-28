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

/** 보조 제공자를 포함해 30초 안에 끝나도록 제공자마다 12초까지만 기다린다 */
export const PROVIDER_TIMEOUT_MS = 12_000;

/** 응답이 너무 늦으면 "잠시 후 다시"로 안내하고 보조 제공자로 넘어가도록 RateLimitError로 바꾼다 */
export async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) });
  } catch (e: unknown) {
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new RateLimitError('provider timeout');
    }
    throw e;
  }
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}
