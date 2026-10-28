import { describe, expect, it, vi } from 'vitest';
import { isPinValid } from '../api/_lib/auth';
import { extractWithFallback, getProviderChain } from '../api/_lib/providers';
import { ProviderError, RateLimitError, type OcrProvider } from '../api/_lib/providers/types';
import { checkDailyLimit, todayKey, type DailyCounter } from '../api/_lib/rateLimit';
import { emptyReceiptJSON } from '../shared/receipt';
import { findDuplicate } from '../src/lib/dedupe';
import { missingRequired, toDraft } from '../src/lib/draft';
import { formatDateKo, parseMoney } from '../src/lib/format';
import { fitSize } from '../src/lib/image';
import type { Receipt } from '../src/types';

const base: Receipt = {
  id: 'a', createdAt: 1, date: '2025-03-01', merchant: '스타벅스 강남', total: 5500, paymentMethod: 'card',
  cardCompany: null, businessNo: null, supplyAmount: null, vat: null, items: [], memo: '', lowConfidence: [],
};

describe('중복 영수증', () => {
  it('날짜+금액+상호가 같으면 중복(공백·대소문자 무시)', () => {
    expect(findDuplicate([base], { ...base, id: 'b', merchant: '스타벅스강남' })).toBeDefined();
  });
  it('하나라도 다르면 중복 아님, 자기 자신도 제외', () => {
    expect(findDuplicate([base], { ...base, id: 'b', total: 5600 })).toBeUndefined();
    expect(findDuplicate([base], base)).toBeUndefined();
  });
});

describe('확인 화면 초안', () => {
  it('확신 낮음·비어있음은 노란 강조 대상', () => {
    const j = emptyReceiptJSON();
    j.date = { value: '2025-03-01', confidence: 'high' };
    j.total = { value: 100, confidence: 'low' };
    const d = toDraft(j, 'x');
    expect(d.lowConfidence).toContain('total');
    expect(d.lowConfidence).toContain('merchant');
    expect(d.lowConfidence).not.toContain('date');
    expect(d.memo).toBe('');
  });
  it('날짜·금액이 없으면 저장 불가, 메모는 필수 아님', () => {
    expect(missingRequired({ ...base, date: null, total: null })).toEqual(['date', 'total']);
    expect(missingRequired(base)).toEqual([]);
  });
});

describe('표시 형식', () => {
  it('금액 입력 정리', () => {
    expect(parseMoney('1,234원')).toBe(1234);
    expect(parseMoney('')).toBeNull();
  });
  it('날짜 한글 표기', () => {
    expect(formatDateKo('2025-03-07')).toBe('3월 7일');
    expect(formatDateKo(null)).toBe('날짜 없음');
  });
});

