import type { ParsedSpec, Resource, Operation, Parameter, SchemaInfo } from './types.js';

export function generateClient(spec: ParsedSpec): Map<string, string> {
  const files = new Map<string, string>();

  // Generate types file
  files.set('types.ts', generateTypes(spec));

  // Generate base client
  files.set('base-client.ts', generateBaseClient());

  // Generate resource classes
  for (const resource of spec.resources) {
    files.set(`${toKebabCase(resource.tag)}-resource.ts`, generateResource(resource));
  }

  // Generate main client class
  files.set('client.ts', generateMainClient(spec));

  // Generate index
  files.set('index.ts', generateIndex(spec));

  return files;
}

function generateTypes(spec: ParsedSpec): string {
  const lines: string[] = [
    '// Auto-generated types from OpenAPI spec',
    '// Do not edit manually',
    '',
  ];

  for (const [name, schema] of spec.schemas) {
    lines.push(generateTypeDefinition(name, schema));
    lines.push('');
  }

  return lines.join('\n');
}

function generateTypeDefinition(name: string, schema: SchemaInfo): string {
  if (schema.type === 'object' && schema.properties) {
    const props: string[] = [];
    for (const [propName, propSchema] of schema.properties) {
      const optional = !schema.required?.includes(propName);
      const propType = schemaToTypeScript(propSchema);
      props.push(`  ${propName}${optional ? '?' : ''}: ${propType};`);
    }
    return `export interface ${name} {\n${props.join('\n')}\n}`;
  }

  if (schema.enum) {
    const values = schema.enum.map((v) => `'${v}'`).join(' | ');
    return `export type ${name} = ${values};`;
  }

  return `export type ${name} = ${schemaToTypeScript(schema)};`;
}

function schemaToTypeScript(schema: SchemaInfo): string {
  if (schema.ref) {
    return schema.ref;
  }

  let baseType: string;

  switch (schema.type) {
    case 'string':
      baseType = 'string';
      break;
    case 'number':
    case 'integer':
      baseType = 'number';
      break;
    case 'boolean':
      baseType = 'boolean';
      break;
    case 'array':
      baseType = schema.items ? `${schemaToTypeScript(schema.items)}[]` : 'any[]';
      break;
    case 'object':
      if (schema.properties) {
        const props: string[] = [];
        for (const [propName, propSchema] of schema.properties) {
          const optional = !schema.required?.includes(propName);
          props.push(`${propName}${optional ? '?' : ''}: ${schemaToTypeScript(propSchema)}`);
        }
        baseType = `{ ${props.join('; ')} }`;
      } else {
        baseType = 'Record<string, any>';
      }
      break;
    default:
      baseType = 'any';
  }

  return schema.nullable ? `${baseType} | null` : baseType;
}

function generateBaseClient(): string {
  return `// Base client with fetch wrapper
export interface ClientConfig {
  baseUrl: string;
  getAccessToken?: () => string | Promise<string>;
  headers?: Record<string, string>;
}

export class BaseClient {
  constructor(protected config: ClientConfig) {}

  protected async request<T>(
    method: string,
    path: string,
    options?: {
      params?: Record<string, any>;
      body?: any;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): Promise<T> {
    const url = new URL(path, this.config.baseUrl);

    // Add query parameters
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      ...this.config.headers,
      ...options?.headers,
    };

    // Add auth token if available
    if (this.config.getAccessToken) {
      const token = await this.config.getAccessToken();
      headers['Authorization'] = \`Bearer \${token}\`;
    }

    // Add content type for body requests
    if (options?.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    // Handle no content responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }

    return response.text() as any;
  }

  protected async *streamEvents<T = any>(
    path: string,
    options?: {
      params?: Record<string, any>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    }
  ): AsyncIterable<T> {
    const url = new URL(path, this.config.baseUrl);

    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      ...this.config.headers,
      ...options?.headers,
      'Accept': 'text/event-stream',
    };

    if (this.config.getAccessToken) {
      const token = await this.config.getAccessToken();
      headers['Authorization'] = \`Bearer \${token}\`;
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
      signal: options?.signal,
    });

    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              yield JSON.parse(data) as T;
            } catch {
              yield data as T;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
`;
}

function generateResource(resource: Resource): string {
  const lines: string[] = [
    `import { BaseClient, ClientConfig } from './base-client.js';`,
    `// Types are imported from the index, which re-exports from types.ts`,
    '',
    `export class ${resource.name} extends BaseClient {`,
    `  constructor(config: ClientConfig) {`,
    `    super(config);`,
    `  }`,
    '',
  ];

  for (const op of resource.operations) {
    lines.push(generateOperation(op));
    lines.push('');
  }

  lines.push('}');

  return lines.join('\n');
}

