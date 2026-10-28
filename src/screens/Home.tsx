import { useRef } from 'react';
import { BigButton, Screen } from '../components/ui';

interface HomeProps {
  onPick: (files: File[]) => void;
  onOpenList: () => void;
  onOpenSettings: () => void;
}

export function Home({ onPick, onOpenList, onOpenSettings }: HomeProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handle = (input: HTMLInputElement): void => {
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length > 0) onPick(files);
  };

  return (
    <Screen>
      <button type="button" className="gear" onClick={onOpenSettings} aria-label="설정">
        ⚙ 설정
      </button>
      <h1 className="home-title">영수증 정리</h1>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handle(e.target)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={(e) => handle(e.target)} />

      <BigButton onClick={() => cameraRef.current?.click()}>📷 영수증 찍기</BigButton>
      <BigButton onClick={() => galleryRef.current?.click()}>🖼 사진에서 고르기</BigButton>
      <BigButton variant="plain" onClick={onOpenList}>
        📋 저장한 영수증 보기
      </BigButton>
    </Screen>
  );
}
