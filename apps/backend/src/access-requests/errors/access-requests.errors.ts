import { ErrorCodes } from '@taico/errors';

export class AccessRequestNotFoundError extends Error {
  readonly code = ErrorCodes.ACCESS_REQUEST_NOT_FOUND;

  constructor(id: string) {
    super(`Access request ${id} not found`);
    this.name = 'AccessRequestNotFoundError';
  }
}

/** The best-effort, in-process submission ceiling was hit. */
export class AccessRequestsBusyError extends Error {
  readonly code = ErrorCodes.ACCESS_REQUESTS_BUSY;

  constructor() {
    super('We are receiving a lot of requests right now. Please try again later.');
    this.name = 'AccessRequestsBusyError';
  }
}
