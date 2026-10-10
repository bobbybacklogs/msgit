import { describe, expect, it } from 'vitest';

import { DEFAULT_BASE_URL, loadConfig } from '../src/config.js';
import { MsgitError } from '../src/errors.js';
import { findSuspectedSecrets } from '../src/secrets.js';

describe('loadConfig', () => {
  it('defaults to the local ModelHitch bridge', () => {
    const config = loadConfig({});

    expect(config.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(config.model).toBeUndefined();
    expect(config.apiKey).toBeUndefined();
  });

  it('builds the URL from MODELHITCH_HOST and MODELHITCH_PORT', () => {
    const config = loadConfig({ MODELHITCH_PORT: '4000' });

    expect(config.baseUrl).toBe('http://127.0.0.1:4000/v1');
  });

  it('prefers an explicit URL over the port', () => {
    const config = loadConfig({
      MSGIT_BASE_URL: 'http://127.0.0.1:9999/v1',
      MODELHITCH_PORT: '4000',
    });

    expect(config.baseUrl).toBe('http://127.0.0.1:9999/v1');
  });

  it('reads the model and key when set', () => {
    const config = loadConfig({
      MSGIT_MODEL: 'deepseek-v4-flash',
      MSGIT_API_KEY: 'secret-value',
    });

    expect(config.model).toBe('deepseek-v4-flash');
    expect(config.apiKey).toBe('secret-value');
  });

  it('treats a blank model as unset', () => {
    expect(loadConfig({ MSGIT_MODEL: '   ' }).model).toBeUndefined();
  });

  it('rejects a non-numeric timeout', () => {
    expect(() => loadConfig({ MSGIT_TIMEOUT_MS: 'soon' })).toThrowError(
      MsgitError,
    );
  });
});

/**
 * Assembled from parts on purpose. These have to look like real credentials for
 * the tests to mean anything, but a literal would trip msgit's own guard when
 * this file is committed. Test fixtures that announce themselves as fake are a
 * separate case, covered below.
 */
const FAKE = {
  awsKeyId: `AKIA${'3QF7ZL2XW8M4NVD9'}`,
  apiKey: `sk-${'9c4BaZ7xLm2QpR8tVwYsN6kEjH3dF5gT'}`,
  githubToken: `ghp_${'9c4BaZ7xLm2QpR8tVwYsN6kEjH3dF5gT1uIo'}`,
  keyBody: `MIIEowIBAAKCAQEA${'9c4BaZ7xLm2QpR8tVwYsN6kEjH3dF5gT1uIo'}`,
};

describe('findSuspectedSecrets', () => {
  const header = 'diff --git a/src/env.ts b/src/env.ts\n+++ b/src/env.ts\n';

  it('flags an added API key', () => {
    const diff = `${header}+export const key = "${FAKE.apiKey}";\n`;
    const found = findSuspectedSecrets(diff);

    expect(found).toHaveLength(1);
    expect(found[0]?.file).toBe('src/env.ts');
    expect(found[0]?.kinds).toContain('Anthropic/OpenAI style key');
  });

  it('flags a private key that actually carries a body', () => {
    const diff = `${header}+-----BEGIN RSA PRIVATE KEY-----\n+${FAKE.keyBody}\n`;

    expect(findSuspectedSecrets(diff)[0]?.kinds).toContain('private key block');
  });

  it('flags an assigned secret literal', () => {
    const diff = `${header}+const clientSecret = "${FAKE.keyBody}";\n`;

    expect(findSuspectedSecrets(diff)[0]?.kinds).toContain(
      'assigned secret literal',
    );
  });

  it('ignores a bare private key header used as a test fixture', () => {
    const diff = `${header}+-----BEGIN RSA PRIVATE KEY-----\n`;

    expect(findSuspectedSecrets(diff)).toEqual([]);
  });

  it('ignores obvious placeholders in tests and documentation', () => {
    const diff =
      `${header}+const accessKeyId = "AKIAIOSFODNN7EXAMPLE";\n` +
      `+const apiKey = "sk-abcdefghijklmnopqrstuvwxyz012345";\n` +
      `+const password = "not-a-real-password-placeholder";\n`;

    expect(findSuspectedSecrets(diff)).toEqual([]);
  });

  it('ignores removed lines', () => {
    const diff = `${header}-export const key = "${FAKE.apiKey}";\n`;
    expect(findSuspectedSecrets(diff)).toEqual([]);
  });

  it('ignores ordinary code', () => {
    const diff = `${header}+export function total(lines: Line[]): number {\n+  return lines.length;\n+}\n`;
    expect(findSuspectedSecrets(diff)).toEqual([]);
  });

  it('groups multiple findings by file', () => {
    const diff =
      `${header}+const a = "${FAKE.awsKeyId}";\n` +
      `+const b = "${FAKE.githubToken}";\n`;
    const found = findSuspectedSecrets(diff);

    expect(found).toHaveLength(1);
    expect(found[0]?.kinds).toHaveLength(2);
  });
});
