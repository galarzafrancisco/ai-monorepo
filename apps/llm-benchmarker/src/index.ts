#!/usr/bin/env node

import { Command } from 'commander';
import * as readline from 'readline';
import { BenchmarkConfig } from './types.js';
import { runBenchmark } from './benchmarker.js';
import { addResult, loadResults } from './storage.js';
import { displayResult, displayAllResults } from './reporter.js';

interface PromptConfig {
  name: string;
  message: string;
  default?: string;
  required?: boolean;
}

/**
 * Prompt user for input
 */
function prompt(rl: readline.Interface, config: PromptConfig): Promise<string> {
  return new Promise((resolve) => {
    const defaultText = config.default ? ` (${config.default})` : '';
    const requiredText = config.required ? ' *' : '';
    rl.question(`${config.message}${defaultText}${requiredText}: `, (answer) => {
      const value = answer.trim() || config.default || '';
      resolve(value);
    });
  });
}

/**
 * Interactive guided setup for benchmark configuration
 */
async function guidedSetup(options: Record<string, string | undefined>): Promise<{
  baseUrl: string;
  model: string;
  server: string;
  size: string;
  quant: string;
  link: string;
  format?: string;
  apiKey?: string;
  output: string;
}> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n🚀 LLM Benchmarker - Guided Setup\n');
  console.log('Fields marked with * are required. Press Enter to use default values.\n');

  try {
    const baseUrl = options.baseUrl || await prompt(rl, {
      name: 'baseUrl',
      message: 'API Base URL',
      default: 'http://localhost:8000/v1',
      required: true,
    });

    const model = options.model || await prompt(rl, {
      name: 'model',
      message: 'Model name',
      required: true,
    });

    const server = options.server || await prompt(rl, {
      name: 'server',
      message: 'Server type (vLLM, llama.cpp, TRT, etc.)',
      required: true,
    });

    const size = options.size || await prompt(rl, {
      name: 'size',
      message: 'Model size (e.g., 7b, 30b, 70b, 120b)',
      required: true,
    });

    const quant = options.quant || await prompt(rl, {
      name: 'quant',
      message: 'Quantization (e.g., fp16, 8bit, 4bit, NVFP4)',
      required: true,
    });

    const link = options.link || await prompt(rl, {
      name: 'link',
      message: 'Model link (HuggingFace URL)',
      required: true,
    });

    const format = options.format || await prompt(rl, {
      name: 'format',
      message: 'Model format (GGUF, safetensors, etc.)',
    });

    const apiKey = options.apiKey || await prompt(rl, {
      name: 'apiKey',
      message: 'API key (leave empty if not needed)',
    });

    const output = options.output || await prompt(rl, {
      name: 'output',
      message: 'Output file',
      default: 'benchmark-results.json',
    });

    rl.close();

    // Validate required fields
    const missing: string[] = [];
    if (!model) missing.push('model');
    if (!server) missing.push('server');
    if (!size) missing.push('size');
    if (!quant) missing.push('quant');
    if (!link) missing.push('link');

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    return {
      baseUrl,
      model,
      server,
      size,
      quant,
      link,
      format: format || undefined,
      apiKey: apiKey || undefined,
      output,
    };
  } catch (error) {
    rl.close();
    throw error;
  }
}

const program = new Command();

program
  .name('llm-bench')
  .description('Benchmark LLM models using OpenAI-compatible APIs')
  .version('0.0.1');

program
  .command('run')
  .description('Run a benchmark for a specific model')
  .option('-u, --base-url <url>', 'Base URL for the API')
  .option('-m, --model <name>', 'Model name')
  .option('-s, --server <server>', 'Server type (e.g., vLLM, llama.cpp)')
  .option('--size <size>', 'Model size (e.g., 30b, 120b)')
  .option('-q, --quant <quant>', 'Quantization (e.g., 8bit, NVFP4)')
  .option('-l, --link <link>', 'Model link (HuggingFace URL)')
  .option('-f, --format <format>', 'Model format (e.g., GGUF)')
  .option('-k, --api-key <key>', 'API key (optional)')
  .option('-o, --output <file>', 'Output file path', 'benchmark-results.json')
  .action(async (options) => {
    try {
      // Use guided setup to fill in missing options
      const config = await guidedSetup(options);

      const benchmarkConfig: BenchmarkConfig = {
        baseUrl: config.baseUrl,
        modelName: config.model,
        apiKey: config.apiKey,
        metadata: {
          server: config.server,
          modelSize: config.size,
          quantization: config.quant,
          modelLink: config.link,
          format: config.format,
        },
      };

      const result = await runBenchmark(benchmarkConfig);
      await addResult(result, config.output);

      displayResult(result);

      console.log(`✓ Results saved to ${config.output}`);
    } catch (error) {
      console.error('Error running benchmark:', error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all benchmark results')
  .option('-i, --input <file>', 'Input file path', 'benchmark-results.json')
  .action(async (options) => {
    try {
      const storage = await loadResults(options.input);
      displayAllResults(storage);
    } catch (error) {
      console.error('Error loading results:', error);
      process.exit(1);
    }
  });

// Default to 'run' command if no command specified
if (process.argv.length === 2) {
  process.argv.push('run');
}

program.parse();
