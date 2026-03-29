import type {
  ParsedSpec,
  Resource,
  Operation,
  Parameter,
  RequestBody,
  Response,
  SchemaInfo,
  MediaType,
} from './types.js';

export function parseOpenAPISpec(spec: any): ParsedSpec {
  const schemas = parseSchemas(spec.components?.schemas || {});
  const operations = parseOperations(spec.paths || {});

  // Group operations by tag
  const resourceMap = new Map<string, Operation[]>();

  for (const op of operations) {
    const tag = op.tags[0] || 'default';
    if (!resourceMap.has(tag)) {
      resourceMap.set(tag, []);
    }
    resourceMap.get(tag)!.push(op);
  }

  const resources: Resource[] = Array.from(resourceMap.entries()).map(
    ([tag, ops]) => ({
      name: toPascalCase(tag) + 'Resource',
      tag,
      operations: ops,
    })
  );

  return {
    info: {
      title: spec.info?.title || 'API Client',
      version: spec.info?.version || '1.0.0',
    },
    resources,
    schemas,
  };
}

function parseOperations(paths: any): Operation[] {
  const operations: Operation[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    // Parse path-level parameters (common to all operations on this path)
    const pathLevelParams = parseParameters((pathItem as any).parameters || []);

    for (const [method, operation] of Object.entries(pathItem as any)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        continue;
      }

      const op = operation as any;

      // Merge path-level and operation-level parameters (operation takes precedence)
      const opParams = parseParameters(op.parameters || []);
      const params = [...pathLevelParams];

      // Add operation params, overriding path-level params with same name/in combination
      for (const opParam of opParams) {
        const existingIndex = params.findIndex(
          p => p.name === opParam.name && p.in === opParam.in
        );
        if (existingIndex >= 0) {
          params[existingIndex] = opParam; // Operation-level takes precedence
        } else {
          params.push(opParam);
        }
      }

      // Extract path parameters from the path string if not already in parameters
      const pathParamMatches = path.matchAll(/\{([^}]+)\}/g);
      for (const match of pathParamMatches) {
        const paramName = match[1];
        // Only add if not already present
        if (!params.find(p => p.name === paramName && p.in === 'path')) {
          params.push({
            name: paramName,
            in: 'path',
            required: true,
            schema: { type: 'string' },
          });
        }
      }

      operations.push({
        operationId: op.operationId || `${method}${path.replace(/\//g, '_')}`,
        method: method.toUpperCase(),
        path,
        summary: op.summary,
        parameters: params,
        requestBody: op.requestBody ? parseRequestBody(op.requestBody) : undefined,
        responses: parseResponses(op.responses || {}),
        tags: op.tags || [],
      });
    }
  }

  return operations;
}

function parseParameters(parameters: any[]): Parameter[] {
  return parameters.map((param) => ({
    name: param.name,
    in: param.in,
    required: param.required || false,
    schema: parseSchema(param.schema),
    description: param.description,
  }));
}

function parseRequestBody(requestBody: any): RequestBody {
  const content = new Map<string, MediaType>();

  for (const [contentType, mediaType] of Object.entries(requestBody.content || {})) {
    content.set(contentType, {
      schema: parseSchema((mediaType as any).schema),
    });
  }

  return {
    required: requestBody.required || false,
    content,
  };
}

function parseResponses(responses: any): Map<number, Response> {
  const result = new Map<number, Response>();

  for (const [status, response] of Object.entries(responses)) {
    const resp = response as any;
    const content = new Map<string, MediaType>();

    if (resp.content) {
      for (const [contentType, mediaType] of Object.entries(resp.content)) {
        content.set(contentType, {
          schema: parseSchema((mediaType as any).schema),
        });
      }
    }

    result.set(Number(status), {
      description: resp.description || '',
      content: content.size > 0 ? content : undefined,
    });
  }

  return result;
}

function parseSchema(schema: any): SchemaInfo {
  if (!schema) {
    return { type: 'any' };
  }

  if (schema.$ref) {
    return {
      type: 'ref',
      ref: schema.$ref.replace('#/components/schemas/', ''),
    };
  }

  const info: SchemaInfo = {
    type: schema.type || 'any',
    format: schema.format,
    nullable: schema.nullable,
  };

  if (schema.enum) {
    info.enum = schema.enum;
  }

  if (schema.type === 'array' && schema.items) {
    info.items = parseSchema(schema.items);
  }

  if (schema.type === 'object' && schema.properties) {
    const props = new Map<string, SchemaInfo>();
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      props.set(propName, parseSchema(propSchema));
    }
    info.properties = props;
    info.required = schema.required || [];
  }

  return info;
}

function parseSchemas(schemas: any): Map<string, SchemaInfo> {
  const result = new Map<string, SchemaInfo>();

  for (const [name, schema] of Object.entries(schemas)) {
    result.set(name, parseSchema(schema));
  }

  return result;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toPascalCase(str: string): string {
  // Convert to PascalCase by:
  // 1. Replace special chars and separators with spaces
  // 2. Split on whitespace/separators
  // 3. Capitalize first letter of each word
  // 4. Join without spaces
  return str
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .split(/\s+/) // Split on whitespace
    .filter(word => word.length > 0) // Remove empty strings
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}
