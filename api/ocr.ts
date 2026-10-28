import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { OcrErrorCode } from '../shared/receipt.js';
import { isPinValid } from './_lib/auth.js';
import { extractWithFallback, getProviderChain, RateLimitError } from './_lib/providers/index.js';
import { checkDailyLimit } from './_lib/rateLimit.js';

// 압축된 사진은 보통 0.5MB 이하. Vercel 요청 한도(4.5MB)보다 작게 막는다.
const MAX_BASE64_CHARS = 4_000_000;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const STATUS: Record<OcrErrorCode, number> = {
  BAD_PIN: 401,
  DAILY_LIMIT: 429,
  BUSY: 429,
  BAD_IMAGE: 400,
  SERVER: 500,
};

function fail(res: VercelResponse, code: OcrErrorCode): void {
  res.status(STATUS[code]).json({ code });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const pin = req.headers['x-app-pin'];
  if (!isPinValid(Array.isArray(pin) ? pin[0] : pin, process.env.APP_PIN)) {
    fail(res, 'BAD_PIN');
    return;
  }

  const body = (req.body ?? {}) as { image?: unknown };
  // 하루 횟수를 쓰기 전에 걸러낸다: JPEG(base64는 "/9j/"로 시작)만 받는다
  if (
    typeof body.image !== 'string' ||
    body.image.length > MAX_BASE64_CHARS ||
    !body.image.startsWith('/9j/') ||
    !BASE64_PATTERN.test(body.image)
  ) {
    fail(res, 'BAD_IMAGE');
    return;
  }

  try {
    if (!(await checkDailyLimit())) {
      fail(res, 'DAILY_LIMIT');
      return;
    }
    const chain = getProviderChain();
    const result = await extractWithFallback({ base64: body.image, mime: 'image/jpeg' }, chain);
    res.status(200).json(result);
  } catch (e: unknown) {
    if (e instanceof RateLimitError) {
      fail(res, 'BUSY');
      return;
    }
    // 사진·키 등 민감 정보는 남기지 않고 오류 종류만 기록
    console.error('ocr failed:', e instanceof Error ? e.message : 'unknown');
    fail(res, 'SERVER');
  }
}
