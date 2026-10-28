import type { Receipt } from '../types';

const norm = (s: string | null): string => (s ?? '').replace(/\s+/g, '').toLowerCase();

/** 날짜+금액+상호가 모두 같은 영수증이 이미 있으면 돌려준다 (자기 자신은 제외) */
export function findDuplicate(existing: readonly Receipt[], draft: Receipt): Receipt | undefined {
  return existing.find(
    (r) =>
      r.id !== draft.id &&
      r.date === draft.date &&
      r.total === draft.total &&
      norm(r.merchant) === norm(draft.merchant),
  );
}
