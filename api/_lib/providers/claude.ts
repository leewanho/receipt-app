import { normalizeReceipt, type ReceiptJSON } from '../../../shared/receipt.js';
import { SYSTEM_PROMPT, USER_PROMPT, buildSchema } from '../prompt.js';
import { ProviderError, RateLimitError, fetchWithTimeout, type OcrImage, type OcrProvider } from './types.js';

const DEFAULT_MODEL = 'claude-haiku-5-5';
const TOOL_NAME = 'save_receipt';

interface ClaudeResponse {
  content?: { type: string; input?: unknown }[];
}

export function createClaudeProvider(env: NodeJS.ProcessEnv = process.env): OcrProvider {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ProviderError('ANTHROPIC_API_KEY not configured');
  const model = env.CLAUDE_MODEL || DEFAULT_MODEL;

  return {
    name: 'claude',
    async extractReceipt(image: OcrImage): Promise<ReceiptJSON> {
      const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          temperature: 0,
          system: SYSTEM_PROMPT,
          tools: [
            {
              name: TOOL_NAME,
              description: '읽은 영수증 내용을 저장한다',
              input_schema: buildSchema('claude'),
            },
          ],
          tool_choice: { type: 'tool', name: TOOL_NAME },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: image.mime, data: image.base64 } },
                { type: 'text', text: USER_PROMPT },
              ],
            },
          ],
        }),
      });

      if (res.status === 429 || res.status === 529) throw new RateLimitError(`claude ${res.status}`);
      if (!res.ok) throw new ProviderError(`claude ${res.status}`);

      const data = (await res.json()) as ClaudeResponse;
      const toolUse = data.content?.find((c) => c.type === 'tool_use');
      if (!toolUse) throw new ProviderError('claude returned no tool_use');
      return normalizeReceipt(toolUse.input);
    },
  };
}
