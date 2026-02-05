import Table from 'cli-table3';
import { BenchmarkResult, BenchmarkStorage } from './types.js';

/**
 * Display a single benchmark result
 */
export function displayResult(result: BenchmarkResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(80));

  // Model info table
  const infoTable = new Table({
    head: ['Property', 'Value'],
    colWidths: [20, 58],
  });

  infoTable.push(
    ['Timestamp', result.timestamp],
    ['Model Name', result.modelName],
    ['Base URL', result.baseUrl],
    ['Server', result.metadata.server],
    ['Model Size', result.metadata.modelSize],
    ['Quantization', result.metadata.quantization],
    ['Model Link', result.metadata.modelLink],
  );

  if (result.metadata.format) {
    infoTable.push(['Format', result.metadata.format]);
  }

  console.log(infoTable.toString());

  // Single request results
  console.log('\nSINGLE REQUEST BENCHMARK:');
  const singleTable = new Table({
    head: ['Metric', 'Value'],
    colWidths: [30, 48],
  });

  singleTable.push(
    ['Latency', `${result.singleRequest.latencyMs.toFixed(2)} ms`],
    ['Word Count', result.singleRequest.wordCount.toString()],
    ['Words/Second', result.singleRequest.wordsPerSecond.toFixed(2)],
  );

  console.log(singleTable.toString());

  // Multi request results
  console.log('\nMULTI-REQUEST BENCHMARK (10 concurrent):');
  const multiTable = new Table({
    head: ['Metric', 'Value'],
    colWidths: [30, 48],
  });

  multiTable.push(
    ['Total Time', `${result.multiRequest.totalTimeMs.toFixed(2)} ms`],
    ['Avg Latency/Request', `${result.multiRequest.avgLatencyMs.toFixed(2)} ms`],
    ['Total Words', result.multiRequest.totalWords.toString()],
    ['Overall Words/Second', result.multiRequest.overallWordsPerSecond.toFixed(2)],
  );

  console.log(multiTable.toString());
  console.log('='.repeat(80) + '\n');
}

/**
 * Display comparison of all stored results
 */
export function displayAllResults(storage: BenchmarkStorage): void {
  if (storage.results.length === 0) {
    console.log('No benchmark results found.');
    return;
  }

  console.log('\n' + '='.repeat(120));
  console.log('ALL BENCHMARK RESULTS');
  console.log('='.repeat(120));

  const table = new Table({
    head: [
      'Date',
      'Model',
      'Server',
      'Size',
      'Quant',
      'Single WPS',
      'Multi WPS',
      'Single Latency',
    ],
    colWidths: [12, 25, 12, 8, 10, 12, 12, 15],
  });

  for (const result of storage.results) {
    const date = new Date(result.timestamp).toLocaleDateString();
    table.push([
      date,
      result.modelName,
      result.metadata.server,
      result.metadata.modelSize,
      result.metadata.quantization,
      result.singleRequest.wordsPerSecond.toFixed(2),
      result.multiRequest.overallWordsPerSecond.toFixed(2),
      `${result.singleRequest.latencyMs.toFixed(0)}ms`,
    ]);
  }

  console.log(table.toString());
  console.log('='.repeat(120) + '\n');
}
