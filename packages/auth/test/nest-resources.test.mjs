import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { APP_FILTER, NestFactory } from '@nestjs/core';
import { exactResource, OAuthServer, ResourceServer } from '@taico/auth';
import { memoryStores, staticResources } from '@taico/auth/memory';
import {
  AccessTokenGuard,
  AuthExceptionFilter,
  AuthModule,
  UseResourceServer,
} from '@taico/auth/nest';

/*
 * A Nest app that serves two protected resources, each with its own
 * audience, and whose authorization server is elsewhere: named resource
 * servers and the metadata option of AuthModule.
 */

const ISSUER = 'https://auth.example.com';

class NotesController {
  list() {
    return { resource: 'notes' };
  }
}
class FilesController {
  list() {
    return { resource: 'files' };
  }
}
class UnnamedController {
  list() {
    return { ok: true };
  }
}
for (const [controller, path, name] of [
  [NotesController, 'mcp/notes', 'notes'],
  [FilesController, 'mcp/files', 'files'],
  [UnnamedController, 'unnamed', undefined],
]) {
  const descriptor = Object.getOwnPropertyDescriptor(controller.prototype, 'list');
  Get()(controller.prototype, 'list', descriptor);
  if (name) UseResourceServer(name)(controller);
  UseGuards(AccessTokenGuard)(controller);
  Controller(path)(controller);
}

let app;
let url;
let issuer;

before(async () => {
  const port = await new Promise((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port: free } = probe.address();
      probe.close(() => resolve(free));
    });
  });
  url = `http://127.0.0.1:${port}`;
  const resources = [
    { id: 'n', identifier: 'notes', resourceUrl: `${url}/mcp/notes`, name: 'Notes', scopes: [] },
    { id: 'f', identifier: 'files', resourceUrl: `${url}/mcp/files`, name: 'Files', scopes: [] },
  ];
  // Stands in for the remote authorization server; only its verifier is shared
  issuer = new OAuthServer({
    config: { issuer: ISSUER },
    stores: memoryStores(),
    resources: staticResources(resources),
  });
  const resourceServer = (resourceUrl) =>
    new ResourceServer({ verifier: issuer.verifier, audience: exactResource(resourceUrl), baseUrl: url });

  class AppModule {}
  Module({
    imports: [
      AuthModule.forRoot({
        resourceServers: {
          notes: resourceServer(`${url}/mcp/notes`),
          files: resourceServer(`${url}/mcp/files`),
        },
        metadata: {
          resources,
          authorizationServers: (resource) => [`${ISSUER}/mcp/${resource.identifier}`],
        },
      }),
    ],
    controllers: [NotesController, FilesController, UnnamedController],
    providers: [{ provide: APP_FILTER, useClass: AuthExceptionFilter }],
  })(AppModule);
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(port, '127.0.0.1');
});

after(() => app?.close());

const get = (path, token) =>
  fetch(`${url}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
const tokenFor = async (resource) =>
  (await issuer.issueToken({ subject: 'u1', scopes: [], ttlSeconds: 60, audience: `${url}/mcp/${resource}` })).token;

test('each route is checked against its own resource server', async () => {
  const notes = await tokenFor('notes');
  const files = await tokenFor('files');
  assert.deepEqual(await (await get('/mcp/notes', notes)).json(), { resource: 'notes' });
  assert.deepEqual(await (await get('/mcp/files', files)).json(), { resource: 'files' });
  // One resource's token does not open the other
  assert.equal((await get('/mcp/files', notes)).status, 401);
  assert.equal((await get('/mcp/notes', files)).status, 401);
});

test('the challenge points at the metadata of the route\'s own resource', async () => {
  for (const name of ['notes', 'files']) {
    const response = await get(`/mcp/${name}`);
    assert.equal(response.status, 401);
    assert.equal(
      response.headers.get('www-authenticate'),
      `Bearer resource_metadata="${url}/.well-known/oauth-protected-resource/mcp/${name}"`,
    );
  }
});

test('metadata is served per resource, naming its own authorization server', async () => {
  for (const name of ['notes', 'files']) {
    const response = await get(`/.well-known/oauth-protected-resource/mcp/${name}`);
    assert.equal(response.status, 200);
    const metadata = await response.json();
    assert.equal(metadata.resource, `${url}/mcp/${name}`);
    assert.deepEqual(metadata.authorization_servers, [`${ISSUER}/mcp/${name}`]);
  }
  assert.equal((await get('/.well-known/oauth-protected-resource/mcp/other')).status, 404);
});

test('a route that names no resource server, with no default, fails loudly', async () => {
  const response = await get('/unnamed', await tokenFor('notes'));
  assert.equal(response.status, 500);
});
