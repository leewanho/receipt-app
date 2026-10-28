import type { Receipt } from '../types';

export const formatWon = (n: number): string => `${n.toLocaleString('ko-KR')}원`;

/** 2025-03-07 → 3월 7일 */
export function formatDateKo(date: string | null): string {
  const m = date?.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : '날짜 없음';
}

/** 입력칸의 글자에서 숫자만 뽑는다 ("1,234원" → 1234, 빈 칸 → null) */
export function parseMoney(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? null : Number(digits);
}

export function monthTotal(receipts: readonly Receipt[], now = new Date()): number {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return receipts.reduce((sum, r) => (r.date?.startsWith(key) ? sum + (r.total ?? 0) : sum), 0);
}
