import { describe, expect, it } from 'vitest';
import { authTypeForNewTool, authTypeFromSwitch, usesTaicoAuth } from './toolAuth';

describe('tool auth switch', () => {
  it('reads Taico auth as on, external as off, and missing as on', () => {
    expect(usesTaicoAuth({ authType: 'taico' })).toBe(true);
    expect(usesTaicoAuth({ authType: 'external' })).toBe(false);
    expect(usesTaicoAuth({})).toBe(true);
    expect(usesTaicoAuth(null)).toBe(true);
  });

  it('maps the switch to an auth type', () => {
    expect(authTypeFromSwitch(true)).toBe('taico');
    expect(authTypeFromSwitch(false)).toBe('external');
  });

  it('registers HTTP tools with the switch value and stdio tools with Taico', () => {
    expect(authTypeForNewTool('http', true)).toBe('taico');
    expect(authTypeForNewTool('http', false)).toBe('external');
    expect(authTypeForNewTool('stdio', false)).toBe('taico');
  });
});
