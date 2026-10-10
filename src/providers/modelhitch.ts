import { MsgitError } from '../errors.js';
import type {
  CompletionRequest,
  CompletionResult,
  Provider,
} from './types.js';

export interface ModelHitchOptions {
  baseUrl: string;
  apiKey?: string | undefined;
  timeoutMs: number;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

interface ModelListResponse {
  data?: Array<{ id?: string }>;
}

function normaliseBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  return /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

function snippet(text: string, limit = 400): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit)}...` : flat;
}

/**
 * Talks to the local ModelHitch bridge over its OpenAI-compatible endpoint.
 * No API key is normally involved: the bridge holds the provider credentials.
 */
export class ModelHitchProvider implements Provider {
  readonly id = 'modelhitch';
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly timeoutMs: number;

  constructor(options: ModelHitchOptions) {
    this.baseUrl = normaliseBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs;
  }

  get endpoint(): string {
    return this.baseUrl;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (this.apiKey) headers['authorization'] = `Bearer ${this.apiKey}`;
    return headers;
  }

  private async request(
    path: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<Response> {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: combined,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new MsgitError(
          `HAIYAA. ModelHitch took longer than ${Math.round(this.timeoutMs / 1000)}s to answer.`,
          {
            hint: 'Raise MSGIT_TIMEOUT_MS, or check the bridge log with `modelhitch status`.',
          },
        );
      }
      if (error instanceof Error && error.name === 'AbortError') throw error;

      const cause = (error as { cause?: { code?: string } }).cause;
      const code = cause?.code ?? '';
      const isDown =
        code === 'ECONNREFUSED' ||
        code === 'ECONNRESET' ||
        code === 'ENOTFOUND' ||
        code === 'UND_ERR_CONNECT_TIMEOUT';

      throw new MsgitError(
        isDown
          ? 'No ingredients? Uncle cannot cook without ModelHitch.'
          : `HAIYAA. Cannot reach ModelHitch at ${this.baseUrl}.`,
        {
          hint: `Start the bridge with \`modelhitch bridge --background\`, then check \`modelhitch status\`. Point msgit elsewhere with --base-url or MSGIT_BASE_URL.`,
        },
      );
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const body: Record<string, unknown> = {
      messages: request.messages,
      stream: false,
    };
    if (request.model !== undefined) body['model'] = request.model;
    if (request.maxTokens !== undefined) body['max_tokens'] = request.maxTokens;
    if (request.temperature !== undefined) {
      body['temperature'] = request.temperature;
    }

    const response = await this.request(
      '/chat/completions',
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
      request.signal,
    );

    const text = await response.text();

    if (!response.ok) {
      let message = snippet(text);
      try {
        const parsed = JSON.parse(text) as ChatCompletionResponse;
        if (parsed.error?.message) message = snippet(parsed.error.message);
      } catch {
        // Keep the raw snippet.
      }

      if (response.status === 404) {
        throw new MsgitError(
          `HAIYAA. ModelHitch does not know this model. (HTTP 404)`,
          {
            hint: `${message}\nList the lanes it can serve with: curl ${this.baseUrl}/models`,
          },
        );
      }

      throw new MsgitError(
        `HAIYAA. ModelHitch answered with HTTP ${response.status}.`,
        { hint: message || 'Check `modelhitch status` for the bridge log path.' },
      );
    }

    let parsed: ChatCompletionResponse;
    try {
      parsed = JSON.parse(text) as ChatCompletionResponse;
    } catch {
      throw new MsgitError('HAIYAA. ModelHitch sent something that is not JSON.', {
        hint: snippet(text) || 'No response body.',
      });
    }

    const content = parsed.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new MsgitError('HAIYAA. ModelHitch sent an empty reply.', {
        hint: 'Every lane refused or returned no content. Try again, or pin a model with --model.',
      });
    }

    const completion: CompletionResult = {
      text: content,
      model: parsed.model ?? request.model ?? 'unknown',
    };
    if (parsed.usage) {
      completion.usage = {
        ...(parsed.usage.prompt_tokens === undefined
          ? {}
          : { promptTokens: parsed.usage.prompt_tokens }),
        ...(parsed.usage.completion_tokens === undefined
          ? {}
          : { completionTokens: parsed.usage.completion_tokens }),
      };
    }
    return completion;
  }

  async listModels(): Promise<string[]> {
    const response = await this.request('/models', { method: 'GET' });
    if (!response.ok) {
      throw new MsgitError(
        `HAIYAA. ModelHitch would not list its models. (HTTP ${response.status})`,
      );
    }

    const parsed = JSON.parse(await response.text()) as ModelListResponse;
    return (parsed.data ?? [])
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string' && id !== '');
  }
}
