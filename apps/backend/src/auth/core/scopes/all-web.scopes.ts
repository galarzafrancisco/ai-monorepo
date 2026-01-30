import { Scope } from '../types/scope.type';
import { ALL_API_SCOPES } from './all-api.scopes';

export const ALL_WEB_SCOPES: readonly Scope[] = [
  ...ALL_API_SCOPES,
];
