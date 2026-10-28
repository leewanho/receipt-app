import { useEffect, useState } from 'react';
import { findDuplicate } from '../lib/dedupe';
import { missingRequired } from '../lib/draft';
import { formatDateKo, formatWon, parseMoney } from '../lib/format';
import type { FieldKey, PaymentMethod, Receipt } from '../types';
import { BigButton, BottomSheet, Message } from './ui';

interface ReviewFormProps {
  draft: Receipt;
  image?: Blob;
  existing: readonly Receipt[];
  saveLabel: string;
  onSave: (receipt: Receipt) => void | Promise<void>;
  onDelete?: () => void;
}

const REQUIRED_TEXT = { date: '날짜를 적어주세요.', total: '금액을 적어주세요.' } as const;

export function ReviewForm({ draft, image, existing, saveLabel, onSave, onDelete }: ReviewFormProps) {
  const [form, setForm] = useState<Receipt>(draft);
  const [moneyText, setMoneyText] = useState(draft.total === null ? '' : draft.total.toLocaleString('ko-KR'));
  const [touched, setTouched] = useState<ReadonlySet<FieldKey>>(new Set());
  const [showErrors, setShowErrors] = useState(false);
  const [askDuplicate, setAskDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!image) return;
    const url = URL.createObjectURL(image);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const edit = (key: FieldKey | null, patch: Partial<Receipt>): void => {
    setForm((f) => ({ ...f, ...patch }));
    if (key) setTouched((t) => new Set(t).add(key));
  };
  const isLow = (key: FieldKey): boolean => form.lowConfidence.includes(key) && !touched.has(key);
  const missing = missingRequired(form);

  const doSave = async (): Promise<void> => {
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave({ ...form, memo: form.memo.trim() });
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const trySave = (): void => {
    if (missing.length > 0) {
      setShowErrors(true);
      return;
    }
    if (findDuplicate(existing, form)) {
      setAskDuplicate(true);
      return;
    }
    void doSave();
  };

  const setPayment = (p: PaymentMethod): void => edit('paymentMethod', { paymentMethod: p });

  return (
    <>
      {imageUrl && (
        <button type="button" className="thumb-btn" onClick={() => setZoom((z) => !z)}>
          <img className={zoom ? 'thumb zoom' : 'thumb'} src={imageUrl} alt="영수증 사진" />
          <span>{zoom ? '작게 보기' : '눌러서 크게 보기'}</span>
        </button>
      )}

      <label className={`field ${isLow('date') ? 'low' : ''}`}>
        <span>날짜 {form.date && <small>({formatDateKo(form.date)})</small>}</span>
        <input type="date" value={form.date ?? ''} onChange={(e) => edit('date', { date: e.target.value || null })} />
        {showErrors && missing.includes('date') && <Message tone="error">{REQUIRED_TEXT.date}</Message>}
      </label>

      <label className={`field ${isLow('merchant') ? 'low' : ''}`}>
        <span>사용처</span>
        <input type="text" value={form.merchant ?? ''} onChange={(e) => edit('merchant', { merchant: e.target.value || null })} />
      </label>

      <label className={`field ${isLow('total') ? 'low' : ''}`}>
        <span>금액 (원)</span>
        <input
          type="text"
          inputMode="numeric"
          value={moneyText}
          onChange={(e) => {
            const n = parseMoney(e.target.value);
            setMoneyText(n === null ? '' : n.toLocaleString('ko-KR'));
            edit('total', { total: n });
          }}
        />
        {showErrors && missing.includes('total') && <Message tone="error">{REQUIRED_TEXT.total}</Message>}
      </label>

      <div className={`field ${isLow('paymentMethod') ? 'low' : ''}`}>
        <span>결제수단</span>
        <div className="toggle-row">
          {(['card', 'cash'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`toggle ${form.paymentMethod === p ? 'on' : ''}`}
              aria-pressed={form.paymentMethod === p}
              onClick={() => setPayment(p)}
            >
              {p === 'card' ? '카드' : '현금'}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>메모</span>
        <input
          type="text"
          placeholder="무슨 일로 쓰셨나요? (안 적어도 돼요)"
          value={form.memo}
          onChange={(e) => edit(null, { memo: e.target.value })}
        />
      </label>

      {saveFailed && <Message tone="error">저장하지 못했어요. 다시 눌러주세요.</Message>}
      <BigButton onClick={trySave} disabled={saving}>
        {saving ? '저장하는 중이에요…' : saveLabel}
      </BigButton>
      {onDelete && (
        <BigButton variant="danger" onClick={onDelete}>
          이 영수증 지우기
        </BigButton>
      )}

      {askDuplicate && (
        <BottomSheet title="이미 저장된 영수증 같아요">
          <p>
            {formatDateKo(form.date)} · {form.merchant ?? '사용처 없음'} · {formatWon(form.total ?? 0)}
          </p>
          <p>그래도 저장할까요?</p>
          <BigButton
            onClick={() => {
              setAskDuplicate(false);
              void doSave();
            }}
          >
            그래도 저장
          </BigButton>
          <BigButton variant="plain" onClick={() => setAskDuplicate(false)}>
            저장 안 함
          </BigButton>
        </BottomSheet>
      )}
    </>
  );
}
