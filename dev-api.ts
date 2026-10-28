import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';

/**
 * 내 컴퓨터에서 테스트할 때만 쓰는 도구: `npm run dev` 서버에서 /api/ocr 를 직접 처리한다.
 * .env.local 의 값을 그대로 읽으므로 Vercel 로그인이나 설정이 필요 없다. (실제 배포에는 포함되지 않음)
 */
export function devApi(): Plugin {
  return {
    name: 'dev-api-ocr',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, server.config.root, ''));

      server.middlewares.use('/api/ocr', async (req: IncomingMessage, res: ServerResponse) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        let body: unknown = {};
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        } catch {
          body = {};
        }

        const vreq = Object.assign(req, { body });
        const vres = Object.assign(res, {
          status(code: number) {
            res.statusCode = code;
            return vres;
          },
          json(data: unknown) {
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(data));
            return vres;
          },
        });

        try {
          const mod = (await server.ssrLoadModule('/api/ocr.ts')) as { default: (a: unknown, b: unknown) => Promise<void> };
          await mod.default(vreq, vres);
        } catch (e: unknown) {
          server.config.logger.error(`api/ocr failed: ${e instanceof Error ? e.message : 'unknown'}`);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ code: 'SERVER' }));
        }
      });
    },
  };
}
