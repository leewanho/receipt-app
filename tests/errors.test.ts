import { describe, expect, it } from 'vitest';
import { errorCodeFor } from '../api/_lib/errors';
import { ProviderError, RateLimitError, TimeoutError, UnreadableError } from '../api/_lib/providers/types';
import { describeProblem } from '../src/lib/problem';

describe('서버 오류 → 화면에 보낼 종류', () => {
  it('시간 초과는 TIMEOUT (한도 초과와 구분)', () => {
    expect(errorCodeFor(new TimeoutError('t'))).toBe('TIMEOUT');
  });
  it('한도 초과는 BUSY', () => {
    expect(errorCodeFor(new RateLimitError('429'))).toBe('BUSY');
  });
  it('AI가 결과를 못 만든 경우는 UNREADABLE', () => {
    expect(errorCodeFor(new UnreadableError('invalid json'))).toBe('UNREADABLE');
  });
  it('그 밖의 오류는 SERVER', () => {
    expect(errorCodeFor(new ProviderError('500'))).toBe('SERVER');
    expect(errorCodeFor(new Error('x'))).toBe('SERVER');
    expect(errorCodeFor('weird')).toBe('SERVER');
  });
  it('시간 초과도 한도 초과의 한 종류라 보조 제공자로 넘어갈 수 있다', () => {
    expect(new TimeoutError('t')).toBeInstanceOf(RateLimitError);
  });
});

describe('실패 안내 문구', () => {
  it('읽을 수 없는 사진은 다시 해도 소용없다고 분명히 알리고 다시 읽기를 숨긴다', () => {
    const p = describeProblem('UNREADABLE', 1);
    expect(p.canRetry).toBe(false);
    expect(p.message).toContain('읽을 수 없어요');
  });
  it('영수증이 아닌 사진도 다시 읽기를 숨긴다', () => {
    const p = describeProblem('NOT_RECEIPT', 1);
    expect(p.canRetry).toBe(false);
    expect(p.message).toContain('영수증이 아닌');
  });
  it('시간 초과·한도·서버 문제는 처음에는 다시 읽기를 허용한다', () => {
    for (const k of ['TIMEOUT', 'BUSY', 'SERVER'] as const) {
      expect(describeProblem(k, 1).canRetry).toBe(true);
    }
  });
  it('두 번 실패하면 다시 읽기를 숨기고 직접 적기를 안내한다', () => {
    for (const k of ['TIMEOUT', 'BUSY', 'SERVER'] as const) {
      const p = describeProblem(k, 2);
      expect(p.canRetry).toBe(false);
      expect(p.message).toContain('직접');
    }
  });
  it('인터넷이 없을 때는 횟수와 관계없이 다시 읽기 가능', () => {
    expect(describeProblem('OFFLINE', 5).canRetry).toBe(true);
  });
  it('하루 한도는 오늘은 소용없으니 다시 읽기를 숨긴다', () => {
    const p = describeProblem('DAILY_LIMIT', 1);
    expect(p.canRetry).toBe(false);
    expect(p.message).toContain('내일');
  });
  it('모든 경우에 안내 문구가 비어 있지 않다', () => {
    for (const k of ['TIMEOUT', 'BUSY', 'SERVER', 'UNREADABLE', 'NOT_RECEIPT', 'OFFLINE', 'DAILY_LIMIT', 'BAD_IMAGE', 'BAD_PIN'] as const) {
      expect(describeProblem(k, 1).message.length).toBeGreaterThan(5);
    }
  });
});
