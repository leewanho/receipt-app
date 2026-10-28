/**
 * 영수증 고유 번호를 만든다.
 * crypto.randomUUID 는 https(보안 연결)에서만 있어서, 테스트용 http 주소에서도 되도록 대체 방법을 둔다.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
