export interface SuspectedSecret {
  file: string;
  kinds: string[];
}

interface ValuePattern {
  kind: string;
  /** The first capture group must be the candidate value. */
  pattern: RegExp;
}

/**
 * Deliberately narrow: real credential shapes, not any string that happens to
 * contain the word "token". A wide pattern here would block honest commits.
 */
const VALUE_PATTERNS: ValuePattern[] = [
  { kind: 'AWS access key id', pattern: /\b(AKIA[0-9A-Z]{16})\b/g },
  { kind: 'GitHub token', pattern: /\b(gh[pousr]_[A-Za-z0-9]{20,})\b/g },
  { kind: 'Slack token', pattern: /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/g },
  {
    kind: 'Anthropic/OpenAI style key',
    pattern: /\b((?:sk|rk)-[A-Za-z0-9_-]{24,})\b/g,
  },
  { kind: 'Google API key', pattern: /\b(AIza[0-9A-Za-z_-]{35})\b/g },
  {
    kind: 'JWT',
    pattern:
      /\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g,
  },
  {
    kind: 'assigned secret literal',
    pattern:
      /(?:api[_-]?key|secret|passwd|password|access[_-]?token)["']?\s*[:=]\s*["']([^"'\s]{16,})["']/gi,
  },
];

const PRIVATE_KEY_START = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const BASE64_BODY = /[A-Za-z0-9+/]{40,}/;

/**
 * Test suites and documentation are full of fake keys. Flagging those would
 * block honest commits, so values that announce themselves as fake are skipped.
 */
const PLACEHOLDER_MARKERS =
  /example|sample|placeholder|dummy|fake|notreal|redacted|xxxx|abcd|1234|test/i;
const SEQUENTIAL_RUN = /abcdefghijklmnop|0123456789/;

export function isPlaceholderValue(value: string): boolean {
  return PLACEHOLDER_MARKERS.test(value) || SEQUENTIAL_RUN.test(value);
}

const FILE_HEADER = /^diff --git a\/.+? b\/(.+)$/;

interface AddedLine {
  file: string;
  text: string;
}

function collectAddedLines(diff: string): AddedLine[] {
  const lines: AddedLine[] = [];
  let currentFile = '(unknown file)';

  for (const line of diff.split('\n')) {
    const header = FILE_HEADER.exec(line);
    if (header) {
      currentFile = header[1] ?? currentFile;
      continue;
    }
    // Only added lines matter: that is what is about to be sent and committed.
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    lines.push({ file: currentFile, text: line });
  }

  return lines;
}

/**
 * Scans a unified diff for credential-looking content. Returns file names only,
 * never the matched text, so running this never prints a secret to the terminal.
 */
export function findSuspectedSecrets(diff: string): SuspectedSecret[] {
  const added = collectAddedLines(diff);
  const found = new Map<string, Set<string>>();

  const flag = (file: string, kind: string): void => {
    const kinds = found.get(file) ?? new Set<string>();
    kinds.add(kind);
    found.set(file, kinds);
  };

  added.forEach((line, index) => {
    for (const { kind, pattern } of VALUE_PATTERNS) {
      for (const match of line.text.matchAll(pattern)) {
        const value = match[1] ?? match[0];
        if (isPlaceholderValue(value)) continue;
        flag(line.file, kind);
      }
    }

    if (!PRIVATE_KEY_START.test(line.text)) return;

    // A lone header is a test fixture. A real key has base64 underneath it.
    const rest = line.text.replace(PRIVATE_KEY_START, '');
    const next = added[index + 1];
    const hasBody =
      BASE64_BODY.test(rest) ||
      (next !== undefined && BASE64_BODY.test(next.text));
    if (hasBody) flag(line.file, 'private key block');
  });

  return [...found.entries()].map(([file, kinds]) => ({
    file,
    kinds: [...kinds],
  }));
}
