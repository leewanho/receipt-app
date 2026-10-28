import type { OcrErrorCode } from '../../shared/receipt';

export type ProblemKind = OcrErrorCode | 'OFFLINE' | 'NOT_RECEIPT';

export interface ProblemView {
  message: string;
  /** "다시 읽기" 버튼을 보여줄지. 같은 사진으로 다시 해도 소용없으면 숨긴다 */
  canRetry: boolean;
}

/** 같은 사진을 이만큼 실패하면 더는 다시 읽기를 권하지 않는다 */
export const MAX_RETRIES = 2;

const RETRY_MESSAGES = {
  TIMEOUT: '읽는 데 너무 오래 걸렸어요. 한 번 더 눌러보세요.',
  BUSY: '지금 사람이 많아요. 잠시 후 다시 눌러주세요.',
  SERVER: '잠시 문제가 생겼어요. 한 번 더 눌러보세요.',
} as const;

/**
 * 읽기에 실패했을 때 안내할 말. 오류는 원인이 아니라 할 일로 알려준다.
 * 다시 해도 소용없는 경우에는 그렇다고 분명히 알려서 계속 누르지 않게 한다.
 */
export function describeProblem(kind: ProblemKind, failedCount: number): ProblemView {
  switch (kind) {
    case 'OFFLINE':
      return { message: '인터넷 연결을 확인하고 다시 눌러주세요.', canRetry: true };
    case 'NOT_RECEIPT':
      return {
        message: '영수증이 아닌 것 같아요. 다른 사진을 골라주세요. 영수증이 맞다면 직접 적어 넣을 수 있어요.',
        canRetry: false,
      };
    case 'UNREADABLE':
      return {
        message: '이 사진은 읽을 수 없어요. 같은 사진은 다시 눌러도 안 돼요. 다시 찍거나 직접 적어 넣어 주세요.',
        canRetry: false,
      };
    case 'BAD_IMAGE':
      return { message: '사진을 열 수 없어요. 다른 사진을 골라주세요.', canRetry: false };
    case 'DAILY_LIMIT':
      return { message: '오늘은 여기까지예요. 내일 다시 눌러주세요. 급하면 직접 적어 넣을 수 있어요.', canRetry: false };
    case 'BAD_PIN':
      return { message: '비밀번호가 맞지 않아요. 다시 입력해 주세요.', canRetry: true };
    case 'TIMEOUT':
    case 'BUSY':
    case 'SERVER':
      return failedCount >= MAX_RETRIES
        ? { message: '여러 번 해도 안 돼요. 잠시 뒤에 다시 하시거나 직접 적어 넣어 주세요.', canRetry: false }
        : { message: RETRY_MESSAGES[kind], canRetry: true };
  }
}
