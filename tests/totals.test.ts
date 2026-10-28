import { describe, expect, it } from 'vitest';
import { monthlyTotals, sumAll } from '../src/lib/totals';
import type { Receipt } from '../src/types';

const make = (date: string | null, total: number | null): Receipt => ({
  id: `${date}-${total}-${Math.random()}`, createdAt: 1, date, merchant: '가게', total, paymentMethod: 'card',
  cardCompany: null, businessNo: null, supplyAmount: null, vat: null, items: [], memo: '', lowConfidence: [],
});

describe('전체 합계', () => {
  it('모든 영수증 금액을 더한다 (금액 없는 건 0으로)', () => {
    expect(sumAll([make('2025-10-31', 7080), make('2026-02-08', 27000), make('2026-03-01', null)])).toBe(34080);
  });
  it('영수증이 없으면 0', () => {
    expect(sumAll([])).toBe(0);
  });
});

describe('월별 합계', () => {
  const list = [
    make('2025-09-30', 152000),
    make('2025-10-31', 7080),
    make('2025-10-02', 2945),
    make('2026-03-24', 27600),
    make('2025-09-01', 1000),
  ];

  it('월별로 묶어 최신 달이 위로, 합계와 장수를 낸다', () => {
    expect(monthlyTotals(list)).toEqual([
      { month: '2026-03', label: '2026년 3월', total: 27600, count: 1 },
      { month: '2025-10', label: '2025년 10월', total: 10025, count: 2 },
      { month: '2025-09', label: '2025년 9월', total: 153000, count: 2 },
    ]);
  });

  it('월별 합계를 모두 더하면 전체 합계와 같다', () => {
    const sum = monthlyTotals(list).reduce((s, m) => s + m.total, 0);
    expect(sum).toBe(sumAll(list));
  });

  it('날짜가 없는 영수증은 맨 아래 "날짜 없음"으로 묶는다', () => {
    const r = monthlyTotals([make('2025-10-01', 100), make(null, 500)]);
    expect(r[r.length - 1]).toEqual({ month: '', label: '날짜 없음', total: 500, count: 1 });
    expect(r.reduce((s, m) => s + m.total, 0)).toBe(600);
  });

  it('영수증이 없으면 빈 목록', () => {
    expect(monthlyTotals([])).toEqual([]);
  });
});
