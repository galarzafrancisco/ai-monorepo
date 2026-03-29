# OpenAPI Client Generator (Experimental)

An experimental TypeScript SDK generator from OpenAPI specs with focus on developer ergonomics and maintainability.

## Motivation

The existing `@taico/client` package uses `openapi-typescript-codegen` with multiple post-processing scripts to work around limitations:
- `fix-esm-imports.js` - Adds `.js` extensions for ESM compatibility
- `make-client-instantiable.js` - Transforms static methods to accept per-instance config

This approach is fragile and hard to maintain. This package explores whether we can generate better SDKs from scratch.

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
// Each client instance has its own config
const client1 = new ApiClient({
  baseUrl: 'http://api1.com',
  getAccessToken: () => token1
});

const client2 = new ApiClient({
  baseUrl: 'http://api2.com',
  getAccessToken: () => token2
});
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

## Testing Approach

### Test API (`test-api/`)

NestJS app with endpoints exercising OpenAPI features:
- GET with path params (`/users/:id`)
- GET with query params (`/users?limit=10`)
- POST with JSON body
- PUT/PATCH updates
- DELETE with no content
- Nested objects
- Arrays
- Optional fields
- Different status codes
- SSE streaming (`/stream/events`)
- Auth headers

The test API auto-generates `openapi.json` using `@nestjs/swagger`.

### Test Client (`test-client/`)

Script that:
1. Imports the generated SDK
2. Makes real HTTP calls to test-api
3. Validates types compile
4. Validates runtime behavior
5. Tests streaming
6. Tests AbortSignal

Run with: `npm test`

## Tradeoffs

### What We Gain

✅ **No post-processing** - Generate correct code directly
✅ **Cleaner code** - No regex hacks on generated output
✅ **Instance config** - No global singleton
✅ **Better DX** - Resource grouping, clear method names
✅ **Streaming** - First-class AsyncIterable support
✅ **Maintainability** - Simple generator, easy to understand

### What We Lose

❌ **More code** - Custom generator vs off-the-shelf tool
❌ **Edge cases** - May not handle all OpenAPI features yet
❌ **Battle-tested** - New code vs mature library

### Comparison to Current Approach

| Aspect | Current (`openapi-typescript-codegen`) | New Generator |
|--------|---------------------------------------|---------------|
| Post-processing | 2 scripts (fix-esm, make-instantiable) | None |
| Auth pattern | Global with per-call override | Instance-based |
| Resource grouping | Service classes | Resource classes |
| Streaming | Not supported | AsyncIterable |
| Maintainability | Fragile regex transforms | Transparent generation |

## Limitations

Current implementation is exploratory and doesn't handle:
- All OpenAPI 3.x features
- Complex schema compositions (allOf, oneOf, anyOf)
- Custom media types beyond JSON
- File uploads
- Cookie parameters
- Complex security schemes

These could be added if this approach proves valuable.

## Next Steps

If this proves better than current approach:
1. Add support for missing OpenAPI features
2. Add comprehensive tests
3. Consider replacing `@taico/client` generation
4. Extract as standalone package

## Running the Example

```bash
# Install dependencies
npm install

# Build the generator
npm run build

# Start test API (generates openapi.json)
npm run test:api &

# Wait for API to start, then generate client
sleep 2
npm run generate

# Run tests against generated client
npm run test:client

# Or run everything
npm test
```

## File Structure

```
packages/openapi-client-generator/
├── src/
│   ├── types.ts       # Internal IR types
│   ├── parser.ts      # OpenAPI -> IR
│   ├── generator.ts   # IR -> TypeScript
│   ├── index.ts       # Main API
│   └── cli.ts         # CLI tool
├── test-api/
│   └── src/
│       ├── main.ts              # NestJS bootstrap
│       ├── app.module.ts        # App module
│       ├── users.controller.ts  # User endpoints
│       ├── tasks.controller.ts  # Task endpoints
│       └── stream.controller.ts # SSE endpoints
├── test-client/
│   ├── generated/     # Generated SDK (gitignored)
│   └── test-sdk.ts    # Test script
├── package.json
├── tsconfig.json
└── README.md
```
