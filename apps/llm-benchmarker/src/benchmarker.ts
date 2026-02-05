import OpenAI from 'openai';
import {
  BenchmarkConfig,
  BenchmarkResult,
  SingleRequestResult,
  MultiRequestResult,
} from './types.js';

/**
 * Count words in a text string
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Run a warmup request to ensure GPU is ready and model is loaded
 */
async function runWarmupRequest(
  client: OpenAI,
  modelName: string,
): Promise<void> {
  await client.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: 'user',
        content: 'Say hello.',
      },
    ],
    max_tokens: 10,
  });
}

/**
 * Run a single benchmark request
 */
async function runSingleRequest(
  client: OpenAI,
  modelName: string,
): Promise<SingleRequestResult> {
  const startTime = Date.now();

  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      {
        role: 'user',
        content: 'Write a detailed and engaging story about a group of scientists who discover a hidden underground civilization while drilling for geothermal energy. Include vivid descriptions of the civilization, its culture, technology, and the interactions between the scientists and the inhabitants. Make it at least 2000 words.',
      },
    ],
    temperature: 0.7,
    max_tokens: 20000,
  });

  const endTime = Date.now();
  const latencyMs = endTime - startTime;

  const responseText = response.choices[0]?.message?.content || '';
  const wordCount = countWords(responseText);
  const wordsPerSecond = (wordCount / latencyMs) * 1000;

  return {
    latencyMs,
    wordCount,
    wordsPerSecond,
    responseText,
  };
}

/**
 * Run multiple concurrent benchmark requests
 */
async function runMultiRequest(
  client: OpenAI,
  modelName: string,
  numRequests: number = 10,
): Promise<MultiRequestResult> {
  const startTime = Date.now();

  const promises = Array.from({ length: numRequests }, () =>
    runSingleRequest(client, modelName),
  );

  const requests = await Promise.all(promises);

  const endTime = Date.now();
  const totalTimeMs = endTime - startTime;

  const totalWords = requests.reduce((sum, req) => sum + req.wordCount, 0);
  const avgLatencyMs =
    requests.reduce((sum, req) => sum + req.latencyMs, 0) / requests.length;
  const overallWordsPerSecond = (totalWords / totalTimeMs) * 1000;

  return {
    requests,
    avgLatencyMs,
    totalWords,
    totalTimeMs,
    overallWordsPerSecond,
  };
}

/**
 * Run complete benchmark suite
 */
export async function runBenchmark(
  config: BenchmarkConfig,
): Promise<BenchmarkResult> {
  console.log(`\nStarting benchmark for ${config.modelName}...`);
  console.log(`Base URL: ${config.baseUrl}`);

  const client = new OpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey || 'dummy-key',
  });

  // Warmup request to load model and warm up GPUs
  console.log('\nRunning warmup request...');
  await runWarmupRequest(client, config.modelName);
  console.log('✓ Warmup complete');

  // Single request benchmark
  console.log('\nRunning single request benchmark...');
  const singleRequest = await runSingleRequest(client, config.modelName);
  console.log(`✓ Completed in ${singleRequest.latencyMs}ms`);

  // Multi request benchmark
  console.log('\nRunning multi-request benchmark (10 concurrent)...');
  const multiRequest = await runMultiRequest(client, config.modelName, 10);
  console.log(`✓ Completed in ${multiRequest.totalTimeMs}ms`);

  return {
    timestamp: new Date().toISOString(),
    modelName: config.modelName,
    baseUrl: config.baseUrl,
    metadata: config.metadata,
    singleRequest,
    multiRequest,
  };
}
