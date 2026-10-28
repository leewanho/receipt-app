import { afterEach, describe, expect, it, vi } from 'vitest';
import { newId } from '../src/lib/id';

describe('영수증 번호 만들기', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('https가 아닌 주소(randomUUID 없음)에서도 만들어진다', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(171) });
    expect(newId()).toBe('ab'.repeat(16));
  });

  it('보통은 서로 다른 번호', () => {
    expect(newId()).not.toBe(newId());
  });
});
