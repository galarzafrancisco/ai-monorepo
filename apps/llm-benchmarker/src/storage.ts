import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { BenchmarkResult, BenchmarkStorage } from './types.js';

const DEFAULT_STORAGE_PATH = 'benchmark-results.json';

/**
 * Load benchmark results from JSON file
 */
export async function loadResults(
  filePath: string = DEFAULT_STORAGE_PATH,
): Promise<BenchmarkStorage> {
  if (!existsSync(filePath)) {
    return { results: [] };
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load results:', error);
    return { results: [] };
  }
}

/**
 * Save benchmark results to JSON file
 */
export async function saveResults(
  storage: BenchmarkStorage,
  filePath: string = DEFAULT_STORAGE_PATH,
): Promise<void> {
  try {
    await writeFile(filePath, JSON.stringify(storage, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save results:', error);
    throw error;
  }
}

/**
 * Add a new benchmark result to storage
 */
export async function addResult(
  result: BenchmarkResult,
  filePath: string = DEFAULT_STORAGE_PATH,
): Promise<void> {
  const storage = await loadResults(filePath);
  storage.results.push(result);
  await saveResults(storage, filePath);
}
