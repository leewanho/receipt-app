import { describe, expect, it } from 'vitest';
import { DETAIL_SHEET, SUMMARY_SHEET } from '../src/config/excelColumns';
import { buildFileName, buildSheetRows, filterByPeriod, sortByDate } from '../src/lib/excelRows';
import type { Receipt } from '../src/types';

const make = (over: Partial<Receipt>): Receipt => ({
  id: Math.random().toString(36),
  createdAt: 1,
  date: '2025-03-01',
  merchant: '가게',
  total: 1000,
  paymentMethod: 'card',
  cardCompany: null,
  businessNo: null,
  supplyAmount: null,
  vat: null,
  items: [],
  memo: '',
  lowConfidence: [],
  ...over,
});

describe('엑셀 행 만들기', () => {
  it('날짜순으로 정렬하고 같은 달이면 소계 없이 데이터만', () => {
    const rows = buildSheetRows(SUMMARY_SHEET, [
      make({ date: '2025-03-20', total: 300 }),
      make({ date: '2025-03-05', total: 100 }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(['data', 'data']);
    expect(rows[0].cells[0]).toBe('2025-03-05');
  });

  it('여러 달이면 월별 소계와 총합계를 넣는다', () => {
    const rows = buildSheetRows(SUMMARY_SHEET, [
      make({ date: '2025-02-10', total: 100 }),
      make({ date: '2025-03-05', total: 200 }),
      make({ date: '2025-03-06', total: 300 }),
    ]);
    expect(rows.map((r) => r.kind)).toEqual(['data', 'subtotal', 'data', 'data', 'subtotal', 'total']);
    const moneyIdx = SUMMARY_SHEET.columns.findIndex((c) => c.header === '금액');
    expect(rows[1].cells[0]).toBe('2025-02 소계');
    expect(rows[1].cells[moneyIdx]).toBe(100);
    expect(rows[4].cells[moneyIdx]).toBe(500);
    expect(rows[5].cells[0]).toBe('총합계');
    expect(rows[5].cells[moneyIdx]).toBe(600);
  });

  it('상세 시트: 품목은 쉼표로 이어 한 칸에', () => {
    const rows = buildSheetRows(DETAIL_SHEET, [
      make({ items: [{ name: '우유', quantity: 1, amount: 1 }, { name: '빵', quantity: 1, amount: 1 }] }),
    ]);
    const idx = DETAIL_SHEET.columns.findIndex((c) => c.header === '품목');
    expect(rows[0].cells[idx]).toBe('우유, 빵');
  });

  it('결제수단은 한글로', () => {
    const rows = buildSheetRows(SUMMARY_SHEET, [make({ paymentMethod: 'cash' })]);
    expect(rows[0].cells[3]).toBe('현금');
  });

  it('날짜 없는 영수증은 맨 뒤', () => {
    const sorted = sortByDate([make({ date: null }), make({ date: '2025-01-01' })]);
    expect(sorted[0].date).toBe('2025-01-01');
  });
});

describe('기간·파일명', () => {
  const now = new Date(2025, 2, 15); // 2025-03-15
  const list = [
    make({ date: '2025-03-02' }),
    make({ date: '2025-02-28' }),
    make({ date: '2024-12-31' }),
  ];

  it('이번 달 / 지난달 / 전체', () => {
    expect(filterByPeriod(list, 'this-month', now)).toHaveLength(1);
    expect(filterByPeriod(list, 'last-month', now)).toHaveLength(1);
    expect(filterByPeriod(list, 'all', now)).toHaveLength(3);
  });

  it('1월에 "지난달"은 작년 12월', () => {
    const jan = new Date(2025, 0, 10);
    expect(filterByPeriod(list, 'last-month', jan).map((r) => r.date)).toEqual(['2024-12-31']);
  });

  it('파일명: 한 달 / 여러 달', () => {
    expect(buildFileName([make({ date: '2025-03-02' })])).toBe('영수증정리_2025-03.xlsx');
    expect(buildFileName(list)).toBe('영수증정리_2024-12~2025-03.xlsx');
  });
});
