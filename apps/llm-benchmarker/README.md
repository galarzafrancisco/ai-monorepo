# LLM Benchmarker

A CLI tool for benchmarking local LLM models using OpenAI-compatible APIs.

## Features

- **Single Request Benchmark**: Measures latency, word count, and words per second for a single request
- **Multi-Request Benchmark**: Issues 10 concurrent requests and calculates aggregated metrics
- **Persistent Storage**: Results are saved to a JSON file for historical comparison
- **ASCII Table Reports**: Clean CLI output with formatted tables
- **Type-Safe**: Written in TypeScript with strict typing

## Installation

```bash
npm install
npm run build
```

## Usage

### Run a Benchmark

```bash
npm start -- run \
  --base-url http://localhost:8000/v1 \
  --model llama-3.1-70b \
  --server vLLM \
  --size 70b \
  --quant 8bit \
  --link https://huggingface.co/meta-llama/Llama-3.1-70B
```

Optional flags:
- `--format <format>`: Specify model format (e.g., GGUF)
- `--api-key <key>`: Provide API key if required
- `--output <file>`: Specify output file (default: benchmark-results.json)

### List All Results

```bash
npm start -- list
```

Optional flags:
- `--input <file>`: Specify input file (default: benchmark-results.json)

## Metrics

### Single Request
- **Latency**: Time from request to response (milliseconds)
- **Word Count**: Number of words in the response
- **Words/Second**: Throughput metric

### Multi-Request (10 concurrent)
- **Total Time**: Wall clock time for all requests
- **Avg Latency**: Average latency across all requests
- **Total Words**: Sum of words across all responses
- **Overall Words/Second**: Aggregate throughput metric

## Output Format

Results are stored in JSON format with complete metadata:

```json
{
  "results": [
    {
      "timestamp": "2026-02-05T12:00:00.000Z",
      "modelName": "llama-3.1-70b",
      "baseUrl": "http://localhost:8000/v1",
      "metadata": {
        "server": "vLLM",
        "modelSize": "70b",
        "quantization": "8bit",
        "modelLink": "https://huggingface.co/...",
        "format": "GGUF"
      },
      "singleRequest": { ... },
      "multiRequest": { ... }
    }
  ]
}
```

## Building for Distribution

```bash
npm run build
```

The compiled output will be in `dist/` and can be packaged as an npm package.
