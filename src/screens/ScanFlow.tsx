import { useCallback, useEffect, useRef, useState } from 'react';
import { PIN_LENGTH } from '../config/limits';
import { BigButton, Message, Screen } from '../components/ui';
import { ReviewForm } from '../components/ReviewForm';
import { saveReceipt } from '../lib/db';
import { toDraft } from '../lib/draft';
import { compressImage } from '../lib/image';
import {
  OcrClientError,
  OCR_ERROR_MESSAGES,
  clearPin,
  extractReceipt,
  getStoredPin,
  storePin,
} from '../lib/ocrClient';
import type { Receipt } from '../types';

interface ScanFlowProps {
  files: File[];
  existing: readonly Receipt[];
  onFinish: () => void;
}

type Phase =
  | { kind: 'pin' }
  | { kind: 'reading' }
  | { kind: 'review'; draft: Receipt; image: Blob }
  | { kind: 'problem'; message: string };

const NOT_RECEIPT = '영수증이 아닌 것 같아요. 다시 찍어주세요.';

/** 사진을 한 장씩 읽고 → 확인 → 저장을 반복한다 */
export function ScanFlow({ files, existing, onFinish }: ScanFlowProps) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(() => (getStoredPin() ? { kind: 'reading' } : { kind: 'pin' }));
  const [pinText, setPinText] = useState('');
  const [saved, setSaved] = useState<Receipt[]>([]);
  const runId = useRef(0);

  const total = files.length;
  const known = [...existing, ...saved];

  const goNext = useCallback((): void => {
    if (index + 1 >= total) {
      onFinish();
      return;
    }
    setIndex(index + 1);
    setPhase({ kind: 'reading' });
  }, [index, total, onFinish]);

  const read = useCallback(async (): Promise<void> => {
    const myRun = ++runId.current;
    const pin = getStoredPin();
    if (!pin) {
      setPhase({ kind: 'pin' });
      return;
    }
    setPhase({ kind: 'reading' });
    try {
      const image = await compressImage(files[index]);
      const json = await extractReceipt(image, pin);
      if (myRun !== runId.current) return;
      setPhase(json.is_receipt ? { kind: 'review', draft: toDraft(json), image } : { kind: 'problem', message: NOT_RECEIPT });
    } catch (e: unknown) {
      if (myRun !== runId.current) return;
      if (e instanceof OcrClientError && e.code === 'BAD_PIN') {
        clearPin();
        setPhase({ kind: 'pin' });
        return;
      }
      setPhase({
        kind: 'problem',
        message: e instanceof OcrClientError ? e.message : OCR_ERROR_MESSAGES.BAD_IMAGE,
      });
    }
  }, [files, index]);

  // 사진 번호가 바뀔 때마다 한 번만 읽는다 (개발 모드에서 효과가 두 번 실행돼도 AI 호출은 한 번)
  const startedFor = useRef(-1);
  useEffect(() => {
    if (startedFor.current === index) return;
    startedFor.current = index;
    if (phase.kind === 'reading') void read();
  }, [index, phase.kind, read]);

  const leave = (): void => {
    if (index + 1 < total && !window.confirm('남은 사진은 저장되지 않아요. 나갈까요?')) return;
    onFinish();
  };

  const progress = total > 1 ? `${index + 1}/${total}장째 ` : '';

  if (phase.kind === 'pin') {
    return (
      <Screen title="비밀번호" onBack={leave}>
        <p>처음 한 번만 4자리 비밀번호를 눌러주세요.</p>
        <input
          className="pin-input"
          type="password"
          inputMode="numeric"
          maxLength={PIN_LENGTH}
          value={pinText}
          onChange={(e) => setPinText(e.target.value.replace(/\D/g, ''))}
          aria-label="비밀번호 4자리"
        />
        <BigButton
          disabled={pinText.length !== PIN_LENGTH}
          onClick={() => {
            storePin(pinText);
            setPinText('');
            void read();
          }}
        >
          확인
        </BigButton>
      </Screen>
    );
  }

  if (phase.kind === 'reading') {
    return (
      <Screen title="영수증 읽는 중">
        <p className="big-text">
          {progress}영수증 읽는 중이에요… (5초 정도 걸려요)
        </p>
        <div className="spinner" aria-hidden="true" />
      </Screen>
    );
  }

  if (phase.kind === 'problem') {
    return (
      <Screen title="다시 해볼까요?" onBack={leave}>
        <Message tone="error">{phase.message}</Message>
        <BigButton onClick={() => void read()}>다시 읽기</BigButton>
        <BigButton variant="plain" onClick={goNext}>
          {index + 1 >= total ? '처음으로' : '이 사진 건너뛰기'}
        </BigButton>
      </Screen>
    );
  }

  const { draft, image } = phase;
  return (
    <Screen title={`${progress}맞는지 확인해 주세요`} onBack={leave}>
      <ReviewForm
        key={draft.id}
        draft={draft}
        image={image}
        existing={known}
        saveLabel={index + 1 >= total ? '저장' : '저장하고 다음 장'}
        onSave={async (receipt) => {
          await saveReceipt(receipt, image);
          setSaved((s) => [...s, receipt]);
          goNext();
        }}
      />
    </Screen>
  );
}
