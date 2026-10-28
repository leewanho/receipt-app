import { IMAGE_JPEG_QUALITY, IMAGE_MAX_SIDE } from '../config/limits';

/** 줄여야 하는 크기를 계산한다 (긴 변이 maxSide 이하가 되도록, 작은 사진은 그대로) */
export function fitSize(w: number, h: number, maxSide = IMAGE_MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(w, h);
  if (longest <= maxSide) return { width: w, height: h };
  const ratio = maxSide / longest;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

const fromBitmap = (b: ImageBitmap): Decoded => ({
  source: b,
  width: b.width,
  height: b.height,
  release: () => b.close(),
});

/** 사진 열기: 기기마다 지원하는 방법이 달라서 되는 방법이 나올 때까지 차례로 시도한다 */
async function decodeImage(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      return fromBitmap(await createImageBitmap(file, { imageOrientation: 'from-image' }));
    } catch {
      /* 일부 iPhone 브라우저는 회전 옵션을 지원하지 않는다 → 다음 방법 */
    }
    try {
      return fromBitmap(await createImageBitmap(file));
    } catch {
      /* 다음 방법 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (e: unknown) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** 사진을 긴 변 1600px 이하 JPEG로 줄인다 (회전 정보 반영, HEIC는 브라우저가 열 수 있을 때 JPEG로 변환) */
export async function compressImage(file: Blob): Promise<Blob> {
  const decoded = await decodeImage(file);
  try {
    const { width, height } = fitSize(decoded.width, decoded.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(decoded.source, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', IMAGE_JPEG_QUALITY),
    );
  } finally {
    decoded.release();
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
