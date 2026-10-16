import {
  CliUsageError,
  DEFAULT_CONCURRENCY,
  DEFAULT_SAMPLES,
  main,
  parseCliArgs,
  parseTarget,
  USAGE,
} from './cli';

function run(argv: string[]) {
  let out = '';
  let err = '';
  const code = main(argv, { out: (s) => (out += s), err: (s) => (err += s) });
  return { code, out, err };
}

describe('evals cli', () => {
  it('prints usage and exits 0 for --help', () => {
    const { code, out, err } = run(['--help']);
    expect(code).toBe(0);
    expect(out).toBe(USAGE);
    expect(err).toBe('');
  });

  it('accepts -h', () => {
    expect(run(['-h']).code).toBe(0);
  });

  it('uses defaults when no flags are given', () => {
    expect(parseCliArgs([])).toEqual({
      targets: [],
      cases: [],
      samples: DEFAULT_SAMPLES,
      concurrency: DEFAULT_CONCURRENCY,
      variants: [],
      variantOnly: false,
      saveBaseline: false,
      json: false,
      capture: false,
      help: false,
    });
  });

  it('collects repeatable and comma-separated flags', () => {
    const o = parseCliArgs([
      '--target',
      'chatgpt-plan:gpt-6-luna',
      '--target',
      'openai:gpt-5',
      '--case',
      'time-what-time-is-it,must-not',
      '--case',
      'control',
      '--variant',
      'legacy-single-namespace',
      '--variant',
      'drop-prompt-line:get_time',
      '--variant-only',
      '--samples',
      '20',
      '--concurrency',
      '2',
      '--save-baseline',
      '--json',
      '--capture',
    ]);
    expect(o.targets).toEqual(['chatgpt-plan:gpt-6-luna', 'openai:gpt-5']);
    expect(o.cases).toEqual(['time-what-time-is-it', 'must-not', 'control']);
    expect(o.variants).toEqual([
      'legacy-single-namespace',
      'drop-prompt-line:get_time',
    ]);
    expect(o).toMatchObject({
      samples: 20,
      concurrency: 2,
      variantOnly: true,
      saveBaseline: true,
      json: true,
      capture: true,
    });
  });

  it.each([
    [['--samples', '0']],
    [['--samples', 'ten']],
    [['--concurrency', '-1']],
    [['--target', 'nope:model']],
    [['--target', 'openai']],
    [['--variant-only']],
    [['--unknown']],
    [['positional']],
  ])('rejects %j with a usage error and exit 2', (argv) => {
    expect(() => parseCliArgs(argv)).toThrow(CliUsageError);
    const { code, err } = run(argv);
    expect(code).toBe(2);
    expect(err).toContain('Usage:');
  });

  it('keeps colons inside model ids', () => {
    expect(parseTarget('vertex:claude-x@2026:01')).toEqual({
      provider: 'vertex',
      modelId: 'claude-x@2026:01',
    });
  });
});