function generateOperation(op: Operation): string {
  const lines: string[] = [];

  // Determine if this is a streaming endpoint
  const isStreaming = op.path.includes('stream') || op.path.includes('events');

  // Build method signature
  const methodName = toCamelCase(op.operationId);
  const params = buildMethodParams(op);
  const returnType = inferReturnType(op, isStreaming);

  // Add JSDoc comment
  if (op.summary) {
    lines.push(`  /** ${op.summary} */`);
  }

  lines.push(`  async ${isStreaming ? '*' : ''}${methodName}(${params}): ${returnType} {`);

  // Build path with path parameters
  const pathParams = op.parameters.filter((p) => p.in === 'path');
  let pathExpr: string;
  if (pathParams.length > 0) {
    // Use template literal for paths with parameters
    let path = op.path;
    for (const param of pathParams) {
      path = path.replace(`{${param.name}}`, `\${params.${param.name}}`);
    }
    pathExpr = `\`${path}\``;
  } else {
    pathExpr = `'${op.path}'`;
  }

  // Build query parameters
  const queryParams = op.parameters.filter((p) => p.in === 'query');
  const hasQueryParams = queryParams.length > 0;

  // Build request options
  const requestOptions: string[] = [];

  if (hasQueryParams) {
    const queryObj = queryParams
      .map((p) => `${p.name}: params.${p.name}`)
      .join(', ');
    requestOptions.push(`params: { ${queryObj} }`);
  }

  if (op.requestBody) {
    requestOptions.push('body: params.body');
  }

  if (params.includes('signal')) {
    requestOptions.push('signal: params.signal');
  }

  if (isStreaming) {
    lines.push(
      `    yield* this.streamEvents(${pathExpr}${requestOptions.length > 0 ? `, { ${requestOptions.join(', ')} }` : ''});`
    );
  } else {
    lines.push(
      `    return this.request('${op.method}', ${pathExpr}${requestOptions.length > 0 ? `, { ${requestOptions.join(', ')} }` : ''});`
    );
  }

  lines.push('  }');

  return lines.join('\n');
}

function buildMethodParams(op: Operation): string {
  const params: string[] = [];

  // Collect all parameters
  const pathParams = op.parameters.filter((p) => p.in === 'path');
  const queryParams = op.parameters.filter((p) => p.in === 'query');

  if (pathParams.length > 0 || queryParams.length > 0 || op.requestBody) {
    const paramFields: string[] = [];

    for (const param of [...pathParams, ...queryParams]) {
      const optional = !param.required;
      paramFields.push(
        `${param.name}${optional ? '?' : ''}: ${schemaToTypeScript(param.schema)}`
      );
    }

    if (op.requestBody) {
      const bodySchema = op.requestBody.content.get('application/json');
      if (bodySchema) {
        paramFields.push(`body: ${schemaToTypeScript(bodySchema.schema)}`);
      }
    }

    paramFields.push('signal?: AbortSignal');

    params.push(`params: { ${paramFields.join('; ')} }`);
  } else {
    params.push('params?: { signal?: AbortSignal }');
  }

  return params.join(', ');
}

function inferReturnType(op: Operation, isStreaming: boolean): string {
  const successResponse = op.responses.get(200) || op.responses.get(201);

  if (!successResponse?.content) {
    return isStreaming ? 'AsyncIterable<any>' : 'Promise<void>';
  }

  const jsonContent = successResponse.content.get('application/json');
  if (!jsonContent) {
    return isStreaming ? 'AsyncIterable<any>' : 'Promise<any>';
  }

  const tsType = schemaToTypeScript(jsonContent.schema);

  if (isStreaming) {
    return `AsyncIterable<${tsType}>`;
  }

  return `Promise<${tsType}>`;
}

function generateMainClient(spec: ParsedSpec): string {
  const lines: string[] = [
    `import { ClientConfig } from './base-client.js';`,
  ];

  for (const resource of spec.resources) {
    lines.push(
      `import { ${resource.name} } from './${toKebabCase(resource.tag)}-resource.js';`
    );
  }

  lines.push('');
  lines.push(`export class ApiClient {`);

  for (const resource of spec.resources) {
    lines.push(`  public readonly ${toCamelCase(resource.tag)}: ${resource.name};`);
  }

  lines.push('');
  lines.push(`  constructor(config: ClientConfig) {`);

  for (const resource of spec.resources) {
    lines.push(`    this.${toCamelCase(resource.tag)} = new ${resource.name}(config);`);
  }

  lines.push('  }');
  lines.push('}');

  return lines.join('\n');
}

function generateIndex(spec: ParsedSpec): string {
  const lines: string[] = [
    `export { ApiClient } from './client.js';`,
    `export type { ClientConfig } from './base-client.js';`,
    `export * from './types.js';`,
  ];

  return lines.join('\n');
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}
