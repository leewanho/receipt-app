import { describe, expect, it } from 'vitest';
import { normalizeReceipt } from '../shared/receipt';

const f = (value: unknown, confidence: 'high' | 'low' = 'high') => ({ value, confidence });

/** 한국 영수증 유형별로 AI가 돌려줄 법한 응답(일부러 흐트러진 형태 포함)을 정리하는 규칙을 확인한다 */
describe('normalizeReceipt — 영수증 유형별', () => {
  it('카드 매출전표: 카드사·사업자번호·부가세까지 정리', () => {
    const r = normalizeReceipt({
      is_receipt: true,
      date: f('2025.03.07 12:31'),
      merchant: f(' 스타벅스 강남점 '),
      total: f('5,500원'),
      payment_method: f('card'),
      card_company: f('신한카드'),
      business_no: f('201-81-21515'),
      supply_amount: f(5000),
      vat: f(500),
      items: [{ name: '아메리카노', quantity: 1, amount: 5500 }],
    });
    expect(r.date.value).toBe('2025-03-07');
    expect(r.merchant.value).toBe('스타벅스 강남점');
    expect(r.total.value).toBe(5500);
    expect(r.payment_method.value).toBe('card');
    expect(r.vat.value).toBe(500);
    expect(r.items).toHaveLength(1);
  });

  it('마트: 품목 여러 개, 수량 없음', () => {
    const r = normalizeReceipt({
      is_receipt: true,
      date: f('2025-03-09'),
      merchant: f('이마트 성수점'),
      total: f(48230),
      payment_method: f('card'),
      items: [
        { name: '우유 1L', quantity: 2, amount: 5600 },
        { name: '두부', quantity: null, amount: 2480 },
        { name: '', quantity: 1, amount: 100 },
      ],
    });
    expect(r.items.map((i) => i.name)).toEqual(['우유 1L', '두부']);
    expect(r.card_company.value).toBeNull();
  });

  it('식당 현금영수증: 결제수단 cash, 카드사 없음', () => {
    const r = normalizeReceipt({
      date: f('2025/3/2'),
      merchant: f('할매국밥'),
      total: f(18000),
      payment_method: f('cash'),
      card_company: f(null),
    });
    expect(r.date.value).toBe('2025-03-02');
    expect(r.payment_method.value).toBe('cash');
  });

  it('주유소: 큰 금액(쉼표 문자열)도 정수로', () => {
    const r = normalizeReceipt({ total: f('72,310'), date: f('2025-03-15'), merchant: f('GS칼텍스 한강주유소') });
    expect(r.total.value).toBe(72310);
  });

  it('간이영수증(손글씨): 낮은 확신도는 유지, 읽지 못한 값은 null', () => {
    const r = normalizeReceipt({
      date: f('2025-03-21', 'low'),
      merchant: f(null),
      total: f(35000, 'low'),
      payment_method: f(null),
    });
    expect(r.date.confidence).toBe('low');
    expect(r.merchant.value).toBeNull();
    expect(r.merchant.confidence).toBe('low');
    expect(r.total.value).toBe(35000);
  });

  it('구겨지거나 흐린 사진: 이상한 값은 null로 버린다', () => {
    const r = normalizeReceipt({
      date: f('2025-13-45'),
      total: f('알수없음'),
      payment_method: f('bitcoin'),
      items: 'oops',
    });
    expect(r.date.value).toBeNull();
    expect(r.total.value).toBeNull();
    expect(r.payment_method.value).toBeNull();
    expect(r.items).toEqual([]);
  });

  it('영수증이 아닌 사진: is_receipt false', () => {
    expect(normalizeReceipt({ is_receipt: false }).is_receipt).toBe(false);
  });

  it('완전히 이상한 응답도 터지지 않는다', () => {
    expect(() => normalizeReceipt(null)).not.toThrow();
    expect(() => normalizeReceipt('hello')).not.toThrow();
  });
});
