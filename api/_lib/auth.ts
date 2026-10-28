import { timingSafeEqual } from 'node:crypto';

/** 4자리 PIN 확인 (APP_PIN 환경변수와 비교). 나중에 시도 횟수 제한을 붙일 때도 이 파일만 고치면 된다 */
export function isPinValid(given: unknown, expected: string | undefined): boolean {
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
