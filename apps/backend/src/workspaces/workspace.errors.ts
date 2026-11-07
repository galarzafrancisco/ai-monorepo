import { ErrorCodes } from '@taico/errors';

/** A row or entry point is in a workspace the caller is not in. Answers 404, like any row of another workspace. */
export class NotInWorkspaceError extends Error {
  readonly code = ErrorCodes.NOT_IN_WORKSPACE;
  constructor() {
    super('Not found');
    this.name = NotInWorkspaceError.name;
  }
}
