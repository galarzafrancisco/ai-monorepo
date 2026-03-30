# @taico/openapi-sdkgen

A TypeScript SDK generator from OpenAPI specs with focus on developer ergonomics and maintainability.

## Install

```bash
npm install @taico/openapi-sdkgen
```

## CLI

```bash
openapi-sdkgen ./openapi.json ./generated
```

## Motivation

The existing `@taico/client` package uses `openapi-typescript-codegen` with multiple post-processing scripts to work around limitations:
- `fix-esm-imports.js` - Adds `.js` extensions for ESM compatibility
- `make-client-instantiable.js` - Transforms static methods to accept per-instance config

This approach is fragile and hard to maintain. This package generates better SDKs from scratch instead.

## Design Goals

1. **Instance-based configuration** - No global singletons, auth per client instance
2. **Ergonomic API** - Resource-based grouping, clean method signatures
3. **Type-safe** - Full TypeScript support with strict mode
4. **Streaming support** - SSE endpoints return AsyncIterable
5. **Simple generator** - Transparent code generation, easy to debug
6. **No post-processing** - Generate correct code from the start

## Architecture

### Three-Step Process

1. **Parse** (`parser.ts`) - Convert OpenAPI JSON to internal IR
2. **Generate** (`generator.ts`) - Produce TypeScript source files
3. **Emit** (`index.ts`) - Write files to disk

### Generated Structure

```
generated/
├── index.ts              # Main exports
├── client.ts             # ApiClient main class
├── base-client.ts        # BaseClient with fetch wrapper
├── types.ts              # Type definitions from schemas
├── users-resource.ts     # UsersResource class
├── tasks-resource.ts     # TasksResource class
└── stream-resource.ts    # StreamResource class
```

### Usage Pattern

```typescript
const client = new ApiClient({
  baseUrl: 'http://localhost:3000',
  getAccessToken: async () => getToken(),
});

// Resource-based API
await client.users.getUser({ id: '123' });
await client.tasks.create({ body: { title: 'Task' } });

// Streaming
for await (const event of client.stream.events({ count: 10 })) {
  console.log(event);
}

// AbortSignal support
const controller = new AbortController();
await client.users.list({ signal: controller.signal });
```

## Key Features

### Instance-Based Auth

```typescript
const client1 = new ApiClient({ baseUrl: 'http://api1.com', getAccessToken: () => token1 });
const client2 = new ApiClient({ baseUrl: 'http://api2.com', getAccessToken: () => token2 });
```

No global state, no singleton issues.

### Resource Grouping

Operations are grouped by OpenAPI tags into resource classes:
- `client.users.*` - All user operations
- `client.tasks.*` - All task operations
- `client.stream.*` - All streaming operations

### Streaming Support

SSE endpoints automatically detected and generated as async generators:

```typescript
async *streamEvents(params): AsyncIterable<Event> {
  yield* this.streamEvents('/stream/events', { params });
}
```

### Type Safety

- Request bodies typed from `requestBody` schema
- Path/query params typed from `parameters`
- Response types from `responses[200].content`
- Optional fields handled correctly
- Enums generated as union types

## Testing

The test suite is fully automated and self-contained under `test/`.

```bash
npm test
```

This runs the full pipeline:
1. **Clean** - Remove previously generated client
2. **Generate spec** - Start the test API in spec-generation mode, write `openapi.json`, exit
3. **Generate client** - Run the generator against the spec
4. **Run tests** - Start the test API server, run the test SDK against it, shut down

### Test API (`test/api/`)

NestJS app with endpoints exercising OpenAPI features:
- GET with path/query params
- POST/PUT/PATCH with JSON body
- DELETE with no content response
- Nested objects and arrays
- Optional fields
- SSE streaming (`/stream/events`)
- Auth headers and custom header parameters
- Query parameters with special characters

The test API generates `openapi.json` via `--generate-spec` mode (starts, writes file, exits immediately — no server needed).

### Test Client (`test/client/`)

`test-sdk.ts` imports the generated SDK and makes real HTTP calls to the test API, validating both types and runtime behavior including streaming and AbortSignal.

## Tradeoffs

### What We Gain

✅ No post-processing — generate correct code directly
✅ Cleaner code — no regex hacks on generated output
✅ Instance config — no global singleton
✅ Better DX — resource grouping, clear method names
✅ Streaming — first-class AsyncIterable support
✅ Maintainability — simple generator, easy to understand

### What We Lose

❌ More code — custom generator vs off-the-shelf tool
❌ Edge cases — may not handle all OpenAPI features yet
❌ Battle-tested — new code vs mature library

### Comparison to Current Approach

| Aspect | Current (`openapi-typescript-codegen`) | New Generator |
|--------|---------------------------------------|---------------|
| Post-processing | 2 scripts (fix-esm, make-instantiable) | None |
| Auth pattern | Global with per-call override | Instance-based |
| Resource grouping | Service classes | Resource classes |
| Streaming | Not supported | AsyncIterable |
| Maintainability | Fragile regex transforms | Transparent generation |

## Limitations

Current implementation doesn't handle:
- Complex schema compositions (allOf, oneOf, anyOf)
- Custom media types beyond JSON
- File uploads
- Cookie parameters
- Complex security schemes

## File Structure

```
packages/openapi-sdkgen/
├── src/
│   ├── types.ts       # Internal IR types
│   ├── parser.ts      # OpenAPI -> IR
│   ├── generator.ts   # IR -> TypeScript
│   ├── index.ts       # Main API
│   └── cli.ts         # CLI tool
├── test/
│   ├── api/           # NestJS test API (spec source)
│   │   └── src/
│   │       ├── main.ts
│   │       ├── app.module.ts
│   │       ├── users.controller.ts
│   │       ├── tasks.controller.ts
│   │       └── stream.controller.ts
│   ├── client/        # Test SDK + generated output
│   │   ├── generated/ # Generated SDK (gitignored)
│   │   └── test-sdk.ts
│   └── run.mjs        # Test orchestrator
├── package.json
├── tsconfig.json
└── README.md
```
