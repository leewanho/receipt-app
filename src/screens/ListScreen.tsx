import { useCallback, useEffect, useRef, useState } from 'react';
import { UNDO_DELETE_MS } from '../config/limits';
import { BigButton, BottomSheet, Message, Screen } from '../components/ui';
import { ReviewForm } from '../components/ReviewForm';
import { deleteReceipt, getImage, listReceipts, saveReceipt } from '../lib/db';
import { createWorkbookFile } from '../lib/excel';
import { filterByPeriod, type Period } from '../lib/excelRows';
import { formatDateKo, formatWon, monthTotal } from '../lib/format';
import { canShareFile, downloadFile, shareFile } from '../lib/share';
import type { Receipt } from '../types';

interface ListScreenProps {
  onBack: () => void;
}

const PERIODS: { id: Period; label: string }[] = [
  { id: 'this-month', label: '이번 달' },
  { id: 'last-month', label: '지난달' },
  { id: 'all', label: '전체' },
];

type Panel =
  | { kind: 'none' }
  | { kind: 'period' }
  | { kind: 'working' }
  | { kind: 'ready'; file: File }
  | { kind: 'empty' }
  | { kind: 'failed' }
  | { kind: 'failed-delete' }
  | { kind: 'confirm-delete'; receipt: Receipt };

