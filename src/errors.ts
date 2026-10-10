/**
 * Every error msgit shows the user on purpose is a MsgitError.
 * Anything else is a bug and gets the stack trace treatment.
 */
export interface MsgitErrorOptions {
  /** A second line telling the user what to do about it. */
  hint?: string;
  exitCode?: number;
}

export class MsgitError extends Error {
  readonly hint: string | undefined;
  readonly exitCode: number;

  constructor(message: string, options: MsgitErrorOptions = {}) {
    super(message);
    this.name = 'MsgitError';
    this.hint = options.hint;
    this.exitCode = options.exitCode ?? 1;
  }
}
