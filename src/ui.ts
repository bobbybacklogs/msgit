import { createInterface } from 'node:readline/promises';
import pc from 'picocolors';
import { MsgitError } from './errors.js';

const TAGLINE = 'The secret ingredient is MSG.';

export function printBanner(): void {
  const rule = pc.dim('─'.repeat(TAGLINE.length + 2));
  process.stdout.write(
    [
      '',
      `  ${pc.bold(pc.yellow('msgit'))}   🧂`,
      `  ${rule}`,
      `  ${pc.dim(TAGLINE)}`,
      '',
      '',
    ].join('\n'),
  );
}

export function step(text: string): void {
  process.stdout.write(`  ${text}\n`);
}

export function note(text: string): void {
  process.stdout.write(`  ${pc.dim(text)}\n`);
}

export function warn(text: string): void {
  process.stdout.write(`  ${pc.yellow('!')} ${pc.yellow(text)}\n`);
}

export function success(text: string): void {
  process.stdout.write(`  ${pc.green(text)}\n`);
}

export function fail(message: string, hint?: string): void {
  process.stderr.write(`\n  ${pc.red(message)}\n`);
  if (hint) process.stderr.write(`  ${pc.dim(hint)}\n`);
  process.stderr.write('\n');
}

function visibleLength(text: string): number {
  return text.length;
}

function wrap(text: string, width: number): string[] {
  if (text === '') return [''];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current === '') {
      current = word;
    } else if (visibleLength(current) + 1 + visibleLength(word) <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  lines.push(current);
  return lines;
}

function terminalWidth(): number {
  const columns = process.stdout.columns ?? 80;
  return Math.min(74, Math.max(40, columns - 6));
}

/**
 * Renders the generated commit in a box. Padding is computed on plain text and
 * colour is applied last, so the borders stay aligned.
 */
export function printPreview(message: string, modelLabel: string): void {
  const width = terminalWidth();
  const [subject = '', ...rest] = message.split('\n');
  const body = rest.join('\n').trim();

  const raw: string[] = wrap(subject, width);
  if (body !== '') {
    raw.push('');
    for (const line of body.split('\n')) {
      if (line === '') {
        raw.push('');
        continue;
      }
      raw.push(...wrap(line, width));
    }
  }

  const inner = Math.max(...raw.map(visibleLength), 20);
  const border = (left: string, right: string): string =>
    `  ${pc.dim(left + '─'.repeat(inner + 2) + right)}`;

  const out: string[] = ['', border('╭', '╮')];

  let inBody = false;
  for (const line of raw) {
    if (line === '') {
      inBody = true;
      out.push(`  ${pc.dim('│')} ${' '.repeat(inner)} ${pc.dim('│')}`);
      continue;
    }
    const padded = line.padEnd(inner, ' ');
    const rendered = inBody ? pc.dim(padded) : pc.bold(padded);
    out.push(`  ${pc.dim('│')} ${rendered} ${pc.dim('│')}`);
  }

  out.push(border('╰', '╯'));
  out.push(`  ${pc.dim(`model: ${modelLabel}`)}`);
  out.push('');

  process.stdout.write(`${out.join('\n')}\n`);
}

export interface ConfirmOptions {
  question: string;
  stdinIsTty: boolean;
}

export async function confirmCommit(
  options: ConfirmOptions,
): Promise<boolean> {
  if (!options.stdinIsTty) {
    throw new MsgitError(
      'HAIYAA. This terminal cannot answer questions, nephew.',
      {
        hint: 'Pass --yes to commit straight away, or --dry-run to only look at the message.',
      },
    );
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(`  ${options.question} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
