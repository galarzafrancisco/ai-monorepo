/**
 * Entry point for `npm run eval`.
 *
 * For now this only parses and prints the options. The runner (S6) plugs in
 * where `main` prints them.
 */
import { parseArgs } from 'node:util';
import {
  CliOptions,
  EXIT_CODES,
  PROVIDERS,
  Provider,
  TargetSpec,
} from './core/types';

export const DEFAULT_SAMPLES = 10;
export const DEFAULT_CONCURRENCY = 4;

export const USAGE = `Usage: npm run eval -- [options]

Runs the threads agent eval cases against real models.

Options:
  --target <provider:model>  Target to run (repeatable). Providers: ${PROVIDERS.join(', ')}.
                             Default: every available target in evals/targets.default.json.
  --case <id|tag>[,...]      Only run cases with these ids or tags (repeatable).
  --samples <n>              Samples per case (default ${DEFAULT_SAMPLES}). A case's own minimum wins.
  --concurrency <n>          Concurrent samples per target (default ${DEFAULT_CONCURRENCY}).
  --variant <name>           Also run this variant side by side with the baseline (repeatable).
  --variant-only             Skip the no-variant run.
  --save-baseline            Write baselines for the no-variant run.
  --json                     Print the report as JSON.
  --capture                  Write request bodies (fake ids only, no headers) for debugging.
  --help                     Show this help.

Exit codes: 0 every gate passed, 1 a gate failed, 2 inconclusive or infrastructure error.
`;

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

function positiveInt(
  flag: string,
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new CliUsageError(
      `--${flag} must be a positive integer, got "${value}"`,
    );
  }
  return Number(value);
}

/** Splits `a,b` values and drops empties, so `--case 1,2 --case time` works. */
function splitList(values: string[] | undefined): string[] {
  return (values ?? [])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/** Parses `provider:model`. The model id may itself contain colons. */
export function parseTarget(value: string): TargetSpec {
  const idx = value.indexOf(':');
  const provider = idx === -1 ? value : value.slice(0, idx);
  const modelId = idx === -1 ? '' : value.slice(idx + 1);
  if (!(PROVIDERS as readonly string[]).includes(provider)) {
    throw new CliUsageError(
      `Unknown provider "${provider}" in --target "${value}". Expected one of: ${PROVIDERS.join(', ')}`,
    );
  }
  if (!modelId) {
    throw new CliUsageError(`--target "${value}" must be provider:model`);
  }
  return { provider: provider as Provider, modelId };
}

function rawParse(argv: string[]) {
  return parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      target: { type: 'string', multiple: true },
      case: { type: 'string', multiple: true },
      samples: { type: 'string' },
      concurrency: { type: 'string' },
      variant: { type: 'string', multiple: true },
      'variant-only': { type: 'boolean', default: false },
      'save-baseline': { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      capture: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
}

export function parseCliArgs(argv: string[]): CliOptions {
  let parsed: ReturnType<typeof rawParse>;
  try {
    parsed = rawParse(argv);
  } catch (e) {
    throw new CliUsageError((e as Error).message);
  }
  const v = parsed.values;

  const options: CliOptions = {
    targets: splitList(v.target),
    cases: splitList(v.case),
    samples: positiveInt('samples', v.samples, DEFAULT_SAMPLES),
    concurrency: positiveInt('concurrency', v.concurrency, DEFAULT_CONCURRENCY),
    variants: splitList(v.variant),
    variantOnly: v['variant-only'] ?? false,
    saveBaseline: v['save-baseline'] ?? false,
    json: v.json ?? false,
    capture: v.capture ?? false,
    help: v.help ?? false,
  };

  if (options.help) return options;

  options.targets.forEach(parseTarget);
  if (options.variantOnly && options.variants.length === 0) {
    throw new CliUsageError('--variant-only needs at least one --variant');
  }
  return options;
}

export type CliIo = {
  out: (s: string) => void;
  err: (s: string) => void;
};

/** Returns the process exit code. */
export function main(argv: string[], io: CliIo): number {
  let options: CliOptions;
  try {
    options = parseCliArgs(argv);
  } catch (e) {
    if (e instanceof CliUsageError) {
      io.err(`${e.message}\n\n${USAGE}`);
      return EXIT_CODES.inconclusive;
    }
    throw e;
  }

  if (options.help) {
    io.out(USAGE);
    return EXIT_CODES.ok;
  }

  // TODO(S6): hand the options to the runner.
  io.out(
    `Parsed options (the runner is not implemented yet):\n${JSON.stringify(options, null, 2)}\n`,
  );
  return EXIT_CODES.ok;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2), {
    out: (s) => process.stdout.write(s),
    err: (s) => process.stderr.write(s),
  });
}
