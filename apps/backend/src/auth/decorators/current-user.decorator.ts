import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WebAuthJwtPayload } from '../types/jwt-payload.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WebAuthJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
