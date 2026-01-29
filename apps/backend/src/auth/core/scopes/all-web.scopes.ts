import { Scope } from '../types/scope.type';
import { ALL_API_SCOPES } from './all-api.scopes';
import { ALL_USER_SCOPES } from './user.scopes';

export const ALL_WEB_SCOPES: readonly Scope[] = [
  ...ALL_USER_SCOPES,
  ...ALL_API_SCOPES,
];
