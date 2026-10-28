import type { OcrErrorCode } from '../../shared/receipt.js';
import { RateLimitError, TimeoutError, UnreadableError } from './providers/types.js';

/** 서버에서 난 오류를 화면에 보낼 종류로 바꾼다 (시간 초과는 한도 초과보다 먼저 구분) */
export function errorCodeFor(e: unknown): OcrErrorCode {
  if (e instanceof TimeoutError) return 'TIMEOUT';
  if (e instanceof RateLimitError) return 'BUSY';
  if (e instanceof UnreadableError) return 'UNREADABLE';
  return 'SERVER';
}
