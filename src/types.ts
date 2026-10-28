import type { PaymentMethod, ReceiptItem } from '../shared/receipt';

export type { PaymentMethod, ReceiptItem };

/** 확인 화면에서 확신도가 낮다고 표시할 수 있는 칸 */
export type FieldKey = 'date' | 'merchant' | 'total' | 'paymentMethod';

export interface Receipt {
  id: string;
  createdAt: number;
  date: string | null; // YYYY-MM-DD
  merchant: string | null;
  total: number | null; // 원 단위 정수
  paymentMethod: PaymentMethod | null;
  cardCompany: string | null;
  businessNo: string | null;
  supplyAmount: number | null;
  vat: number | null;
  items: ReceiptItem[];
  memo: string;
  lowConfidence: FieldKey[];
}

/** 날짜·금액이 채워진, 저장 가능한 영수증 */
export type SavedReceipt = Receipt & { date: string; total: number };