export function ListScreen({ onBack }: ListScreenProps) {
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [undoId, setUndoId] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [editing, setEditing] = useState<{ receipt: Receipt; image?: Blob } | null>(null);
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  const reload = useCallback(async (): Promise<void> => setReceipts(await listReceipts()), []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = (receipts ?? []).filter((r) => !hidden.has(r.id));

  const unhide = (id: string): void =>
    setHidden((h) => {
      const next = new Set(h);
      next.delete(id);
      return next;
    });

  /** 실제로 지운다. 실패하면 목록에 다시 보여주고 알려준다 */
  const commitDelete = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteReceipt(id);
      } catch {
        unhide(id);
        setPanel({ kind: 'failed-delete' });
      }
      await reload();
    },
    [reload],
  );

  /** 되돌리기를 기다리는 삭제가 있으면 지금 바로 확정한다 */
  const flushPending = useCallback((): void => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    void commitDelete(p.id);
  }, [commitDelete]);

  useEffect(() => {
    // 화면을 벗어나거나 앱을 닫아도 지우기로 한 영수증은 지워지게 한다
    window.addEventListener('pagehide', flushPending);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      flushPending();
    };
  }, [flushPending]);

  const startDelete = (receipt: Receipt): void => {
    flushPending();
    setPanel({ kind: 'none' });
    setEditing(null);
    setHidden((h) => new Set(h).add(receipt.id));
    setUndoId(receipt.id);
    pending.current = {
      id: receipt.id,
      timer: setTimeout(() => {
        pending.current = null;
        setUndoId(null);
        void commitDelete(receipt.id);
      }, UNDO_DELETE_MS),
    };
  };

  const undoDelete = (): void => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    unhide(p.id);
    setUndoId(null);
  };

  const makeExcel = async (period: Period): Promise<void> => {
    const target = filterByPeriod(visible, period);
    if (target.length === 0) {
      setPanel({ kind: 'empty' });
      return;
    }
    setPanel({ kind: 'working' });
    try {
      const file = await createWorkbookFile(target);
      if (canShareFile(file)) {
        setPanel({ kind: 'ready', file });
      } else {
        downloadFile(file);
        setPanel({ kind: 'none' });
      }
    } catch {
      setPanel({ kind: 'failed' });
    }
  };

  const openEdit = async (receipt: Receipt): Promise<void> => setEditing({ receipt, image: await getImage(receipt.id) });

  if (editing) {
    return (
      <Screen title="고치기" onBack={() => setEditing(null)}>
        <ReviewForm
          key={editing.receipt.id}
          draft={editing.receipt}
          image={editing.image}
          existing={visible}
          saveLabel="저장"
          onSave={async (r) => {
            await saveReceipt(r);
            setEditing(null);
            await reload();
          }}
          onDelete={() => setPanel({ kind: 'confirm-delete', receipt: editing.receipt })}
        />
        {panel.kind === 'confirm-delete' && (
          <BottomSheet title="정말 지울까요?">
            <p>지운 뒤 5초 안에는 되돌릴 수 있어요.</p>
            <BigButton variant="danger" onClick={() => startDelete(panel.receipt)}>
              네, 지울게요
            </BigButton>
            <BigButton variant="plain" onClick={() => setPanel({ kind: 'none' })}>
              그만두기
            </BigButton>
          </BottomSheet>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      title="저장한 영수증"
      onBack={onBack}
      footer={<BigButton onClick={() => setPanel({ kind: 'period' })}>📥 엑셀로 받기</BigButton>}
    >
      <div className="month-total">
        <span>이번 달 합계</span>
        <strong>{formatWon(monthTotal(visible))}</strong>
      </div>

      {receipts === null ? (
        <p>불러오는 중이에요…</p>
      ) : visible.length === 0 ? (
        <p className="big-text">아직 저장한 영수증이 없어요.</p>
      ) : (
        <ul className="receipt-list">
          {visible.map((r) => (
            <li key={r.id}>
              <button type="button" className="receipt-row" onClick={() => void openEdit(r)}>
                <span className="row-date">{formatDateKo(r.date)}</span>
                <span className="row-merchant">{r.merchant ?? '사용처 없음'}</span>
                <span className="row-amount">{formatWon(r.total ?? 0)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {undoId && (
        <div className="toast" role="status">
          <span>지웠어요</span>
          <button type="button" onClick={undoDelete}>
            되돌리기
          </button>
        </div>
      )}

      {panel.kind === 'period' && (
        <BottomSheet title="어느 기간을 받을까요?">
          {PERIODS.map((p) => (
            <BigButton key={p.id} onClick={() => void makeExcel(p.id)}>
              {p.label}
            </BigButton>
          ))}
          <BigButton variant="plain" onClick={() => setPanel({ kind: 'none' })}>
            그만두기
          </BigButton>
        </BottomSheet>
      )}
      {panel.kind === 'working' && (
        <BottomSheet title="엑셀 만드는 중이에요…">
          <p>잠깐만 기다려 주세요.</p>
        </BottomSheet>
      )}
      {panel.kind === 'ready' && (
        <BottomSheet title="엑셀 파일이 준비됐어요">
          <BigButton onClick={() => void shareFile(panel.file).then(() => setPanel({ kind: 'none' })).catch(() => setPanel({ kind: 'failed' }))}>
            💬 카톡 등으로 보내기
          </BigButton>
          <BigButton variant="plain" onClick={() => { downloadFile(panel.file); setPanel({ kind: 'none' }); }}>
            내 폰에 저장하기
          </BigButton>
          <BigButton variant="plain" onClick={() => setPanel({ kind: 'none' })}>
            닫기
          </BigButton>
        </BottomSheet>
      )}
      {panel.kind === 'failed-delete' && (
        <BottomSheet title="알려드려요">
          <Message tone="error">지우지 못했어요. 영수증은 그대로 있어요. 다시 눌러주세요.</Message>
          <BigButton onClick={() => setPanel({ kind: 'none' })}>확인</BigButton>
        </BottomSheet>
      )}
      {(panel.kind === 'empty' || panel.kind === 'failed') && (
        <BottomSheet title="알려드려요">
          <Message tone="error">
            {panel.kind === 'empty'
              ? '이 기간에는 저장한 영수증이 없어요. 다른 기간을 골라주세요.'
              : '엑셀을 만들지 못했어요. 다시 눌러주세요.'}
          </Message>
          <BigButton onClick={() => setPanel({ kind: 'period' })}>다시 고르기</BigButton>
          <BigButton variant="plain" onClick={() => setPanel({ kind: 'none' })}>
            닫기
          </BigButton>
        </BottomSheet>
      )}
    </Screen>
  );
}
