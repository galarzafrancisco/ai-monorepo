// auth.decorator.ts
import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import { AuthContext } from './auth.types';

export const Auth = createParamDecorator((data: unknown, ctx: ExecutionContext): AuthContext => {
  const res = ctx.switchToHttp().getResponse<Response>();
  if (!res.locals.auth) throw new UnauthorizedException('Auth context missing');
  return res.locals.auth;
});
