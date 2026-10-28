import { useRef, useState } from 'react';
import { BigButton, Message, Screen } from '../components/ui';
import { createBackupFile, restoreBackup } from '../lib/backup';
import { clearPin } from '../lib/ocrClient';
import { canShareFile, downloadFile, shareFile } from '../lib/share';

interface SettingsScreenProps {
  onBack: () => void;
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);

  const backup = async (): Promise<void> => {
    try {
      const file = await createBackupFile();
      if (canShareFile(file)) await shareFile(file);
      else downloadFile(file);
      setNote({ tone: 'info', text: '백업 파일을 만들었어요.' });
    } catch {
      setNote({ tone: 'error', text: '백업을 만들지 못했어요. 다시 눌러주세요.' });
    }
  };

  const restore = async (file: File): Promise<void> => {
    try {
      const count = await restoreBackup(file);
      setNote({ tone: 'info', text: `영수증 ${count}장을 불러왔어요.` });
    } catch {
      setNote({ tone: 'error', text: '백업 파일이 맞지 않아요. 파일을 다시 골라주세요.' });
    }
  };

  return (
    <Screen title="설정" onBack={onBack}>
      <BigButton onClick={() => void backup()}>💾 백업 파일 받기</BigButton>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void restore(f);
        }}
      />
      <BigButton variant="plain" onClick={() => fileRef.current?.click()}>
        📂 백업 파일 불러오기
      </BigButton>
      <BigButton
        variant="plain"
        onClick={() => {
          clearPin();
          setNote({ tone: 'info', text: '다음에 영수증을 읽을 때 비밀번호를 다시 물어볼게요.' });
        }}
      >
        🔑 비밀번호 다시 입력하기
      </BigButton>
      {note && <Message tone={note.tone}>{note.text}</Message>}
    </Screen>
  );
}
