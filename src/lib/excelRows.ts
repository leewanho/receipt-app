import type { CellValue, SheetDef } from '../config/excelColumns';
import { FILE_PREFIX } from '../config/excelColumns';
import type { Receipt } from '../types';

export type Period = 'this-month' | 'last-month' | 'all';

export interface SheetRow {
  kind: 'data' | 'subtotal' | 'total';
  cells: CellValue[];
}

const monthOf = (date: string | null): string => (date ?? '').slice(0, 7);

const toMonthKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function filterByPeriod(receipts: readonly Receipt[], period: Period, now = new Date()): Receipt[] {
  if (period === 'all') return [...receipts];
  const target =
    period === 'this-month'
      ? toMonthKey(now)
      : toMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  return receipts.filter((r) => monthOf(r.date) === target);
}

/** 날짜 오름차순(날짜 없는 건 맨 뒤), 같은 날은 입력 순서 */
export function sortByDate(receipts: readonly Receipt[]): Receipt[] {
  return [...receipts].sort((a, b) => {
    if (a.date === b.date) return a.createdAt - b.createdAt;
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date < b.date ? -1 : 1;
  });
}

const sum = (rows: readonly SheetRow[], idx: number): number =>
  rows.reduce((acc, r) => acc + (typeof r.cells[idx] === 'number' ? (r.cells[idx] as number) : 0), 0);

/** 한 시트에 들어갈 행을 만든다. 기간이 여러 달이면 월별 소계 + 맨 아래 총합계를 넣는다 */
export function buildSheetRows(sheet: SheetDef, receipts: readonly Receipt[]): SheetRow[] {
  const sorted = sortByDate(receipts);
  const data: { month: string; row: SheetRow }[] = sorted.map((r) => ({
    month: monthOf(r.date),
    row: { kind: 'data', cells: sheet.columns.map((c) => c.value(r)) },
  }));

  const months = [...new Set(data.map((d) => d.month))];
  if (months.length <= 1) return data.map((d) => d.row);

  const sumIdx = sheet.columns.findIndex((c) => c.header === sheet.subtotalHeader);
  const blank = (): CellValue[] => sheet.columns.map(() => null);
  const out: SheetRow[] = [];

  for (const month of months) {
    const group = data.filter((d) => d.month === month).map((d) => d.row);
    out.push(...group);
    const cells = blank();
    cells[0] = `${month || '날짜 없음'} 소계`;
    if (sumIdx >= 0) cells[sumIdx] = sum(group, sumIdx);
    out.push({ kind: 'subtotal', cells });
  }

  const totalCells = blank();
  totalCells[0] = '총합계';
  if (sumIdx >= 0) totalCells[sumIdx] = sum(data.map((d) => d.row), sumIdx);
  out.push({ kind: 'total', cells: totalCells });
  return out;
}

/** 영수증정리_YYYY-MM.xlsx, 여러 달이면 영수증정리_YYYY-MM~YYYY-MM.xlsx */
export function buildFileName(receipts: readonly Receipt[], now = new Date()): string {
  const months = receipts.map((r) => monthOf(r.date)).filter((m) => m !== '').sort();
  if (months.length === 0) return `${FILE_PREFIX}_${toMonthKey(now)}.xlsx`;
  const first = months[0];
  const last = months[months.length - 1];
  return first === last ? `${FILE_PREFIX}_${first}.xlsx` : `${FILE_PREFIX}_${first}~${last}.xlsx`;
}
