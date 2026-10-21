import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { APP_FILTER, NestFactory } from '@nestjs/core';
import { OAuthServer, ScopeRegistry } from '@taico/auth';
import { localIdp } from '@taico/auth/idp-local';
import { MemoryUserStore, memoryStores, staticResources } from '@taico/auth/memory';
import {
  AccessTokenGuard,
  AUTH_SERVER,
  AuthExceptionFilter,
  AuthModule,
  Public,
  RequireScopes,
  ScopesGuard,
} from '@taico/auth/nest';
import { authenticateSocket, WsAccessTokenGuard, WsScopesGuard } from '@taico/auth/nest-ws';

/*
 * A real Nest application. Plain JavaScript has no decorator syntax, so the
 * decorators are applied by hand; they are the same functions either way.
 */

const decorate = (target, method, ...decorators) => {
  const descriptor = Object.getOwnPropertyDescriptor(target.prototype, method);
  for (const decorator of decorators) decorator(target.prototype, method, descriptor);
};

class NotesController {
  list(request) {
    return { subject: request.auth.subject };
  }
  write() {
    return { ok: true };
  }
  health() {
    return { ok: true };
  }
}
decorate(NotesController, 'list', Get(), RequireScopes('notes:read'));
decorate(NotesController, 'write', Get('write'), RequireScopes('notes:write'));
decorate(NotesController, 'health', Get('health'), Public());
// @Req() on the first parameter of list()
Reflect.defineMetadata(
  '__routeArguments__',
  { '0:0': { index: 0, data: undefined, pipes: [] } },
  NotesController,
  'list',
);
UseGuards(AccessTokenGuard, ScopesGuard)(NotesController);
Controller('notes')(NotesController);

let app;
let url;
let server;
let user;

before(async () => {
  class AppModule {}
  // The issuer has to be known before the app is built, so pick a free port first
  const port = await new Promise((resolve) => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port: free } = probe.address();
      probe.close(() => resolve(free));
    });
  });
  const issuer = `http://127.0.0.1:${port}`;
  const identity = localIdp(new MemoryUserStore());
  user = await identity.createUser({ email: 'ada@example.com', password: 'correct horse' });
  const scopes = [
    { id: 'notes:read', description: '' },
    { id: 'notes:write', description: '' },
  ];
  Module({
    imports: [
      AuthModule.forRootAsync({
        useFactory: () => ({
          server: {
            config: { issuer },
            stores: memoryStores(),
            resources: staticResources([
              { id: 'r', identifier: 'notes', resourceUrl: `${issuer}/notes`, name: 'Notes', scopes },
            ]),
            identity,
            scopes: new ScopeRegistry(scopes),
          },
          resource: `${issuer}/notes`,
        }),
      }),
    ],
    controllers: [NotesController],
    providers: [{ provide: APP_FILTER, useClass: AuthExceptionFilter }],
  })(AppModule);

  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(port, '127.0.0.1');
  url = issuer;
  server = app.get(AUTH_SERVER);
});

after(() => app.close());

const get = (path, token) =>
  fetch(`${url}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

test('AuthModule provides the server and mounts its endpoints', async () => {
  assert.ok(server instanceof OAuthServer);
  const metadata = await (await get('/.well-known/oauth-authorization-server')).json();
  assert.equal(metadata.issuer, url);
  const jwks = await (await get('/.well-known/jwks.json')).json();
  assert.ok(Array.isArray(jwks.keys));

  const login = await fetch(`${url}/oauth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: url },
    body: JSON.stringify({ email: 'ada@example.com', password: 'correct horse' }),
  });
  assert.equal(login.status, 200);
  assert.equal(login.headers.getSetCookie().length, 2);

  const noOrigin = await fetch(`${url}/oauth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ada@example.com', password: 'correct horse' }),
  });
  assert.equal(noOrigin.status, 403);
});

test('guards: public routes, missing token, scopes', async () => {
  assert.equal((await get('/notes/health')).status, 200);

  const metadataUrl = `${url}/.well-known/oauth-protected-resource/notes`;
  const missing = await get('/notes');
  assert.equal(missing.status, 401);
  assert.equal(missing.headers.get('www-authenticate'), `Bearer resource_metadata="${metadataUrl}"`);
  // Any route below the resource points at the same metadata, which exists
  const below = await get('/notes/write');
  assert.equal(below.headers.get('www-authenticate'), `Bearer resource_metadata="${metadataUrl}"`);
  const metadata = await fetch(metadataUrl);
  assert.equal(metadata.status, 200);
  assert.equal((await metadata.json()).resource, `${url}/notes`);

  const { token } = await server.issueToken({ subject: user.id, scopes: ['notes:read'], ttlSeconds: 60 });
  const ok = await get('/notes', token);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { subject: user.id });

  const forbidden = await get('/notes/write', token);
  assert.equal(forbidden.status, 403);
  assert.equal(
    forbidden.headers.get('www-authenticate'),
    `Bearer resource_metadata="${metadataUrl}", error="insufficient_scope", scope="notes:write"`,
  );

  assert.equal((await get('/notes', 'garbage')).status, 401);
});

test('a revoked token is refused by the guard on the next request', async () => {
  const issued = await server.issueToken({
    subject: user.id,
    scopes: ['notes:read'],
    ttlSeconds: 3600,
    record: { name: 'agent' },
  });
  assert.equal((await get('/notes', issued.token)).status, 200);
  await server.revokeIssuedToken(issued.jti);
  assert.equal((await get('/notes', issued.token)).status, 401);
});

test('websocket guards authenticate the handshake and disconnect failures', async () => {
  const auth = server.resourceServer();
  const { token } = await server.issueToken({ subject: user.id, scopes: ['notes:read'], ttlSeconds: 60 });
  const socket = (handshake) => {
    const instance = { handshake: { headers: {}, ...handshake }, data: {}, disconnected: false };
    instance.disconnect = () => {
      instance.disconnected = true;
    };
    return instance;
  };
  const contextFor = (client, handler = () => {}) => ({
    switchToWs: () => ({ getClient: () => client }),
    getHandler: () => handler,
    getClass: () => Object,
  });

  const guard = new WsAccessTokenGuard(auth);
  const good = socket({ auth: { token } });
  assert.equal(await guard.canActivate(contextFor(good)), true);
  assert.equal(good.data.auth.subject, user.id);

  const viaCookie = socket({ headers: { cookie: `access_token=${token}` } });
  assert.equal(await guard.canActivate(contextFor(viaCookie)), true);

  const bad = socket({ auth: { token: 'nope' } });
  assert.equal(await guard.canActivate(contextFor(bad)), false);
  assert.equal(bad.disconnected, true);

  // A token minted for one resource is not accepted on a socket
  const forResource = await server.issueToken({
    subject: user.id,
    scopes: [],
    ttlSeconds: 60,
    audience: `${url}/notes`,
  });
  await assert.rejects(
    authenticateSocket(auth, { handshake: { headers: {}, auth: { token: forResource.token } } }),
    /not issued for this resource/,
  );

  const handler = () => {};
  RequireScopes('notes:write')(handler);
  const reflector = app.get(ScopesGuard).reflector;
  const scopes = new WsScopesGuard(reflector);
  assert.equal(scopes.canActivate(contextFor(good, handler)), false);
  assert.equal(good.disconnected, true);
});
