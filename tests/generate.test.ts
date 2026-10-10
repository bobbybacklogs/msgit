import { describe, expect, it } from 'vitest';

import { MsgitError } from '../src/errors.js';
import { generateCommit } from '../src/generate.js';
import type { DiffContext } from '../src/prompt.js';
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResult,
  Provider,
} from '../src/providers/types.js';

const CONTEXT: DiffContext = {
  branch: 'main',
  lastCommitSubject: undefined,
  files: ['src/cart.ts'],
  diff: 'diff --git a/src/cart.ts b/src/cart.ts\n+const x = 1;',
  truncated: false,
  omittedFiles: [],
  omittedChars: 0,
};

class FakeProvider implements Provider {
  readonly id = 'fake';
  readonly requests: CompletionRequest[] = [];

  constructor(private readonly replies: string[]) {}

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    this.requests.push(request);
    const index = Math.min(this.requests.length - 1, this.replies.length - 1);
    return { text: this.replies[index] ?? '', model: 'fake-model' };
  }

  async listModels(): Promise<string[]> {
    return ['fake-model'];
  }
}

function options(provider: Provider, model: string | undefined = undefined) {
  return {
    provider,
    context: CONTEXT,
    humor: 'seasoned' as const,
    maxSubjectLength: 72,
    model,
  };
}

describe('generateCommit', () => {
  it('returns the parsed commit and the model that answered', async () => {
    const provider = new FakeProvider([
      '{"type":"feat","scope":"cart","subject":"add discounts","body":"fuiyoh."}',
    ]);

    const generated = await generateCommit(options(provider));

    expect(generated.model).toBe('fake-model');
    expect(generated.attempts).toBe(1);
    expect(generated.parts.scope).toBe('cart');
    expect(provider.requests).toHaveLength(1);
  });

  it('leaves the model unset so the bridge can rotate', async () => {
    const provider = new FakeProvider(['{"type":"chore","subject":"x","body":""}']);

    await generateCommit(options(provider));

    expect(provider.requests[0]?.model).toBeUndefined();
  });

  it('passes an explicit model through', async () => {
    const provider = new FakeProvider(['{"type":"chore","subject":"x","body":""}']);

    await generateCommit(options(provider, 'deepseek-v4-flash'));

    expect(provider.requests[0]?.model).toBe('deepseek-v4-flash');
  });

  it('retries once when the reply cannot be used', async () => {
    const provider = new FakeProvider([
      'sorry, no json for you',
      '{"type":"fix","subject":"stop the loop","body":""}',
    ]);

    const generated = await generateCommit(options(provider));

    expect(generated.attempts).toBe(2);
    expect(generated.parts.subject).toBe('stop the loop');
    expect(provider.requests).toHaveLength(2);
  });

  it('keeps the failed reply in the conversation so the retry has context', async () => {
    const provider = new FakeProvider([
      'not json',
      '{"type":"fix","subject":"stop the loop","body":""}',
    ]);

    await generateCommit(options(provider));

    const second: ChatMessage[] = provider.requests[1]?.messages ?? [];
    expect(second.at(-2)?.content).toBe('not json');
    expect(second.at(-1)?.content).toContain('only the JSON object');
  });

  it('gives up with a friendly error after two unusable replies', async () => {
    const provider = new FakeProvider(['nope', 'still nope']);

    await expect(generateCommit(options(provider))).rejects.toBeInstanceOf(
      MsgitError,
    );
  });

  it('asks for a low temperature when the user wants a plain message', async () => {
    const provider = new FakeProvider(['{"type":"docs","subject":"x","body":""}']);

    await generateCommit({ ...options(provider), humor: 'plain' });

    expect(provider.requests[0]?.temperature).toBeLessThan(0.5);
  });
});
