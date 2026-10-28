import type { ReceiptJSON } from '../../shared/receipt';
import type { FieldKey, Receipt } from '../types';
import { newId } from './id';

/** 인식 결과를 확인 화면용 초안으로 바꾼다. 확신이 낮거나 비어 있는 칸은 노란 강조 대상으로 표시 */
export function toDraft(json: ReceiptJSON, id: string = newId()): Receipt {
  const low: FieldKey[] = [];
  const mark = (key: FieldKey, f: { value: unknown; confidence: string }): void => {
    if (f.value === null || f.confidence === 'low') low.push(key);
  };
  mark('date', json.date);
  mark('merchant', json.merchant);
  mark('total', json.total);
  mark('paymentMethod', json.payment_method);

  return {
    id,
    createdAt: Date.now(),
    date: json.date.value,
    merchant: json.merchant.value,
    total: json.total.value,
    paymentMethod: json.payment_method.value,
    cardCompany: json.card_company.value,
    businessNo: json.business_no.value,
    supplyAmount: json.supply_amount.value,
    vat: json.vat.value,
    items: json.items,
    memo: '',
    lowConfidence: low,
  };
}

/** 저장하려면 날짜(YYYY-MM-DD)와 금액이 있어야 한다 */
export function missingRequired(r: Receipt): ('date' | 'total')[] {
  const missing: ('date' | 'total')[] = [];
  if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) missing.push('date');
  if (r.total === null || !Number.isFinite(r.total)) missing.push('total');
  return missing;
}
