import type { Receipt } from '../types';

/**
 * ★ 엑셀에 보여줄 항목은 이 파일에서만 바꾸면 됩니다.
 *   - 열을 빼려면 해당 줄을 지우고, 순서를 바꾸려면 줄 위치를 옮기세요.
 *   - type: 'money'는 천 단위 쉼표 숫자, 'date'는 날짜, 'text'는 글자
 */
export type CellValue = string | number | null;

export interface ColumnDef {
  header: string;
  value: (r: Receipt) => CellValue;
  type: 'text' | 'date' | 'money';
}

export interface SheetDef {
  name: string;
  columns: ColumnDef[];
  /** 월별 소계·총합계를 계산할 열의 머리글 */
  subtotalHeader: string;
}

const paymentLabel = (r: Receipt): string =>
  r.paymentMethod === 'card' ? '카드' : r.paymentMethod === 'cash' ? '현금' : '';

export const SUMMARY_SHEET: SheetDef = {
  name: '정리',
  subtotalHeader: '금액',
  columns: [
    { header: '날짜', value: (r) => r.date, type: 'date' },
    { header: '사용처', value: (r) => r.merchant, type: 'text' },
    { header: '금액', value: (r) => r.total, type: 'money' },
    { header: '결제수단', value: paymentLabel, type: 'text' },
    { header: '메모', value: (r) => r.memo, type: 'text' },
  ],
};

export const DETAIL_SHEET: SheetDef = {
  name: '상세',
  subtotalHeader: '합계금액',
  columns: [
    { header: '날짜', value: (r) => r.date, type: 'date' },
    { header: '상호', value: (r) => r.merchant, type: 'text' },
    { header: '합계금액', value: (r) => r.total, type: 'money' },
    { header: '결제수단', value: paymentLabel, type: 'text' },
    { header: '카드사', value: (r) => r.cardCompany, type: 'text' },
    { header: '사업자등록번호', value: (r) => r.businessNo, type: 'text' },
    { header: '공급가액', value: (r) => r.supplyAmount, type: 'money' },
    { header: '부가세', value: (r) => r.vat, type: 'money' },
    { header: '품목', value: (r) => r.items.map((i) => i.name).join(', '), type: 'text' },
    { header: '메모', value: (r) => r.memo, type: 'text' },
  ],
};

export const EXCEL_SHEETS: SheetDef[] = [SUMMARY_SHEET, DETAIL_SHEET];

export const FILE_PREFIX = '영수증정리';
