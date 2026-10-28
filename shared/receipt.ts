export type Conf = 'high' | 'low';
export type Field<T> = { value: T | null; confidence: Conf };
export type PaymentMethod = 'card' | 'cash';

export interface ReceiptItem {
  name: string;
  quantity: number | null;
  amount: number | null;
}

/** AI가 돌려주는 영수증 인식 결과 (서버 ↔ 화면 공통) */
export interface ReceiptJSON {
  is_receipt: boolean;
  date: Field<string>;
  merchant: Field<string>;
  total: Field<number>;
  payment_method: Field<PaymentMethod>;
  card_company: Field<string>;
  business_no: Field<string>;
  supply_amount: Field<number>;
  vat: Field<number>;
  items: ReceiptItem[];
}

export type OcrErrorCode =
  | 'BUSY'
  | 'TIMEOUT'
  | 'UNREADABLE'
  | 'BAD_PIN'
  | 'DAILY_LIMIT'
  | 'BAD_IMAGE'
  | 'SERVER';

export interface OcrErrorBody {
  code: OcrErrorCode;
}

const emptyField = <T>(): Field<T> => ({ value: null, confidence: 'low' });

export const emptyReceiptJSON = (): ReceiptJSON => ({
  is_receipt: true,
  date: emptyField(),
  merchant: emptyField(),
  total: emptyField(),
  payment_method: emptyField(),
  card_company: emptyField(),
  business_no: emptyField(),
  supply_amount: emptyField(),
  vat: emptyField(),
  items: [],
});

const asConf = (v: unknown): Conf => (v === 'high' ? 'high' : 'low');

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;

const asNumber = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(/[,원\s]/g, '')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : null;
};

const asDate = (v: unknown): string | null => {
  const s = asString(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const asPayment = (v: unknown): PaymentMethod | null =>
  v === 'card' || v === 'cash' ? v : null;

const normField = <T>(raw: unknown, conv: (v: unknown) => T | null): Field<T> => {
  const r = (raw ?? {}) as { value?: unknown; confidence?: unknown };
  const value = conv(r.value);
  return { value, confidence: value === null ? 'low' : asConf(r.confidence) };
};

/** AI 응답이 약간 틀려도 안전한 형태로 정리한다 (날짜·금액 정규화 포함) */
export function normalizeReceipt(raw: unknown): ReceiptJSON {
  const r = (raw ?? {}) as Record<string, unknown>;
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    is_receipt: r.is_receipt !== false,
    date: normField(r.date, asDate),
    merchant: normField(r.merchant, asString),
    total: normField(r.total, asNumber),
    payment_method: normField(r.payment_method, asPayment),
    card_company: normField(r.card_company, asString),
    business_no: normField(r.business_no, asString),
    supply_amount: normField(r.supply_amount, asNumber),
    vat: normField(r.vat, asNumber),
    items: items
      .map((i) => {
        const it = (i ?? {}) as Record<string, unknown>;
        return { name: asString(it.name) ?? '', quantity: asNumber(it.quantity), amount: asNumber(it.amount) };
      })
      .filter((i) => i.name !== ''),
  };
}
