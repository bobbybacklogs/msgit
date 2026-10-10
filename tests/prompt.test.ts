import { describe, expect, it } from 'vitest';

import { buildMessages, prepareDiff, type DiffContext } from '../src/prompt.js';

function chunk(path: string, bodySize: number): string {
  const body = 'x'.repeat(bodySize);
  return `diff --git a/${path} b/${path}\nindex 000..111 100644\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-${body}\n+${body}y`;
}

describe('prepareDiff', () => {
  it('passes a small diff through untouched', () => {
    const diff = chunk('a.ts', 10);
    const prepared = prepareDiff(diff, 10_000);

    expect(prepared.truncated).toBe(false);
    expect(prepared.text).toBe(diff);
    expect(prepared.omittedFiles).toEqual([]);
  });

  it('keeps whole files until the budget runs out', () => {
    const first = chunk('a.ts', 20);
    const second = chunk('b.ts', 20);
    const third = chunk('c.ts', 20);
    const diff = `${first}\n${second}\n${third}`;

    const prepared = prepareDiff(diff, first.length + second.length + 1);

    expect(prepared.truncated).toBe(true);
    expect(prepared.text).toContain('a/a.ts');
    expect(prepared.text).toContain('b/b.ts');
    expect(prepared.text).not.toContain('c/c.ts');
    expect(prepared.omittedFiles).toEqual(['c.ts']);
    expect(prepared.omittedChars).toBeGreaterThan(0);
  });

  it('cuts the head off a single file that is larger than the whole budget', () => {
    const prepared = prepareDiff(chunk('huge.ts', 5_000), 200);
    expect(prepared.truncated).toBe(true);
    expect(prepared.text).toContain('huge.ts');
    expect(prepared.text).toContain('cut this file off');
    expect(prepared.text.length).toBeLessThan(400);
  });
});

const CONTEXT: DiffContext = {
  branch: 'main',
  lastCommitSubject: 'chore: initial',
  files: ['src/cart.ts'],
  diff: 'diff --git a/src/cart.ts b/src/cart.ts\n+const x = 1;',
  truncated: false,
  omittedFiles: [],
  omittedChars: 0,
};

describe('buildMessages', () => {
  it('sends a system and a user message', () => {
    const messages = buildMessages(CONTEXT, {
      humor: 'seasoned',
      maxSubjectLength: 72,
    });

    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
  });

  it('marks the diff as untrusted data', () => {
    const [system, user] = buildMessages(CONTEXT, {
      humor: 'seasoned',
      maxSubjectLength: 72,
    });

    expect(system?.content).toContain('untrusted data');
    expect(user?.content).toContain('<diff>');
    expect(user?.content).toContain('</diff>');
    expect(user?.content).toContain('src/cart.ts');
    expect(user?.content).toContain('branch: main');
  });

  it('drops the persona for --plain', () => {
    const [system] = buildMessages(CONTEXT, {
      humor: 'plain',
      maxSubjectLength: 72,
    });

    expect(system?.content).toContain('No jokes');
    expect(system?.content).not.toContain('flourish at the end');
  });

  it('tells the model what was cut when the diff is truncated', () => {
    const [, user] = buildMessages(
      {
        ...CONTEXT,
        truncated: true,
        omittedFiles: ['src/big.ts'],
        omittedChars: 4321,
      },
      { humor: 'seasoned', maxSubjectLength: 72 },
    );

    expect(user?.content).toContain('dropped');
    expect(user?.content).toContain('src/big.ts');
  });
});
