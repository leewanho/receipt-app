export const canShareFile = (file: File): boolean =>
  typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

/** 카톡 등으로 보내기. 사용자가 공유창을 닫은 경우는 오류로 치지 않는다 */
export async function shareFile(file: File): Promise<void> {
  try {
    await navigator.share({ files: [file], title: file.name });
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    throw e;
  }
}

/** 공유를 지원하지 않는 기기에서는 그냥 내려받기 */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
