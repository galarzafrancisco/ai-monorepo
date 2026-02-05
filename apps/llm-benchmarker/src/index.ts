#!/usr/bin/env node

import { Command } from 'commander';
import { BenchmarkConfig } from './types.js';
import { runBenchmark } from './benchmarker.js';
import { addResult, loadResults } from './storage.js';
import { displayResult, displayAllResults } from './reporter.js';

const program = new Command();

program
  .name('llm-bench')
  .description('Benchmark LLM models using OpenAI-compatible APIs')
  .version('0.0.1');

program
  .command('run')
  .description('Run a benchmark for a specific model')
  .requiredOption('-u, --base-url <url>', 'Base URL for the API')
  .requiredOption('-m, --model <name>', 'Model name')
  .requiredOption('-s, --server <server>', 'Server type (e.g., vLLM, llama.cpp)')
  .requiredOption('--size <size>', 'Model size (e.g., 30b, 120b)')
  .requiredOption('-q, --quant <quant>', 'Quantization (e.g., 8bit, NVFP4)')
  .requiredOption('-l, --link <link>', 'Model link (HuggingFace URL)')
  .option('-f, --format <format>', 'Model format (e.g., GGUF)')
  .option('-k, --api-key <key>', 'API key (optional)')
  .option('-o, --output <file>', 'Output file path', 'benchmark-results.json')
  .action(async (options) => {
    try {
      const config: BenchmarkConfig = {
        baseUrl: options.baseUrl,
        modelName: options.model,
        apiKey: options.apiKey,
        metadata: {
          server: options.server,
          modelSize: options.size,
          quantization: options.quant,
          modelLink: options.link,
          format: options.format,
        },
      };

      const result = await runBenchmark(config);
      await addResult(result, options.output);

      displayResult(result);

      console.log(`✓ Results saved to ${options.output}`);
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

program.parse();