describe('사진 줄이기 계산', () => {
  it('긴 변을 1600px로 맞춘다', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
  it('작은 사진은 그대로', () => {
    expect(fitSize(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('PIN', () => {
  it('맞는 PIN만 통과', () => {
    expect(isPinValid('1234', '1234')).toBe(true);
    expect(isPinValid('1235', '1234')).toBe(false);
    expect(isPinValid(undefined, '1234')).toBe(false);
    expect(isPinValid('1234', undefined)).toBe(false);
  });
});

describe('하루 호출 제한', () => {
  const counter = (): DailyCounter => {
    let n = 0;
    return { increment: async () => ++n };
  };
  it('한도까지는 허용, 넘으면 거절', async () => {
    const c = counter();
    const env = { DAILY_LIMIT: '2' } as NodeJS.ProcessEnv;
    expect(await checkDailyLimit(env, c)).toBe(true);
    expect(await checkDailyLimit(env, c)).toBe(true);
    expect(await checkDailyLimit(env, c)).toBe(false);
  });
  it('한국 시간 기준 날짜 (UTC 15시 = 한국 다음날 0시)', () => {
    expect(todayKey(new Date('2025-03-07T15:00:00Z'))).toBe('2025-03-08');
    expect(todayKey(new Date('2025-03-07T14:59:00Z'))).toBe('2025-03-07');
  });
});

describe('OCR 제공자 전환·재시도', () => {
  const ok = (name: 'gemini' | 'claude'): OcrProvider => ({ name, extractReceipt: async () => emptyReceiptJSON() });
  const failing = (e: Error): OcrProvider => ({ name: 'gemini', extractReceipt: async () => { throw e; } });
  const img = { base64: 'x', mime: 'image/jpeg' as const };

  it('한도 초과(429)면 보조 제공자로 자동 재시도', async () => {
    const claude = ok('claude');
    const spy = vi.spyOn(claude, 'extractReceipt');
    await extractWithFallback(img, [failing(new RateLimitError()), claude]);
    expect(spy).toHaveBeenCalledOnce();
  });
  it('보조가 없으면 RateLimitError를 그대로 던진다 ("잠시 후 다시" 안내용)', async () => {
    await expect(extractWithFallback(img, [failing(new RateLimitError())])).rejects.toBeInstanceOf(RateLimitError);
  });
  it('429가 아닌 오류는 보조로 넘기지 않는다', async () => {
    const claude = ok('claude');
    const spy = vi.spyOn(claude, 'extractReceipt');
    await expect(extractWithFallback(img, [failing(new ProviderError('x')), claude])).rejects.toBeInstanceOf(ProviderError);
    expect(spy).not.toHaveBeenCalled();
  });
  it('OCR_PROVIDER 환경변수로 제공자 선택, 같은 제공자 중복 제거', () => {
    const env = { OCR_PROVIDER: 'claude', OCR_FALLBACK_PROVIDER: 'gemini', ANTHROPIC_API_KEY: 'k', GEMINI_API_KEY: 'k' } as NodeJS.ProcessEnv;
    expect(getProviderChain(env).map((p) => p.name)).toEqual(['claude', 'gemini']);
    expect(getProviderChain({ ...env, OCR_FALLBACK_PROVIDER: 'claude' }).map((p) => p.name)).toEqual(['claude']);
  });
  it('API 키가 없으면 분명한 오류', () => {
    expect(() => getProviderChain({ OCR_PROVIDER: 'gemini' } as NodeJS.ProcessEnv)).toThrow('GEMINI_API_KEY');
  });
});

describe('Gemini 응답 해석 (가짜 서버)', () => {
  it('JSON 응답을 정리해서 돌려주고, 429는 RateLimitError', async () => {
    const { createGeminiProvider } = await import('../api/_lib/providers/gemini');
    const env = { GEMINI_API_KEY: 'k' } as NodeJS.ProcessEnv;
    const body = { is_receipt: true, total: { value: '1,000', confidence: 'high' } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] })))
      .mockResolvedValueOnce(new Response('{}', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const p = createGeminiProvider(env);
    const img = { base64: 'x', mime: 'image/jpeg' as const };
    expect((await p.extractReceipt(img)).total.value).toBe(1000);
    await expect(p.extractReceipt(img)).rejects.toBeInstanceOf(RateLimitError);
    // API 키가 주소(URL)에 노출되지 않고 헤더로만 가는지
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('key=');
    vi.unstubAllGlobals();
  });
});

describe('Upstash 연결 정보 찾기', () => {
  it('접두어가 달라도(KV_, STORAGE_ …) 찾는다', async () => {
    const { findRedisCredentials } = await import('../api/_lib/rateLimit');
    expect(findRedisCredentials({ KV_REST_API_URL: 'u', KV_REST_API_TOKEN: 't' } as NodeJS.ProcessEnv)).toEqual({ url: 'u', token: 't' });
    expect(findRedisCredentials({ STORAGE_REST_API_URL: 'u2', STORAGE_REST_API_TOKEN: 't2' } as NodeJS.ProcessEnv)).toEqual({ url: 'u2', token: 't2' });
    expect(findRedisCredentials({ UPSTASH_REDIS_REST_URL: 'u3', UPSTASH_REDIS_REST_TOKEN: 't3' } as NodeJS.ProcessEnv)).toEqual({ url: 'u3', token: 't3' });
  });
  it('없으면 비어 있음', async () => {
    const { findRedisCredentials } = await import('../api/_lib/rateLimit');
    expect(findRedisCredentials({} as NodeJS.ProcessEnv)).toEqual({ url: undefined, token: undefined });
  });
});

describe('목록 날짜 표시(연도 포함)', () => {
  it('연도까지 보여준다', async () => {
    const { formatDateFull } = await import('../src/lib/format');
    expect(formatDateFull('2025-10-31')).toBe('2025년 10월 31일');
    expect(formatDateFull(null)).toBe('날짜 없음');
  });
});
