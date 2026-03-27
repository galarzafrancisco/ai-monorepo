import * as generatedClient from './client/index.js';
import type { OpenAPIConfig } from './client/core/OpenAPI.js';

type GeneratedClientModule = typeof generatedClient;

type ServiceKey = {
  [K in keyof GeneratedClientModule]: K extends `${string}Service`
    ? GeneratedClientModule[K] extends object
      ? K
      : never
    : never;
}[keyof GeneratedClientModule];

type StripConfigArg<Args extends unknown[]> = Args extends [...infer Rest, OpenAPIConfig?]
  ? Rest
  : Args;

type BoundService<TService> = {
  [K in keyof TService as TService[K] extends (...args: any[]) => any ? K : never]:
    TService[K] extends (...args: infer TArgs) => infer TResult
      ? (...args: StripConfigArg<TArgs>) => TResult
      : never;
};

export type TaicoClient = {
  config: OpenAPIConfig;
} & {
  [K in ServiceKey]: BoundService<GeneratedClientModule[K]>;
};

export type CreateTaicoClientOptions = {
  baseUrl: string;
  token?: OpenAPIConfig['TOKEN'];
  version?: string;
  withCredentials?: boolean;
  credentials?: RequestCredentials;
  username?: OpenAPIConfig['USERNAME'];
  password?: OpenAPIConfig['PASSWORD'];
  headers?: OpenAPIConfig['HEADERS'];
  encodePath?: OpenAPIConfig['ENCODE_PATH'];
};

function bindService(service: object, config: OpenAPIConfig): Record<string, unknown> {
  const boundService: Record<string, unknown> = {};

  for (const propertyName of Object.getOwnPropertyNames(service)) {
    if (propertyName === 'length' || propertyName === 'name' || propertyName === 'prototype') {
      continue;
    }

    const value = (service as Record<string, unknown>)[propertyName];
    if (typeof value !== 'function') {
      continue;
    }

    boundService[propertyName] = (...args: unknown[]) => {
      return (value as (...callArgs: unknown[]) => unknown)(...args, config);
    };
  }

  return boundService;
}

export function createTaicoClient(options: CreateTaicoClientOptions): TaicoClient {
  const config: OpenAPIConfig = {
    BASE: options.baseUrl,
    VERSION: options.version ?? '1.0',
    WITH_CREDENTIALS: options.withCredentials ?? false,
    CREDENTIALS: options.credentials ?? 'include',
    TOKEN: options.token,
    USERNAME: options.username,
    PASSWORD: options.password,
    HEADERS: options.headers,
    ENCODE_PATH: options.encodePath,
  };

  const client: Record<string, unknown> = { config };

  for (const [name, value] of Object.entries(generatedClient)) {
    if (!name.endsWith('Service') || typeof value !== 'function') {
      continue;
    }

    client[name] = bindService(value, config);
  }

  return client as TaicoClient;
}
