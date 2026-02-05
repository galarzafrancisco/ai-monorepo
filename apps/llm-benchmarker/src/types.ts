/**
 * Model metadata for reporting
 */
export interface ModelMetadata {
  /** Server type (e.g., vLLM, llama.cpp, TRT) */
  server: string;
  /** Model size (e.g., 30b, 120b) */
  modelSize: string;
  /** Quantization method (e.g., 8bit, NVFP4) */
  quantization: string;
  /** Link to model (usually HuggingFace) */
  modelLink: string;
  /** Format information (e.g., GGUF) */
  format?: string;
}

/**
 * Configuration for benchmark run
 */
export interface BenchmarkConfig {
  /** Base URL for OpenAI-compatible API */
  baseUrl: string;
  /** Model name to test */
  modelName: string;
  /** Model metadata */
  metadata: ModelMetadata;
  /** Optional API key */
  apiKey?: string;
}

/**
 * Results from a single LLM request
 */
export interface SingleRequestResult {
  /** Latency in milliseconds */
  latencyMs: number;
  /** Number of words in response */
  wordCount: number;
  /** Words per second */
  wordsPerSecond: number;
  /** Full response text */
  responseText: string;
}

/**
 * Results from multiple concurrent requests
 */
export interface MultiRequestResult {
  /** Individual request results */
  requests: SingleRequestResult[];
  /** Average latency across all requests */
  avgLatencyMs: number;
  /** Total words across all requests */
  totalWords: number;
  /** Total time for all requests */
  totalTimeMs: number;
  /** Overall words per second */
  overallWordsPerSecond: number;
}

/**
 * Complete benchmark result
 */
export interface BenchmarkResult {
  /** Timestamp of benchmark run */
  timestamp: string;
  /** Model name tested */
  modelName: string;
  /** Base URL used */
  baseUrl: string;
  /** Model metadata */
  metadata: ModelMetadata;
  /** Single request benchmark results */
  singleRequest: SingleRequestResult;
  /** Multi request benchmark results */
  multiRequest: MultiRequestResult;
}

/**
 * Storage structure for all benchmark results
 */
export interface BenchmarkStorage {
  /** Array of all benchmark results */
  results: BenchmarkResult[];
}
