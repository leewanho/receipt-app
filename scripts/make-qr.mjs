// 내 컴퓨터에서 QR 이미지를 만든다. 비밀번호는 저장소·채팅에 남기지 않고 여기서 직접 입력한다.
//   npm run qr                      → 비밀번호를 물어보고 "바로 시작" QR(qr-login.png) 생성
//   npm run qr -- --no-pin          → 비밀번호 없는 일반 QR(qr-open.png) 생성
//   npm run qr -- https://내주소    → 다른 주소로 만들기
import { createInterface } from 'node:readline/promises';
import QRCode from 'qrcode';

const DEFAULT_URL = 'https://ocr-rho-ashen.vercel.app';
const args = process.argv.slice(2);
const noPin = args.includes('--no-pin');
const base = (args.find((a) => a.startsWith('http')) ?? DEFAULT_URL).replace(/\/+$/, '');

let url = base;
let file = 'qr-open.png';

if (!noPin) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pin = (await rl.question('Vercel에 넣은 4자리 비밀번호(APP_PIN)를 입력하세요: ')).trim();
  rl.close();
  if (!/^\d{4}$/.test(pin)) {
    console.error('4자리 숫자가 아니에요. 다시 실행해 주세요.');
    process.exit(1);
  }
  url = `${base}/#pin=${pin}`;
  file = 'qr-login.png';
}

await QRCode.toFile(file, url, { width: 640, margin: 2, errorCorrectionLevel: 'M' });
console.log(`\n만들었어요: ${file}`);
if (!noPin) {
  console.log('이 이미지에는 비밀번호가 들어 있어요. 믿는 사람에게만 보여주고, 인터넷에 올리지 마세요.');
}
