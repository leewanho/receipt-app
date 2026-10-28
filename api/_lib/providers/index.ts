import type { ReceiptJSON } from '../../../shared/receipt.js';
import { createClaudeProvider } from './claude.js';
import { createGeminiProvider } from './gemini.js';
import {
  ProviderError,
  RateLimitError,
  type OcrImage,
  type OcrProvider,
  type ProviderName,
} from './types.js';

export * from './types.js';

const FACTORIES: Record<ProviderName, (env: NodeJS.ProcessEnv) => OcrProvider> = {
  gemini: createGeminiProvider,
  claude: createClaudeProvider,
};

function isProviderName(v: string | undefined): v is ProviderName {
  return v === 'gemini' || v === 'claude';
}

/** OCR_PROVIDER(기본), OCR_FALLBACK_PROVIDER(보조)를 읽어 시도 순서대로 돌려준다 */
export function getProviderChain(env: NodeJS.ProcessEnv = process.env): OcrProvider[] {
  const primary = isProviderName(env.OCR_PROVIDER) ? env.OCR_PROVIDER : 'gemini';
  const fallback = isProviderName(env.OCR_FALLBACK_PROVIDER) ? env.OCR_FALLBACK_PROVIDER : null;
  const names = fallback && fallback !== primary ? [primary, fallback] : [primary];
  return names.map((n) => FACTORIES[n](env));
}

/** 한도 초과(RateLimitError)일 때만 다음 제공자로 넘어간다. 마지막까지 실패하면 마지막 오류를 던진다 */
export async function extractWithFallback(
  image: OcrImage,
  chain: OcrProvider[],
): Promise<ReceiptJSON> {
  let lastError: unknown = new ProviderError('no provider');
  for (const provider of chain) {
    try {
      return await provider.extractReceipt(image);
    } catch (e: unknown) {
      lastError = e;
      if (!(e instanceof RateLimitError)) throw e;
    }
  }
  throw lastError;
}
