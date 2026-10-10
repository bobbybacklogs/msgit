export const CONVENTIONAL_TYPES = [
  'feat',
  'fix',
  'refactor',
  'docs',
  'test',
  'chore',
  'perf',
  'build',
  'ci',
  'style',
  'revert',
] as const;

export type ConventionalType = (typeof CONVENTIONAL_TYPES)[number];

export interface CommitParts {
  type: ConventionalType;
  scope: string | undefined;
  subject: string;
  body: string | undefined;
}

export interface ParseResult {
  parts: CommitParts;
  /** Non-fatal things the user should know: adjusted type, overlong subject, missing body. */
  warnings: string[];
}

const TYPE_SET = new Set<string>(CONVENTIONAL_TYPES);

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Pulls the first JSON object out of a model reply. Models like to wrap JSON in
 * prose or fences even when told not to, so strip both before giving up.
 */
export function extractJsonObject(raw: string): unknown {
  const withoutFences = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const candidates = [withoutFences];
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start !== -1 && end > start) {
    candidates.push(withoutFences.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed !== null && typeof parsed === 'object') return parsed;
    } catch {
      // Try the next candidate.
    }
  }

  return undefined;
}

/**
 * Falls back to reading the reply as a plain commit message when JSON parsing
 * fails, so one bad response does not throw away a usable message.
 */
function parsePlainText(raw: string): { subject: string; body: string } {
  const lines = raw.trim().split('\n');
  const subject = (lines[0] ?? '').trim();
  const body = lines.slice(1).join('\n').trim();
  return { subject, body };
}

const CONVENTIONAL_PREFIX = /^([a-z]+)(?:\(([^)]*)\))?!?:\s*/;

function splitPrefix(subject: string): {
  type: string | undefined;
  scope: string | undefined;
  rest: string;
} {
  const match = CONVENTIONAL_PREFIX.exec(subject);
  if (!match) return { type: undefined, scope: undefined, rest: subject };
  return {
    type: match[1],
    scope: match[2],
    rest: subject.slice(match[0].length).trim(),
  };
}

export interface NormalizeOptions {
  maxSubjectLength: number;
}

export function normalizeCommit(
  raw: string,
  options: NormalizeOptions,
): ParseResult {
  const warnings: string[] = [];
  const parsed = extractJsonObject(raw);

  let type = '';
  let scope: string | undefined;
  let subject = '';
  let body = '';

  if (parsed !== undefined && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    type = cleanText(record['type']).toLowerCase();
    scope = cleanText(record['scope']).toLowerCase() || undefined;
    subject = cleanText(record['subject']);
    body = cleanText(record['body']);
  } else {
    const fallback = parsePlainText(raw);
    const split = splitPrefix(fallback.subject);
    if (split.type === undefined) {
      // Prose, an apology, or an explanation. Not a commit message.
      throw new Error('UNPARSEABLE_REPLY');
    }
    type = split.type;
    scope = split.scope?.trim().toLowerCase() || undefined;
    subject = split.rest;
    body = fallback.body;
    warnings.push('Model did not return JSON. Read the reply as plain text.');
  }

  // The model sometimes repeats the prefix inside the subject.
  const splitSubject = splitPrefix(subject);
  if (splitSubject.type !== undefined) {
    if (type === '') type = splitSubject.type;
    if (scope === undefined && splitSubject.scope) {
      scope = splitSubject.scope.trim().toLowerCase();
    }
    subject = splitSubject.rest;
  }

  type = type.replace(/[^a-z]/g, '');
  if (!TYPE_SET.has(type)) {
    warnings.push(
      type === ''
        ? 'Model did not report a commit type. Using "chore".'
        : `Model reported unknown type "${type}". Using "chore".`,
    );
    type = 'chore';
  }

  subject = subject.replace(/\s+/g, ' ').replace(/\.+$/, '').trim();
  if (subject === '') {
    throw new Error('EMPTY_SUBJECT');
  }

  const prefix = `${type}${scope ? `(${scope})` : ''}: `;
  const fullLength = prefix.length + subject.length;
  if (fullLength > options.maxSubjectLength) {
    warnings.push(
      `First line is ${fullLength} characters, over the ${options.maxSubjectLength} limit.`,
    );
  }

  const bodyLines = body
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line, index, all) => !(line === '' && all[index - 1] === ''));

  return {
    parts: {
      type: type as ConventionalType,
      scope,
      subject,
      body: bodyLines.join('\n').trim() || undefined,
    },
    warnings,
  };
}

export function formatSubject(parts: CommitParts): string {
  const scope = parts.scope ? `(${parts.scope})` : '';
  return `${parts.type}${scope}: ${parts.subject}`;
}

export function formatCommitMessage(parts: CommitParts): string {
  const subject = formatSubject(parts);
  return parts.body ? `${subject}\n\n${parts.body}` : subject;
}
