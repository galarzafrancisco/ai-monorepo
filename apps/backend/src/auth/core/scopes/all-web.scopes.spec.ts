import { ALL_API_SCOPES } from './all-api.scopes';
import { ALL_WEB_SCOPES, SENSITIVE_WEB_SCOPES } from './all-web.scopes';

describe('ALL_WEB_SCOPES', () => {
  const webScopeIds = ALL_WEB_SCOPES.map((s) => s.id);

  it.each(['user:admin', 'installation:admin', 'run:impersonate', 'workers:connect'])(
    'leaves out %s',
    (scopeId) => {
      expect(webScopeIds).not.toContain(scopeId);
    },
  );

  it('keeps every other API scope', () => {
    const sensitiveIds = SENSITIVE_WEB_SCOPES.map((s) => s.id);
    const expected = ALL_API_SCOPES.map((s) => s.id).filter(
      (id) => !sensitiveIds.includes(id),
    );
    expect(webScopeIds).toEqual(expected);
  });
});
