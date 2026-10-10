import { describe, expect, it } from 'vitest';

import {
  extractJsonObject,
  formatCommitMessage,
  formatSubject,
  normalizeCommit,
} from '../src/conventional.js';

const OPTIONS = { maxSubjectLength: 72 };

describe('extractJsonObject', () => {
  it('reads a bare JSON object', () => {
    expect(extractJsonObject('{"type":"fix"}')).toEqual({ type: 'fix' });
  });

  it('reads JSON wrapped in a markdown fence', () => {
    expect(extractJsonObject('```json\n{"type":"feat"}\n```')).toEqual({
      type: 'feat',
    });
  });

  it('reads JSON surrounded by model chatter', () => {
    expect(
      extractJsonObject('Sure! {"type":"docs","subject":"x"} hope that helps'),
    ).toEqual({ type: 'docs', subject: 'x' });
  });

  it('returns undefined for text with no object', () => {
    expect(extractJsonObject('no json here')).toBeUndefined();
  });
});

describe('normalizeCommit', () => {
  it('normalises a well-formed reply', () => {
    const { parts, warnings } = normalizeCommit(
      '{"type":"fix","scope":"auth","subject":"check expiry before trusting a session","body":"nephew finally check the date."}',
      OPTIONS,
    );

    expect(warnings).toEqual([]);
    expect(parts).toEqual({
      type: 'fix',
      scope: 'auth',
      subject: 'check expiry before trusting a session',
      body: 'nephew finally check the date.',
    });
    expect(formatCommitMessage(parts)).toBe(
      'fix(auth): check expiry before trusting a session\n\nnephew finally check the date.',
    );
  });

  it('drops a scope that the model sent as null', () => {
    const { parts } = normalizeCommit(
      '{"type":"chore","scope":null,"subject":"bump node","body":""}',
      OPTIONS,
    );

    expect(parts.scope).toBeUndefined();
    expect(parts.body).toBeUndefined();
    expect(formatSubject(parts)).toBe('chore: bump node');
  });

  it('strips a prefix the model repeated in the subject', () => {
    const { parts } = normalizeCommit(
      '{"type":"feat","subject":"feat(cart): add discounts","body":""}',
      OPTIONS,
    );

    expect(parts.type).toBe('feat');
    expect(parts.scope).toBe('cart');
    expect(formatSubject(parts)).toBe('feat(cart): add discounts');
  });

  it('falls back to plain text when the reply is not JSON', () => {
    const { parts, warnings } = normalizeCommit(
      'fix(api): stop retrying when the queue is empty\n\nhaiyaa.',
      OPTIONS,
    );

    expect(parts.type).toBe('fix');
    expect(parts.scope).toBe('api');
    expect(parts.subject).toBe('stop retrying when the queue is empty');
    expect(parts.body).toBe('haiyaa.');
    expect(warnings).toHaveLength(1);
  });

  it('rejects prose that is not a commit message at all', () => {
    expect(() =>
      normalizeCommit('Sorry, I cannot help with that request.', OPTIONS),
    ).toThrowError('UNPARSEABLE_REPLY');
  });

  it('replaces an unknown type with chore and says so', () => {
    const { parts, warnings } = normalizeCommit(
      '{"type":"improvement","subject":"tidy imports","body":""}',
      OPTIONS,
    );

    expect(parts.type).toBe('chore');
    expect(warnings.join(' ')).toContain('improvement');
  });

  it('warns when the first line is over the limit', () => {
    const { warnings } = normalizeCommit(
      `{"type":"feat","subject":"${'x'.repeat(90)}","body":""}`,
      OPTIONS,
    );

    expect(warnings.join(' ')).toContain('over the 72 limit');
  });

  it('trims trailing whitespace and periods from the subject', () => {
    const { parts } = normalizeCommit(
      '{"type":"docs","subject":"  update the readme.  ","body":""}',
      OPTIONS,
    );

    expect(parts.subject).toBe('update the readme');
  });

  it('throws when there is no usable subject', () => {
    expect(() =>
      normalizeCommit('{"type":"feat","subject":"   ","body":""}', OPTIONS),
    ).toThrowError('EMPTY_SUBJECT');
  });
});
