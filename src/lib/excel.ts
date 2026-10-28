import { EXCEL_SHEETS, type ColumnDef } from '../config/excelColumns';
import type { Receipt } from '../types';
import { buildFileName, buildSheetRows } from './excelRows';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MONEY_FORMAT = '#,##0';
const MIN_WIDTH = 8;
const MAX_WIDTH = 50;

/** 한글은 영문보다 두 배 넓게 계산해서 열 너비를 맞춘다 */
function textWidth(v: unknown): number {
  const s = typeof v === 'number' ? v.toLocaleString('ko-KR') : String(v ?? '');
  let w = 0;
  for (const ch of s) w += ch.charCodeAt(0) > 255 ? 2 : 1;
  return w;
}

const toExcelCell = (col: ColumnDef, v: string | number | null): string | number | Date | null => {
  if (v === null || v === '') return null;
  // "2025-03 소계", "총합계" 같은 글자는 날짜 열에 있어도 글자 그대로 둔다
  const m = col.type === 'date' && typeof v === 'string' ? v.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return v;
};

/** 엑셀(.xlsx) 파일을 만든다. 엑셀 라이브러리는 이 버튼을 눌렀을 때만 불러온다 */
export async function createWorkbookFile(receipts: readonly Receipt[]): Promise<File> {
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();

  for (const sheet of EXCEL_SHEETS) {
    const ws = wb.addWorksheet(sheet.name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(sheet.columns.map((c) => c.header)).font = { bold: true };

    const widths = sheet.columns.map((c) => textWidth(c.header));
    for (const row of buildSheetRows(sheet, receipts)) {
      const excelRow = ws.addRow(row.cells.map((v, i) => toExcelCell(sheet.columns[i], v)));
      if (row.kind !== 'data') excelRow.font = { bold: true };
      row.cells.forEach((v, i) => {
        widths[i] = Math.max(widths[i], textWidth(v));
      });
    }

    sheet.columns.forEach((col, i) => {
      const c = ws.getColumn(i + 1);
      c.width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, widths[i] + 2));
      if (col.type === 'money') c.numFmt = MONEY_FORMAT;
      if (col.type === 'date') c.numFmt = 'yyyy-mm-dd';
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new File([buffer], buildFileName(receipts), { type: XLSX_MIME });
}
