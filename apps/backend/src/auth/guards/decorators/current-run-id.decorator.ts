import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RUN_ID_HEADER } from '../constants/headers.constants';

export const CurrentRunId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const runId = request.headers[RUN_ID_HEADER];
    return runId || undefined;
  },
);
