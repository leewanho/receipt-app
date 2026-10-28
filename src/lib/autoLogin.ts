import { PIN_LENGTH } from '../config/limits';
import { storePin } from './ocrClient';

const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH}}$`);

/** QR 주소 뒤의 `#pin=1234` 에서 비밀번호를 꺼낸다. 4자리 숫자가 아니면 무시한다 */
export function extractPinFromHash(hash: string): string | null {
  const pin = new URLSearchParams(hash.replace(/^#/, '')).get('pin');
  return pin !== null && PIN_PATTERN.test(pin) ? pin : null;
}

/**
 * QR로 열었을 때 비밀번호 입력을 건너뛴다.
 * `#` 뒤의 내용은 서버로 전송되지 않으며, 저장한 뒤에는 주소창에서 지운다.
 */
export function applyAutoLogin(win: Window = window): boolean {
  const pin = extractPinFromHash(win.location.hash);
  if (!pin) return false;
  storePin(pin);
  win.history.replaceState(null, '', win.location.pathname + win.location.search);
  return true;
}
