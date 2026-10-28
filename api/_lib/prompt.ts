export const SYSTEM_PROMPT = `너는 한국 영수증을 읽는 도우미다. 사진 한 장을 보고 아래 규칙대로만 JSON으로 답한다.

규칙:
- 영수증·카드전표·간이영수증·거래명세서가 아니면 is_receipt를 false로 하고 나머지는 모두 value를 null로 둔다.
- 읽을 수 없거나 확실하지 않은 값은 추측하지 말고 value를 null로 둔다.
- 각 필드에는 confidence를 붙인다. 글자가 선명하고 확실하면 "high", 흐리거나 짐작이 섞였으면 "low".
- date: YYYY-MM-DD. 연도가 두 자리면 20xx로 해석한다.
- 금액은 모두 원 단위 정수(쉼표·"원" 없이).
- total(합계금액)은 손님이 실제로 낸 최종 결제금액이다. 할인·포인트 차감 후 "받을금액/결제금액/승인금액" 기준. 카드전표와 간이영수증이 한 장에 섞여 있어도 최종 결제금액 하나만 쓴다.
- payment_method: 카드면 "card", 현금(현금영수증 포함)이면 "cash".
- card_company: 카드사 이름(예: 신한카드). 현금이면 null.
- business_no: 사업자등록번호 000-00-00000 형식.
- supply_amount(공급가액), vat(부가세): 영수증에 적혀 있을 때만.
- items: 품목명, 수량, 금액. 품목이 너무 많으면 앞의 30개까지만.
- merchant: 상호(가게 이름). 지점명이 있으면 함께 적는다.`;

export const USER_PROMPT = '이 영수증을 읽어서 JSON으로 알려줘.';

type Flavor = 'gemini' | 'claude';

/** 값이 null일 수 있는 {value, confidence} 필드 스키마 */
function field(type: 'string' | 'number', flavor: Flavor, enumValues?: string[]) {
  const valueSchema =
    flavor === 'gemini'
      ? { type, nullable: true, ...(enumValues ? { enum: enumValues } : {}) }
      : { type: [type, 'null'], ...(enumValues ? { enum: [...enumValues, null] } : {}) };
  return {
    type: 'object',
    properties: {
      value: valueSchema,
      confidence: { type: 'string', enum: ['high', 'low'] },
    },
    required: ['value', 'confidence'],
  };
}

/** Gemini(responseSchema)와 Claude(tool input_schema)가 같은 구조를 쓰도록 만든다 */
export function buildSchema(flavor: Flavor) {
  const nullableNumber =
    flavor === 'gemini' ? { type: 'number', nullable: true } : { type: ['number', 'null'] };
  return {
    type: 'object',
    properties: {
      is_receipt: { type: 'boolean' },
      date: field('string', flavor),
      merchant: field('string', flavor),
      total: field('number', flavor),
      payment_method: field('string', flavor, ['card', 'cash']),
      card_company: field('string', flavor),
      business_no: field('string', flavor),
      supply_amount: field('number', flavor),
      vat: field('number', flavor),
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, quantity: nullableNumber, amount: nullableNumber },
          required: ['name', 'quantity', 'amount'],
        },
      },
    },
    required: [
      'is_receipt',
      'date',
      'merchant',
      'total',
      'payment_method',
      'card_company',
      'business_no',
      'supply_amount',
      'vat',
      'items',
    ],
  };
}
