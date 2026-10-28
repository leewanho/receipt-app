import { Redis } from '@upstash/redis';

const DEFAULT_DAILY_LIMIT = 60;
const TWO_DAYS_SEC = 60 * 60 * 48;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 한국 시간 기준 오늘 날짜 (하루 제한이 자정에 초기화되도록) */
export function todayKey(now = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export interface DailyCounter {
  /** 오늘 호출 수를 1 올리고 올린 뒤의 값을 돌려준다 */
  increment(key: string): Promise<number>;
}

// Upstash가 연결되지 않았을 때만 쓰는 임시 방식 (서버가 재시작되면 초기화되어 제한이 약함)
const memory = new Map<string, number>();
const memoryCounter: DailyCounter = {
  async increment(key) {
    const next = (memory.get(key) ?? 0) + 1;
    memory.set(key, next);
    return next;
  },
};

/**
 * Upstash 연결 정보를 찾는다. Vercel이 접두어(KV_, STORAGE_ 등)를 붙여 자동으로 만들어 주므로
 * 이름이 `…_REST_API_URL` / `…_REST_API_TOKEN` 으로 끝나는 변수를 모두 인식한다.
 */
export function findRedisCredentials(env: NodeJS.ProcessEnv): { url?: string; token?: string } {
  const pick = (suffixes: string[]): string | undefined => {
    const key = Object.keys(env).find((k) => env[k] && suffixes.some((s) => k.endsWith(s)));
    return key ? env[key] : undefined;
  };
  return {
    url: pick(['UPSTASH_REDIS_REST_URL', '_REST_API_URL']),
    token: pick(['UPSTASH_REDIS_REST_TOKEN', '_REST_API_TOKEN']),
  };
}

function createCounter(env: NodeJS.ProcessEnv): DailyCounter {
  const { url, token } = findRedisCredentials(env);
  if (!url || !token) {
    // 실제 서비스(Vercel)에서 저장소 없이 돌면 제한이 사실상 없는 것이므로 막는다
    if (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview') throw new Error('daily limit store (Upstash) is not configured');
    return memoryCounter;
  }
  const redis = new Redis({ url, token });
  return {
    async increment(key) {
      // 올리기와 만료 설정을 한 번에 처리해서 중간에 끊겨도 키가 남지 않게 한다
      const [n] = await redis.multi().incr(key).expire(key, TWO_DAYS_SEC).exec<[number, number]>();
      return n;
    },
  };
}

export async function checkDailyLimit(
  env: NodeJS.ProcessEnv = process.env,
  counter: DailyCounter = createCounter(env),
  now = new Date(),
): Promise<boolean> {
  const limit = Number(env.DAILY_LIMIT) > 0 ? Number(env.DAILY_LIMIT) : DEFAULT_DAILY_LIMIT;
  const used = await counter.increment(`ocr:day:${todayKey(now)}`);
  return used <= limit;
}
