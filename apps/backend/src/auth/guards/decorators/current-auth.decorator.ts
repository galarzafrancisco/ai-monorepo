import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Response } from 'express';
import { type AuthContext } from '../context/auth-context.types';

export const CurrentAuth = createParamDecorator(
  (data: unknown, context: ExecutionContext): AuthContext => {
    const res = context.switchToHttp().getResponse<Response>();
    const authCtx = res.locals.auth as AuthContext;
    return authCtx;
  },
);
