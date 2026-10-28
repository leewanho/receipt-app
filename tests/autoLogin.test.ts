import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAutoLogin, extractPinFromHash } from '../src/lib/autoLogin';

describe('QR 주소에서 비밀번호 꺼내기', () => {
  it('#pin=4자리 숫자를 꺼낸다', () => {
    expect(extractPinFromHash('#pin=4821')).toBe('4821');
  });
  it('앞 0도 그대로', () => {
    expect(extractPinFromHash('#pin=0042')).toBe('0042');
  });
  it('다른 값과 같이 있어도 꺼낸다', () => {
    expect(extractPinFromHash('#a=1&pin=1234&b=2')).toBe('1234');
  });
  it('4자리 숫자가 아니면 무시한다', () => {
    for (const h of ['#pin=123', '#pin=12345', '#pin=abcd', '#pin=', '#pin=12 34', '#pin=１２３４']) {
      expect(extractPinFromHash(h)).toBeNull();
    }
  });
  it('pin이 없거나 비어 있으면 null', () => {
    expect(extractPinFromHash('')).toBeNull();
    expect(extractPinFromHash('#')).toBeNull();
    expect(extractPinFromHash('#section')).toBeNull();
  });
});

describe('자동 로그인 적용', () => {
  afterEach(() => vi.unstubAllGlobals());

  const fakeWindow = (hash: string) => {
    const win = {
      location: { hash, pathname: '/', search: '?x=1' },
      history: { replaceState: vi.fn() },
    };
    return win;
  };

  it('비밀번호를 저장하고 주소창에서 지운다', () => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
    const win = fakeWindow('#pin=4821');
    expect(applyAutoLogin(win as unknown as Window)).toBe(true);
    expect(store['receipt-pin']).toBe('4821');
    expect(win.history.replaceState).toHaveBeenCalledWith(null, '', '/?x=1');
  });

  it('pin이 없으면 아무것도 하지 않는다', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => null, setItem, removeItem: vi.fn() });
    const win = fakeWindow('');
    expect(applyAutoLogin(win as unknown as Window)).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(win.history.replaceState).not.toHaveBeenCalled();
  });
});
