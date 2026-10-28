import { describe, expect, it } from 'vitest';
import { createWorkbookFile } from '../src/lib/excel';
import type { Receipt } from '../src/types';

const make = (date: string, total: number, memo = ''): Receipt => ({
  id: date, createdAt: 1, date, merchant: '한글가게', total, paymentMethod: 'card', cardCompany: '신한카드',
  businessNo: '123-45-67890', supplyAmount: 909, vat: 91, items: [{ name: '우유', quantity: 1, amount: total }],
  memo, lowConfidence: [],
});

describe('실제 .xlsx 파일 만들기', () => {
  it('두 시트·머리글 고정·쉼표 서식·총합계', async () => {
    const file = await createWorkbookFile([make('2025-02-10', 1500), make('2025-03-05', 2500, '회의')]);
    expect(file.name).toBe('영수증정리_2025-02~2025-03.xlsx');

    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['정리', '상세']);

    const ws = wb.getWorksheet('정리')!;
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ws.getRow(1).values).toEqual([undefined, '날짜', '사용처', '금액', '결제수단', '메모']);
    expect(ws.getColumn(3).numFmt).toBe('#,##0');
    const last = ws.lastRow!;
    expect(last.getCell(1).value).toBe('총합계');
    expect(last.getCell(3).value).toBe(4000);
    expect(ws.getColumn(2).width).toBeGreaterThan(8);
  });
});
