import { normalizeCommit, type CommitParts } from './conventional.js';
import { MsgitError } from './errors.js';
import {
  buildMessages,
  RETRY_NUDGE,
  type DiffContext,
  type HumorLevel,
} from './prompt.js';
import type { Provider } from './providers/types.js';

export interface GenerateOptions {
  provider: Provider;
  context: DiffContext;
  humor: HumorLevel;
  maxSubjectLength: number;
  model: string | undefined;
  signal?: AbortSignal;
}

export interface GeneratedCommit {
  parts: CommitParts;
  /** Non-fatal problems worth showing the user before they accept. */
  warnings: string[];
  model: string;
  attempts: number;
}

const MAX_ATTEMPTS = 2;

/**
 * One model call, plus a single retry when the reply cannot be turned into a
 * commit. A retry costs one request and saves the user from rerunning msgit.
 */
export async function generateCommit(
  options: GenerateOptions,
): Promise<GeneratedCommit> {
  const messages = buildMessages(options.context, {
    humor: options.humor,
    maxSubjectLength: options.maxSubjectLength,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const completion = await options.provider.complete({
      model: options.model,
      messages,
      temperature: options.humor === 'plain' ? 0.2 : 0.8,
      ...(options.signal ? { signal: options.signal } : {}),
    });

    try {
      const { parts, warnings } = normalizeCommit(completion.text, {
        maxSubjectLength: options.maxSubjectLength,
      });
      return { parts, warnings, model: completion.model, attempts: attempt };
    } catch (error) {
      lastError = error;
      messages.push({ role: 'assistant', content: completion.text });
      messages.push(RETRY_NUDGE);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : '';

  throw new MsgitError('HAIYAA. Even uncle cannot name this change.', {
    hint:
      reason === 'EMPTY_SUBJECT'
        ? 'The model kept replying without a usable subject. Pin a stronger model with --model.'
        : 'The model did not send back a commit message. Try again, or pin a model with --model.',
  });
}
