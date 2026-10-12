import { DEFAULT_SEARCH_SETTINGS, resolveSearchSettings } from './search-settings';

describe('resolveSearchSettings', () => {
  it('returns the defaults when nothing is stored', () => {
    expect(resolveSearchSettings(undefined)).toEqual(DEFAULT_SEARCH_SETTINGS);
    expect(resolveSearchSettings(null)).toEqual(DEFAULT_SEARCH_SETTINGS);
    expect(resolveSearchSettings({})).toEqual(DEFAULT_SEARCH_SETTINGS);
  });

  it('overlays stored values on the defaults', () => {
    const settings = resolveSearchSettings({
      semanticEnabled: false,
      rrfK: 10,
      queryInstruction: '  ',
    });

    expect(settings).toEqual({
      ...DEFAULT_SEARCH_SETTINGS,
      semanticEnabled: false,
      rrfK: 10,
      queryInstruction: '',
    });
  });

  it('ignores unknown keys and values of the wrong type or out of bounds', () => {
    const settings = resolveSearchSettings({
      someFutureSetting: 1,
      semanticEnabled: 'yes',
      rrfK: 0,
      chunkSizeChars: 12.5,
      semanticMinSimilarity: 7,
      defaultLimit: Number.NaN,
    });

    expect(settings).toEqual(DEFAULT_SEARCH_SETTINGS);
  });

  it('never lets the overlap exceed half a passage', () => {
    const settings = resolveSearchSettings({ chunkSizeChars: 400, chunkOverlapChars: 1000 });
    expect(settings.chunkOverlapChars).toBe(200);
  });
});
