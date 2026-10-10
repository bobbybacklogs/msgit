import { MsgitError } from './errors.js';

export interface MsgitConfig {
  /** ModelHitch bridge base URL, including the /v1 suffix. */
  baseUrl: string;
  /** Model id sent to the bridge. Undefined lets ModelHitch pick its own rotation target. */
  model: string | undefined;
  /** Optional bearer token, for a bridge started with auth. */
  apiKey: string | undefined;
  timeoutMs: number;
  maxDiffChars: number;
  /** Applies to the assembled first line, including the "type(scope): " prefix. */
  maxSubjectLength: number;
}

export const DEFAULT_BASE_URL = 'http://127.0.0.1:3939/v1';
export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_DIFF_CHARS = 120_000;
export const DEFAULT_MAX_SUBJECT_LENGTH = 72;

function readPositiveInt(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new MsgitError(
      `HAIYAA. ${name} must be a positive whole number, not "${raw}".`,
    );
  }
  return value;
}

function resolveBaseUrl(env: NodeJS.ProcessEnv): string {
  const explicit = env['MSGIT_BASE_URL'] ?? env['MODELHITCH_BASE_URL'];
  if (explicit && explicit.trim() !== '') return explicit.trim();

  const port = env['MODELHITCH_PORT'];
  if (port && port.trim() !== '') {
    const host = env['MODELHITCH_HOST'] ?? '127.0.0.1';
    return `http://${host}:${port.trim()}/v1`;
  }

  return DEFAULT_BASE_URL;
}

function readModel(env: NodeJS.ProcessEnv): string | undefined {
  const raw = env['MSGIT_MODEL'] ?? env['MODELHITCH_MODEL'];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

function readApiKey(env: NodeJS.ProcessEnv): string | undefined {
  const raw = env['MSGIT_API_KEY'] ?? env['MODELHITCH_API_KEY'];
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): MsgitConfig {
  return {
    baseUrl: resolveBaseUrl(env),
    model: readModel(env),
    apiKey: readApiKey(env),
    timeoutMs: readPositiveInt(env, 'MSGIT_TIMEOUT_MS', DEFAULT_TIMEOUT_MS),
    maxDiffChars: readPositiveInt(
      env,
      'MSGIT_MAX_DIFF_CHARS',
      DEFAULT_MAX_DIFF_CHARS,
    ),
    maxSubjectLength: readPositiveInt(
      env,
      'MSGIT_MAX_SUBJECT_LENGTH',
      DEFAULT_MAX_SUBJECT_LENGTH,
    ),
  };
}
