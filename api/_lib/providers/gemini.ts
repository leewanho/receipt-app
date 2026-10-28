import { normalizeReceipt, type ReceiptJSON } from '../../../shared/receipt.js';
import { SYSTEM_PROMPT, USER_PROMPT, buildSchema } from '../prompt.js';
import { ProviderError, RateLimitError, fetchWithTimeout, type OcrImage, type OcrProvider } from './types.js';

const DEFAULT_MODEL = 'gemini-3.6-flash';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export function createGeminiProvider(env: NodeJS.ProcessEnv = process.env): OcrProvider {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new ProviderError('GEMINI_API_KEY not configured');
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;

  return {
    name: 'gemini',
    async extractReceipt(image: OcrImage): Promise<ReceiptJSON> {
      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: USER_PROMPT },
                  { inline_data: { mime_type: image.mime, data: image.base64 } },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              responseMimeType: 'application/json',
              responseSchema: buildSchema('gemini'),
            },
          }),
        },
      );

      if (res.status === 429 || res.status === 503) throw new RateLimitError(`gemini ${res.status}`);
      if (!res.ok) throw new ProviderError(`gemini ${res.status}`);

      const data = (await res.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      try {
        return normalizeReceipt(JSON.parse(text));
      } catch {
        throw new ProviderError('gemini returned invalid JSON');
      }
    },
  };
}
