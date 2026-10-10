import { spawn } from 'node:child_process';
import { MsgitError } from './errors.js';

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface GitRunOptions {
  cwd?: string;
  /** Written to the child's stdin. Used to pass commit messages without shell quoting. */
  input?: string;
}

/**
 * Runs git with a fixed argument array. No shell, ever: diff content and file
 * names never reach a command interpreter.
 */
export function runGit(
  args: string[],
  options: GitRunOptions = {},
): Promise<GitResult> {
  const { cwd = process.cwd(), input } = options;

  return new Promise<GitResult>((resolve, reject) => {
    const child = spawn('git', args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(
          new MsgitError('HAIYAA. Where is git? Uncle cannot find it.', {
            hint: 'Install Git and make sure `git --version` works.',
          }),
        );
        return;
      }
      reject(error);
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });

    child.stdin.end(input ?? '');
  });
}

export interface RepoInfo {
  root: string;
  branch: string | undefined;
  lastCommitSubject: string | undefined;
}

export async function readRepoInfo(cwd: string): Promise<RepoInfo> {
  const root = await runGit(['rev-parse', '--show-toplevel'], { cwd });
  if (root.code !== 0) {
    throw new MsgitError('HAIYAA. This not a Git kitchen.', {
      hint: 'Run msgit inside a Git repository. No repo, no cooking.',
    });
  }

  const branchResult = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd,
  });
  // An empty repository has no commits yet, so HEAD does not resolve. That is fine.
  const logResult = await runGit(['log', '-1', '--pretty=%s'], { cwd });

  const branch = branchResult.code === 0 ? branchResult.stdout.trim() : '';
  const lastCommitSubject = logResult.code === 0 ? logResult.stdout.trim() : '';

  return {
    root: root.stdout.trim(),
    branch: branch === '' ? undefined : branch,
    lastCommitSubject: lastCommitSubject === '' ? undefined : lastCommitSubject,
  };
}

export async function hasStagedChanges(cwd: string): Promise<boolean> {
  // `git diff --cached --quiet` exits 1 when there is a diff and 0 when there is not.
  const result = await runGit(['diff', '--cached', '--quiet'], { cwd });
  if (result.code === 0) return false;
  if (result.code === 1) return true;

  throw new MsgitError('HAIYAA. Git refused to read the staged changes.', {
    hint: result.stderr.trim() || 'Check `git status` and try again.',
  });
}

export interface StagedChanges {
  diff: string;
  files: string[];
}

const DIFF_ARGS = [
  'diff',
  '--cached',
  '--no-color',
  '--no-ext-diff',
  // Git only honours GIT_EXTERNAL_DIFF / diff.external when this is on.
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '--unified=3',
];

export async function readStagedChanges(cwd: string): Promise<StagedChanges> {
  const diffResult = await runGit(DIFF_ARGS, { cwd });
  if (diffResult.code !== 0) {
    throw new MsgitError('HAIYAA. Git refused to read the staged changes.', {
      hint: diffResult.stderr.trim() || 'Check `git status` and try again.',
    });
  }

  const nameResult = await runGit(['diff', '--cached', '--name-only'], { cwd });
  const files = nameResult.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  return { diff: diffResult.stdout, files };
}

export async function commit(message: string, cwd: string): Promise<string> {
  const result = await runGit(
    ['commit', '--cleanup=strip', '--file=-'],
    { cwd, input: message },
  );

  if (result.code !== 0) {
    throw new MsgitError('HAIYAA. The commit did not go through.', {
      hint:
        (result.stderr.trim() || result.stdout.trim()) ||
        'A hook or a Git setting rejected the commit.',
    });
  }

  // `git commit` prints "[main 1a2b3c4] subject" on the first line.
  const firstLine = result.stdout.split('\n')[0]?.trim() ?? '';
  return firstLine;
}
