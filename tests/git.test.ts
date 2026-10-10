import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MsgitError } from '../src/errors.js';
import {
  commit,
  hasStagedChanges,
  readRepoInfo,
  readStagedChanges,
  runGit,
} from '../src/git.js';

let dir: string;

async function git(args: string[], cwd = dir): Promise<string> {
  const result = await runGit(args, { cwd });
  if (result.code !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function write(relativePath: string, content: string): void {
  const target = path.join(dir, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'msgit-git-'));
  await git(['init', '-q', '-b', 'main']);
  await git(['config', 'user.email', 'msgit@example.test']);
  await git(['config', 'user.name', 'msgit test']);
  await git(['config', 'commit.gpgsign', 'false']);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('readRepoInfo', () => {
  it('reports the root and tolerates a repository with no commits', async () => {
    const repo = await readRepoInfo(dir);

    expect(path.resolve(repo.root)).toBe(path.resolve(dir));
    expect(repo.lastCommitSubject).toBeUndefined();
  });

  it('reports the branch and the last commit subject', async () => {
    write('a.txt', 'hello\n');
    await git(['add', '-A']);
    await git(['commit', '-q', '-m', 'chore: seed']);

    const repo = await readRepoInfo(dir);

    expect(repo.branch).toBe('main');
    expect(repo.lastCommitSubject).toBe('chore: seed');
  });

  it('refuses a directory that is not a repository', async () => {
    await expect(readRepoInfo(tmpdir())).rejects.toBeInstanceOf(MsgitError);
  });
});

describe('staged changes', () => {
  it('reports nothing staged on a clean tree', async () => {
    write('a.txt', 'hello\n');
    await git(['add', '-A']);
    await git(['commit', '-q', '-m', 'chore: seed']);

    expect(await hasStagedChanges(dir)).toBe(false);
  });

  it('reports staged changes after git add', async () => {
    write('a.txt', 'hello\n');
    await git(['add', '-A']);

    expect(await hasStagedChanges(dir)).toBe(true);
  });

  it('reads the diff and the staged file list', async () => {
    write('a.txt', 'hello\n');
    await git(['add', '-A']);
    write('b.ts', 'export const msg = "seasoning";\n');
    await git(['add', '-A']);

    const staged = await readStagedChanges(dir);

    expect(staged.files.sort()).toEqual(['a.txt', 'b.ts']);
    expect(staged.diff).toContain('+export const msg = "seasoning";');
    expect(staged.diff).toContain('new file mode');
  });
});

describe('commit', () => {
  it('creates a commit that keeps the subject and the body', async () => {
    write('a.txt', 'hello\n');
    await git(['add', '-A']);

    await commit('feat(test): add a file\n\nnephew finally add file.', dir);

    const body = await git(['log', '-1', '--pretty=%B']);
    expect(body.trim()).toBe('feat(test): add a file\n\nnephew finally add file.');
  });

  it('works from a subdirectory', async () => {
    write('src/deep/a.ts', 'export const x = 1;\n');
    await git(['add', '-A']);
    await git(['commit', '-q', '-m', 'chore: seed']);

    write('src/deep/a.ts', 'export const x = 2;\n');
    await git(['add', '-A']);

    const subdirectory = path.join(dir, 'src', 'deep');
    const staged = await readStagedChanges(subdirectory);
    expect(staged.diff).toContain('+export const x = 2;');

    await commit('fix(deep): bump x', subdirectory);
    expect(await git(['log', '-1', '--pretty=%s'])).toContain('fix(deep): bump x');
  });

  it('surfaces a git failure as a MsgitError', async () => {
    await expect(commit('chore: nothing to commit', dir)).rejects.toBeInstanceOf(
      MsgitError,
    );
  });
});
