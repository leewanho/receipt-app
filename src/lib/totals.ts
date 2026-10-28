import type { Receipt } from '../types';

export interface MonthTotal {
  /** YYYY-MM (날짜가 없는 영수증은 빈 글자) */
  month: string;
  label: string;
  total: number;
  count: number;
}

const NO_DATE_LABEL = '날짜 없음';

/** 저장한 모든 영수증의 금액 합계 */
export function sumAll(receipts: readonly Receipt[]): number {
  return receipts.reduce((sum, r) => sum + (r.total ?? 0), 0);
}

const labelOf = (month: string): string => {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[1]}년 ${Number(m[2])}월` : NO_DATE_LABEL;
};

/** 월별 합계와 장수. 최신 달이 위, 날짜 없는 영수증은 맨 아래 */
export function monthlyTotals(receipts: readonly Receipt[]): MonthTotal[] {
  const byMonth = new Map<string, { total: number; count: number }>();
  for (const r of receipts) {
    const month = r.date?.slice(0, 7) ?? '';
    const prev = byMonth.get(month) ?? { total: 0, count: 0 };
    byMonth.set(month, { total: prev.total + (r.total ?? 0), count: prev.count + 1 });
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a < b ? 1 : -1))
    .map(([month, v]) => ({ month, label: labelOf(month), ...v }));
}
