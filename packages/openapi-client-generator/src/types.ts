/**
 * Internal representation of OpenAPI spec for code generation
 */

export interface ParsedSpec {
  info: {
    title: string;
    version: string;
  };
  resources: Resource[];
  schemas: Map<string, SchemaInfo>;
}

export interface Resource {
  name: string;
  tag: string;
  operations: Operation[];
}

export interface Operation {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Map<number, Response>;
  tags: string[];
}

export interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  schema: SchemaInfo;
  description?: string;
}

export interface RequestBody {
  required: boolean;
  content: Map<string, MediaType>;
}

export interface MediaType {
  schema: SchemaInfo;
}

export interface Response {
  description: string;
  content?: Map<string, MediaType>;
}

export interface SchemaInfo {
  type: string;
  format?: string;
  items?: SchemaInfo;
  properties?: Map<string, SchemaInfo>;
  required?: string[];
  enum?: string[];
  ref?: string;
  nullable?: boolean;
}

export interface GeneratorConfig {
  inputPath: string;
  outputDir: string;
  clientClassName?: string;
}
