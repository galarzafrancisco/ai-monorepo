import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { EXECUTION_ID_HEADER } from '../constants/headers.constants';

export const CurrentExecutionId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const executionId = request.headers[EXECUTION_ID_HEADER];
    return executionId || undefined;
  },
);
