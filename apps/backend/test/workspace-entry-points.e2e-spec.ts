import { INestApplication, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import {
  GATEWAY_METADATA,
  GATEWAY_OPTIONS,
  MESSAGE_MAPPING_METADATA,
  MESSAGE_METADATA,
} from '@nestjs/websockets/constants';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { ExecutionWireEvents } from '@taico/events';
import { AppModule } from '../src/app.module';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { TokenSignerService } from '../src/auth/crypto/token-signer.service';
import { AccessTokenClaims } from '../src/auth/core/types/access-token-claims.type';
import { getConfig } from '../src/config/env.config';
import { ActorType } from '../src/identity-provider/enums';
import { WorkspaceRole } from '../src/workspaces/enums';
import { WorkspaceEntity } from '../src/workspaces/workspace.entity';
import { WorkspaceMemberEntity } from '../src/workspaces/workspace-member.entity';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import { AccessTokenGuard } from '../src/auth/guards/guards/access-token.guard';
import { WsAccessTokenGuard } from '../src/auth/guards/guards/ws-access-token-guard';
import {
  WORKSPACE_ACCESS_KEY,
  WorkspaceAccessMode,
} from '../src/auth/guards/decorators/workspace-access.decorator';
import { REQUIRED_SCOPES_KEY } from '../src/auth/guards/decorators/require-scopes.decorator';
import { ActiveTaskExecutionEntity } from '../src/executions/active/active-task-execution.entity';
import { TaskExecutionHistoryEntity } from '../src/executions/history/task-execution-history.entity';
import { TaskExecutionHistoryStatus } from '../src/executions/history/task-execution-history-status.enum';
import { TaskStatus } from '../src/tasks/enums';
import { AgentsService } from '../src/agents/agents.service';
import { RegisteredClientEntity } from '../src/authorization-server/entities/registered-client.entity';
import { TokenEndpointAuthMethod } from '../src/authorization-server/enums';
import { ensureTestUser, TEST_USER_SLUG } from './helpers/auth.helper';

const WORKSPACE_B_ID = '44444444-4444-4444-8444-444444444444';
const WORKER_A = 'entry-points-worker-a';
const OTHER_WORKER = 'entry-points-worker-other';
const PREFIX = '/api/v1';

type HttpRoute = {
  kind: 'http';
  name: string;
  method: string;
  path: string;
  mode: WorkspaceAccessMode | undefined;
  guarded: boolean;
  scopes: string[];
};
type WsHandler = {
  kind: 'ws';
  name: string;
  namespace: string;
  message: string;
  mode: WorkspaceAccessMode | undefined;
  guarded: boolean;
};

/**
 * Proves the two workspace rules across the whole app, not for hand-picked
 * paths. Every entry point is discovered from the running app, so a new
 * route is covered as soon as it exists:
 *
 * 1. Every REST route (MCP included) and WebSocket message declares a
 *    `@WorkspaceAccess()` mode, and every mode but `installation` sits behind
 *    the access token guard that enforces it.
 * 2. Every `default-only` entry point answers "not found" to a token for
 *    another workspace.
 * 3. Every `scoped` and `worker` route, every MCP tool and every WebSocket
 *    message, called from workspace B with workspace A's ids, returns none
 *    of A's content and changes none of A's rows. Worker routes called by
 *    another worker of the same workspace change nothing either.
 */
describe('Workspace entry points (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let port: number;
  let db: DataSource;
  let document: OpenAPIObject;
  let routes: HttpRoute[];
  let handlers: WsHandler[];
  let allScopes: string[];
  let actorId: string;
  let otherActorA: string;
  const agentSlugA = `entry-points-${randomBytes(4).toString('hex')}`;
  let tokenA: string;
  let tokenB: string;

  const hex = randomBytes(4).toString('hex');
  /** Every text of A's rows contains this; nothing B receives may. */
  const CANARY = `canary${hex}`;
  const ids: Record<string, string> = {};

  async function sign(
    workspaceId: string,
    options: { clientId?: string; sub?: string; actorType?: ActorType } = {},
  ): Promise<string> {
    const config = getConfig();
    const now = Math.floor(Date.now() / 1000);
    const claims: AccessTokenClaims = {
      iss: config.issuerUrl,
      sub: options.sub ?? actorId,
      workspace_id: workspaceId,
      actor_id: options.sub ?? actorId,
      actor_slug: TEST_USER_SLUG,
      actor_type: options.actorType ?? ActorType.HUMAN,
      aud: config.issuerUrl,
      exp: now + 1800,
      iat: now,
      jti: randomBytes(16).toString('hex'),
      client_id: options.clientId ?? 'web-app',
      scope: allScopes,
      resource: config.issuerUrl,
      version: '0.0.0',
    };
    return app.get(TokenSignerService).signToken(claims);
  }

  const call = (token: string, method: string, path: string) =>
    (request(http) as any)
      [method.toLowerCase()](`${PREFIX}${path}`)
      .set('Authorization', `Bearer ${token}`)
      .timeout(15000);

  /** Every controller route and gateway message handler in the app. */
  function discover(): { routes: HttpRoute[]; handlers: WsHandler[] } {
    const reflector = app.get(Reflector);
    const scanner = new MetadataScanner();
    const found: { routes: HttpRoute[]; handlers: WsHandler[] } = { routes: [], handlers: [] };
    const modeOf = (handler: Function, cls: Function) =>
      reflector.getAllAndOverride<WorkspaceAccessMode>(WORKSPACE_ACCESS_KEY, [handler, cls]);
    const guardsOf = (handler: Function, cls: Function): unknown[] => [
      ...(Reflect.getMetadata(GUARDS_METADATA, cls) ?? []),
      ...(Reflect.getMetadata(GUARDS_METADATA, handler) ?? []),
    ];
    const seen = new Set<Function>();

    for (const module of app.get(ModulesContainer).values()) {
      for (const wrapper of module.controllers.values()) {
        const cls = wrapper.metatype as Function;
        if (!cls || seen.has(cls)) continue;
        seen.add(cls);
        const base = [Reflect.getMetadata(PATH_METADATA, cls) ?? ''].flat()[0] as string;
        for (const name of scanner.getAllMethodNames(cls.prototype)) {
          const handler = cls.prototype[name];
          const sub = Reflect.getMetadata(PATH_METADATA, handler);
          if (sub === undefined) continue;
          const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)];
          for (const p of [sub].flat() as string[]) {
            const path = `/${base}/${p}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
            const required = reflector.getAllAndOverride<{ scopes: string[] }>(
              REQUIRED_SCOPES_KEY,
              [handler, cls],
            );
            found.routes.push({
              kind: 'http',
              name: `${cls.name}.${name}`,
              method: method === 'ALL' ? 'POST' : method,
              path,
              mode: modeOf(handler, cls),
              guarded: guardsOf(handler, cls).includes(AccessTokenGuard),
              scopes: required?.scopes ?? [],
            });
          }
        }
      }
      for (const wrapper of module.providers.values()) {
        const cls = wrapper.metatype as Function;
        if (!cls || seen.has(cls) || !Reflect.getMetadata(GATEWAY_METADATA, cls)) continue;
        seen.add(cls);
        const namespace = (Reflect.getMetadata(GATEWAY_OPTIONS, cls)?.namespace ?? '/') as string;
        for (const name of scanner.getAllMethodNames(cls.prototype)) {
          const handler = cls.prototype[name];
          if (!Reflect.getMetadata(MESSAGE_MAPPING_METADATA, handler)) continue;
          found.handlers.push({
            kind: 'ws',
            name: `${cls.name}.${name}`,
            namespace,
            message: Reflect.getMetadata(MESSAGE_METADATA, handler),
            mode: modeOf(handler, cls),
            guarded: guardsOf(handler, cls).includes(WsAccessTokenGuard),
          });
        }
      }
    }
    return found;
  }

  /** The A id a path parameter or field most likely names. */
  function idFor(name: string, path = ''): string {
    const n = name.toLowerCase();
    if (n === 'id') {
      const segment = path.split('/:id')[0];
      if (segment.endsWith('/tasks/tasks')) return ids.task;
      if (segment.endsWith('/context/blocks')) return ids.block;
      if (segment.endsWith('/threads')) return ids.thread;
      if (segment.endsWith('/task-blueprints')) return ids.blueprint;
      if (segment.endsWith('/scheduled-tasks')) return ids.schedule;
      if (segment.endsWith('/executions/history')) return ids.history;
      return ids.task;
    }
    if (n === 'slug' && path.startsWith('/agents')) return agentSlugA;
    // Free text that only looks like an id (an agent's model choice).
    if (n === 'providerid' || n === 'modelid') return `probe-${hex}`;
    if (n.includes('execution')) return ids.execution;
    if (n.includes('statecontextblock') || n.includes('stateblock')) return ids.stateBlock;
    if (n.includes('block') || n === 'parentid' || n === 'targetparentid') return ids.block;
    if (n.includes('thread')) return ids.thread;
    if (n.includes('run')) return ids.run;
    if (n.includes('blueprint')) return ids.blueprint;
    if (n.includes('schedule')) return ids.schedule;
    if (n.includes('comment')) return ids.comment;
    if (n.includes('inputrequest')) return ids.inputRequest;
    if (n.includes('tag')) return ids.tag;
    if (n.includes('project')) return ids.project;
    if (n.includes('actor') || n.includes('assignee') || n.includes('participant')) return otherActorA;
    return ids.task;
  }

  function resolve(schema: any): any {
    if (schema?.$ref) {
      return resolve(document.components!.schemas![schema.$ref.split('/').pop()]);
    }
    if (schema?.allOf) return Object.assign({}, ...schema.allOf.map(resolve));
    return schema ?? {};
  }

  /** A value that passes validation, with A's ids wherever an id goes. */
  function sample(schema: any, name: string, path: string, depth = 0): unknown {
    const s = resolve(schema);
    if (s.oneOf || s.anyOf) return sample((s.oneOf ?? s.anyOf)[0], name, path, depth);
    if (s.enum) return s.enum[0];
    const type = Array.isArray(s.type) ? s.type.find((t: string) => t !== 'null') : s.type;
    if (type === 'array') return [sample(s.items, name.replace(/s$/, ''), path, depth + 1)];
    if (/id$/i.test(name) && !s.properties) return idFor(name, path);
    if (type === 'object' || s.properties) {
      if (depth > 3) return {};
      const out: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries<any>(s.properties ?? {})) {
        const required = (s.required ?? []).includes(key);
        if (required || /ids?$/i.test(key) || /names$/i.test(key)) {
          out[key] = sample(prop, key, path, depth + 1);
        }
      }
      return out;
    }
    if (type === 'integer' || type === 'number') return s.minimum ?? 1;
    if (type === 'boolean') return false;
    if (s.format === 'uuid' || /ids?$/i.test(name)) return idFor(name, path);
    if (s.format === 'date-time') return new Date(Date.now() + 3600_000).toISOString();
    if (s.format === 'email') return `probe-${hex}@example.com`;
    if (s.format === 'uri' || /(url|link)$/i.test(name)) return 'https://example.com/probe';
    if (/cron/i.test(name)) return '0 0 1 1 *';
    if (/timezone/i.test(name)) return 'UTC';
    return `probe-${hex}`;
  }

  function operation(route: HttpRoute): any {
    const swaggerPath = `${PREFIX}${route.path}`.replace(/:(\w+)/g, '{$1}');
    return document.paths[swaggerPath]?.[route.method.toLowerCase()];
  }

  /** Path with A's ids, query and body built from the route's OpenAPI schema. */
  function buildRequest(route: HttpRoute) {
    const path = route.path.replace(/:(\w+)/g, (_m, param) => idFor(param, route.path));
    const op = operation(route);
    const query: Record<string, unknown> = {};
    for (const param of op?.parameters ?? []) {
      if (param.in === 'query' && (param.required || /id$/i.test(param.name))) {
        query[param.name] = sample(param.schema, param.name, route.path);
      }
    }
    const schema = op?.requestBody?.content?.['application/json']?.schema;
    const body = schema ? sample(schema, 'body', route.path) : undefined;
    return { path, query, body };
  }

  /** Rows that are A's or point at A's ids, hashed per table. */
  async function snapshotA(): Promise<Record<string, string>> {
    const aIds = Object.values(ids).concat(otherActorA);
    const columns: { table_name: string; column_name: string; data_type: string }[] =
      await db.query(`
        SELECT c.table_name, c.column_name, c.data_type
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_name = c.table_name AND t.table_schema = c.table_schema
        WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
          AND (c.data_type = 'uuid' OR c.column_name = 'workspace_id')`);
    const byTable = new Map<string, string[]>();
    for (const c of columns) {
      byTable.set(c.table_name, [...(byTable.get(c.table_name) ?? []), c.column_name]);
    }
    const out: Record<string, string> = {};
    for (const [table, cols] of byTable) {
      if (table === 'workspace_members' || table === 'migrations') continue;
      const conditions = cols.map((col) =>
        col === 'workspace_id' ? `"workspace_id" = '${DEFAULT_WORKSPACE_ID}'` : `"${col}" = ANY($1::uuid[])`,
      );
      const [row] = await db.query(
        `SELECT count(*)::int AS n, md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS h
         FROM "${table}" t WHERE ${conditions.join(' OR ')}`,
        [aIds],
      );
      out[table] = `${row.n}:${row.h}`;
    }
    return out;
  }

  /** Waits until background work on the seeded rows (indexing, projections) is done. */
  async function stableSnapshot(): Promise<Record<string, string>> {
    let previous = await snapshotA();
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((r) => setTimeout(r, 500));
      const next = await snapshotA();
      if (JSON.stringify(next) === JSON.stringify(previous)) return next;
      previous = next;
    }
    throw new Error('A rows never settled');
  }

  function diff(before: Record<string, string>, after: Record<string, string>): string[] {
    return Object.keys({ ...before, ...after }).filter((t) => before[t] !== after[t]);
  }

  /** What in a response would leak A: its content always, its ids on a success. */
  function leaks(text: string, success: boolean): string[] {
    const found: string[] = [];
    if (text.includes(CANARY)) found.push('canary');
    if (success) {
      for (const [key, id] of Object.entries(ids)) {
        if (text.includes(id)) found.push(key);
      }
    }
    return found;
  }

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
    port = (http as unknown as { address(): { port: number } }).address().port;
    db = app.get(DataSource);
    document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
    ({ routes, handlers } = discover());
    allScopes = [...new Set(routes.flatMap((r) => r.scopes))];

    actorId = await ensureTestUser(app);
    otherActorA = (
      await app.get(AgentsService).createAgent(DEFAULT_WORKSPACE_ID, {
        slug: agentSlugA,
        name: `Agent ${CANARY}`,
        systemPrompt: `Prompt ${CANARY}`,
        statusTriggers: [],
        allowedTools: [],
      })
    ).actorId;
    await db
      .getRepository(WorkspaceEntity)
      .createQueryBuilder()
      .insert()
      .values({ id: WORKSPACE_B_ID, slug: 'entry-points-b', name: 'Entry points B' })
      .orIgnore()
      .execute();
    await db
      .getRepository(WorkspaceMemberEntity)
      .createQueryBuilder()
      .insert()
      .values({ workspaceId: WORKSPACE_B_ID, actorId, role: WorkspaceRole.ADMIN })
      .orIgnore()
      .execute();
    tokenA = await sign(DEFAULT_WORKSPACE_ID);
    tokenB = await sign(WORKSPACE_B_ID);

    // Workspace A's rows, every text marked with the canary.
    const created = async (method: string, path: string, body: object) => {
      const res = await call(tokenA, method, path).send(body);
      if (res.status >= 300) throw new Error(`${method} ${path}: ${res.status} ${res.text}`);
      return res.body;
    };
    const task = await created('POST', '/tasks/tasks', {
      name: `Task ${CANARY}`,
      description: `Description ${CANARY}`,
      tagNames: [CANARY, `project:${CANARY}`],
    });
    ids.task = task.id;
    ids.tag = task.tags.find((t: any) => t.name === CANARY).id;
    ids.comment = (await created('POST', `/tasks/tasks/${task.id}/comments`, { content: `Comment ${CANARY}` })).id;
    ids.inputRequest = (
      await created('POST', `/tasks/tasks/${task.id}/input-requests`, {
        assignedToActorId: otherActorA,
        question: `Question ${CANARY}`,
      })
    ).id;
    ids.project = (await created('GET', `/meta/projects/by-slug/${CANARY}`, {})).id;
    ids.block = (await created('POST', '/context/blocks', { title: `Block ${CANARY}`, content: `Content ${CANARY}` })).id;
    const thread = await created('POST', '/threads', {
      title: `Thread ${CANARY}`,
      taskIds: [task.id],
      contextBlockIds: [ids.block],
    });
    ids.thread = thread.id;
    ids.stateBlock = thread.stateContextBlockId;
    ids.blueprint = (
      await created('POST', '/task-blueprints', { name: `Blueprint ${CANARY}`, description: `Blueprint ${CANARY}` })
    ).id;
    ids.schedule = (
      await created('POST', '/scheduled-tasks', { taskBlueprintId: ids.blueprint, cronExpression: '0 0 1 1 *', enabled: false })
    ).id;
    ids.run = (await created('POST', '/agent-runs', { parentTaskId: task.id })).id;
    const execution = await db.getRepository(ActiveTaskExecutionEntity).save({
      workspaceId: DEFAULT_WORKSPACE_ID,
      taskId: task.id,
      agentActorId: otherActorA,
      workerClientId: WORKER_A,
      claimedAt: new Date(),
      taskStatusBeforeClaim: TaskStatus.NOT_STARTED,
      taskTagsBeforeClaim: [],
      taskAssigneeActorIdBeforeClaim: null,
      lastHeartbeatAt: new Date(),
      toolCallCount: 0,
    });
    ids.execution = execution.id;
    ids.history = (
      await db.getRepository(TaskExecutionHistoryEntity).save({
        workspaceId: DEFAULT_WORKSPACE_ID,
        taskId: task.id,
        agentActorId: otherActorA,
        workerClientId: WORKER_A,
        claimedAt: new Date(),
        transitionedAt: new Date(),
        toolCallCount: 0,
        status: TaskExecutionHistoryStatus.SUCCEEDED,
        errorMessage: `Error ${CANARY}`,
      })
    ).id;
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  describe('every entry point declares how it keeps workspaces apart', () => {
    it('finds the whole app', () => {
      expect(routes.length).toBeGreaterThan(150);
      expect(new Set(handlers.map((h) => h.namespace)).size).toBeGreaterThanOrEqual(8);
    });

    it('has a mode on every REST route and WebSocket message', () => {
      const undeclared = [...routes, ...handlers].filter((e) => !e.mode).map((e) => e.name);
      expect(undeclared).toEqual([]);
    });

    it('puts every mode but installation behind the access token guard', () => {
      const unguarded = [...routes, ...handlers]
        .filter((e) => e.mode !== 'installation' && !e.guarded)
        .map((e) => e.name);
      expect(unguarded).toEqual([]);
    });

    it('only leaves installation routes unauthenticated', () => {
      const open = routes.filter((r) => !r.guarded && r.mode !== 'installation').map((r) => r.name);
      expect(open).toEqual([]);
    });
  });

  describe('default-only entry points', () => {
    it('answer not found to a token for another workspace, on every route', async () => {
      const failures: string[] = [];
      for (const route of routes.filter((r) => r.mode === 'default-only')) {
        const path = route.path.replace(/:(\w+)/g, () => ids.task);
        const res = await call(tokenB, route.method, path).send({});
        if (res.status !== 404 || res.body?.code !== 'NOT_IN_WORKSPACE') {
          failures.push(`${route.method} ${route.path} (${route.name}): ${res.status}`);
        }
      }
      expect(failures).toEqual([]);
    }, 120000);

    it('still work for the default workspace', async () => {
      const failures: string[] = [];
      for (const route of routes.filter((r) => r.mode === 'default-only' && r.method === 'GET')) {
        const path = route.path.replace(/:(\w+)/g, () => ids.task);
        const res = await call(tokenA, route.method, path);
        if (res.body?.code === 'NOT_IN_WORKSPACE') failures.push(`${route.method} ${route.path}`);
      }
      expect(failures).toEqual([]);
    }, 120000);

    it('refuse every message from a socket of another workspace', async () => {
      const failures: string[] = [];
      const byNamespace = new Map<string, WsHandler[]>();
      for (const h of handlers.filter((h) => h.mode === 'default-only')) {
        byNamespace.set(h.namespace, [...(byNamespace.get(h.namespace) ?? []), h]);
      }
      for (const [namespace, list] of byNamespace) {
        const socket = io(`http://127.0.0.1:${port}${namespace}`, {
          auth: { token: tokenB },
          transports: ['websocket'],
          forceNew: true,
        });
        const connected = await new Promise<boolean>((resolve) => {
          socket.once('connect', () => resolve(true));
          socket.once('connect_error', () => resolve(false));
        });
        if (connected) {
          for (const h of list) {
            const refused = new Promise<boolean>((resolve) => {
              socket.once('exception', () => resolve(true));
              setTimeout(() => resolve(false), 2000);
            });
            socket.emit(h.message, { executionId: ids.execution, taskId: ids.task });
            if (!(await refused)) failures.push(`${namespace} ${h.message}`);
          }
        }
        socket.close();
      }
      expect(failures).toEqual([]);
    }, 120000);

  });

  describe('scoped and worker entry points, called from another workspace with A ids', () => {
    let before: Record<string, string>;

    beforeAll(async () => {
      before = await stableSnapshot();
    }, 30000);

    it('read the canary when A calls them (the sweep reaches the rows)', async () => {
      for (const path of [`/tasks/tasks/${ids.task}`, `/context/blocks/${ids.block}`, `/threads/${ids.thread}`]) {
        const res = await call(tokenA, 'GET', path).expect(200);
        expect(res.text).toContain(CANARY);
      }
    });

    it('never return A content or change A rows over REST', async () => {
      // A worker of workspace B with the same OAuth client as A's worker: only the workspace tells them apart.
      const workerB = await sign(WORKSPACE_B_ID, { clientId: WORKER_A });
      const order = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      const targets = routes
        .filter((r) => (r.mode === 'scoped' || r.mode === 'worker') && !r.path.endsWith('/mcp'))
        .sort((a, b) => order.indexOf(a.method) - order.indexOf(b.method));
      const failures: string[] = [];
      const rejectedByValidation: string[] = [];
      for (const route of targets) {
        const { path, query, body } = buildRequest(route);
        const token = route.mode === 'worker' ? workerB : tokenB;
        const res = await call(token, route.method, path).query(query).send(body ?? {});
        const found = leaks(res.text ?? '', res.status < 300);
        if (found.length) failures.push(`${route.method} ${route.path}: ${res.status} leaks ${found.join(',')}`);
        // Another workspace's id is a plain "not found", never an unhandled error.
        if (res.status >= 500) failures.push(`${route.method} ${route.path}: ${res.status}`);
        const upload = !!operation(route)?.requestBody?.content?.['multipart/form-data'];
        if (res.body?.code === 'VALIDATION_FAILED' && !upload) rejectedByValidation.push(`${route.method} ${route.path} ${JSON.stringify(body)} ${res.text}`);
      }
      expect(failures).toEqual([]);
      // The sweep must reach the handlers: built bodies pass validation.
      expect(rejectedByValidation).toEqual([]);
      expect(diff(before, await stableSnapshot())).toEqual([]);
    }, 300000);

    it('never let another worker of the same workspace act on an execution', async () => {
      const other = await sign(DEFAULT_WORKSPACE_ID, { clientId: OTHER_WORKER });
      const failures: string[] = [];
      for (const route of routes.filter((r) => r.mode === 'worker')) {
        const { path, query, body } = buildRequest(route);
        const res = await call(other, route.method, path).query(query).send(body ?? {});
        if (res.status < 300 || leaks(res.text ?? '', false).length) {
          failures.push(`${route.method} ${route.path}: ${res.status}`);
        }
      }
      expect(failures).toEqual([]);
      expect(diff(before, await stableSnapshot())).toEqual([]);
    }, 120000);

    it('never return A content or change A rows over MCP', async () => {
      const mcpPaths = routes.filter((r) => r.mode === 'scoped' && r.path.endsWith('/mcp')).map((r) => r.path);
      expect(mcpPaths.length).toBeGreaterThanOrEqual(2);
      const rpc = (path: string, method: string, params: object) =>
        call(tokenB, 'POST', path)
          .set('Accept', 'application/json, text/event-stream')
          .send({ jsonrpc: '2.0', id: 1, method, params });
      const failures: string[] = [];
      let toolCount = 0;
      for (const path of mcpPaths) {
        const tools = (await rpc(path, 'tools/list', {}).expect(200)).body.result.tools;
        for (const tool of tools) {
          toolCount++;
          const args = sample(tool.inputSchema, 'args', path) as object;
          const res = await rpc(path, 'tools/call', { name: tool.name, arguments: args });
          const ok = res.status < 300 && !res.body?.error && !res.body?.result?.isError;
          const found = leaks(res.text ?? '', ok);
          if (found.length) failures.push(`${path} ${tool.name}: leaks ${found.join(',')}`);
        }
      }
      expect(toolCount).toBeGreaterThan(20);
      expect(failures).toEqual([]);
      expect(diff(before, await stableSnapshot())).toEqual([]);
    }, 300000);

    it('never send A content or ids to sockets of another workspace', async () => {
      const heard: string[] = [];
      const sockets: Socket[] = [];
      const workerB = await sign(WORKSPACE_B_ID, { clientId: WORKER_A });
      const namespaces = new Set(handlers.filter((h) => h.mode !== 'default-only').map((h) => h.namespace));
      const probe = Object.fromEntries(
        ['taskId', 'blockId', 'threadId', 'executionId'].map((key) => [key, idFor(key)]),
      );
      for (const namespace of namespaces) {
        const socket = io(`http://127.0.0.1:${port}${namespace}`, {
          auth: { token: namespace === '/executions/worker' ? workerB : tokenB },
          transports: ['websocket'],
          forceNew: true,
        });
        sockets.push(socket);
        socket.onAny((event, payload) => heard.push(`${namespace} ${event} ${JSON.stringify(payload)}`));
        await new Promise<void>((resolve) => {
          socket.once('connect', () => resolve());
          socket.once('connect_error', () => resolve());
        });
        if (!socket.connected) continue;
        for (const h of handlers.filter((x) => x.namespace === namespace)) {
          for (const body of [{}, probe]) {
            const ack = await socket.timeout(2000).emitWithAck(h.message, body).catch(() => undefined);
            heard.push(`${namespace} ack ${h.message} ${JSON.stringify(ack)}`);
          }
        }
      }

      // A works on its rows while B listens: the same person, in both workspaces.
      await call(tokenA, 'PATCH', `/tasks/tasks/${ids.task}`).send({ description: `Edited ${CANARY}` }).expect(200);
      await call(tokenA, 'POST', `/tasks/tasks/${ids.task}/comments`).send({ content: `Again ${CANARY}` }).expect(201);
      await call(tokenA, 'PATCH', `/context/blocks/${ids.block}`).send({ content: `Edited ${CANARY}` }).expect(200);
      await call(tokenA, 'PATCH', `/threads/${ids.thread}`).send({ title: `Renamed ${CANARY}` }).expect(200);
      await call(tokenA, 'POST', `/threads/${ids.thread}/read`).send({});
      await call(tokenA, 'PUT', `/threads/${ids.thread}/pin`).send({});
      await call(tokenA, 'DELETE', `/threads/${ids.thread}/pin`).send({});
      await new Promise((r) => setTimeout(r, 1000));
      sockets.forEach((s) => s.close());

      const leaked = heard.filter((line) => leaks(line, true).length);
      expect(leaked).toEqual([]);
    }, 300000);
  });

  describe('the A snapshot', () => {
    it('notices a change to A rows (the sweeps would see one)', async () => {
      const before = await stableSnapshot();
      await call(tokenA, 'POST', `/tasks/tasks/${ids.task}/comments`).send({ content: 'control' }).expect(201);
      expect(diff(before, await stableSnapshot())).toContain('comments');
    }, 30000);
  });

  describe('worker calls of the claiming worker', () => {
    it('still work', async () => {
      const workerA = await sign(DEFAULT_WORKSPACE_ID, { clientId: WORKER_A });
      await call(workerA, 'PATCH', `/executions/active/${ids.execution}/tool-calls/increment`).expect(204);
      const socket = io(`http://127.0.0.1:${port}/executions/worker`, {
        auth: { token: workerA },
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });
      const ack = await socket
        .timeout(5000)
        .emitWithAck(ExecutionWireEvents.EXECUTION_ACTIVITY_POST, { executionId: ids.execution, kind: 'probe' });
      socket.close();
      expect(ack).toEqual({ ok: true });
    });

    it('refuse another worker of the same workspace on the worker socket', async () => {
      const other = await sign(DEFAULT_WORKSPACE_ID, { clientId: OTHER_WORKER });
      const socket = io(`http://127.0.0.1:${port}/executions/worker`, {
        auth: { token: other },
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });
      const executionId = ids.execution;
      const acks = await Promise.all([
        socket.timeout(5000).emitWithAck(ExecutionWireEvents.EXECUTION_ACTIVITY_POST, { executionId, kind: 'probe' }),
        socket.timeout(5000).emitWithAck(ExecutionWireEvents.EXECUTION_HEARTBEAT_POST, { executionId }),
        socket.timeout(5000).emitWithAck(ExecutionWireEvents.EXECUTION_TRACE_POST, {
          executionId,
          harness: 'claude',
          events: [{ sequence: 1, emittedAt: new Date().toISOString(), runnerSessionId: null, payload: {} }],
        }),
      ]);
      socket.close();
      expect(acks.map((ack: any) => ack.ok)).toEqual([false, false, false]);
    });
  });

  describe('workers of another workspace', () => {
    const connectWorker = async (token: string) => {
      const socket = io(`http://127.0.0.1:${port}/executions/worker`, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
      });
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });
      return socket;
    };

    it("never hear, list or claim A's queued work, even with the same OAuth client", async () => {
      const workerA = await connectWorker(await sign(DEFAULT_WORKSPACE_ID, { clientId: WORKER_A }));
      const workerB = await connectWorker(await sign(WORKSPACE_B_ID, { clientId: WORKER_A }));
      const heardA: string[] = [];
      const heardB: string[] = [];
      workerA.on(ExecutionWireEvents.TASK_EXECUTION_QUEUED, (e: { taskId: string }) => heardA.push(e.taskId));
      workerB.onAny((event, payload) => heardB.push(`${event} ${JSON.stringify(payload)}`));

      const runner = await app.get(AgentsService).createAgent(DEFAULT_WORKSPACE_ID, {
        slug: `entry-points-runner-${hex}`,
        name: `Runner ${CANARY}`,
        systemPrompt: 'run',
        statusTriggers: [TaskStatus.NOT_STARTED],
        allowedTools: [],
      });
      const task = (
        await call(tokenA, 'POST', '/tasks/tasks')
          .send({ name: `Queued ${CANARY}`, description: 'queued', assigneeActorId: runner.actorId })
          .expect(201)
      ).body;

      for (let i = 0; i < 40 && !heardA.includes(task.id); i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
      expect(heardA).toContain(task.id);

      const workerTokenB = await sign(WORKSPACE_B_ID, { clientId: WORKER_A });
      const queueB = await call(workerTokenB, 'GET', '/executions/queue').expect(200);
      expect(queueB.text).not.toContain(task.id);
      await call(workerTokenB, 'POST', `/executions/queue/${task.id}/claim`).expect(404);
      const queueA = await call(await sign(DEFAULT_WORKSPACE_ID, { clientId: WORKER_A }), 'GET', '/executions/queue').expect(200);
      expect(queueA.text).toContain(task.id);

      workerA.close();
      workerB.close();
      expect(heardB.filter((line) => line.includes(task.id))).toEqual([]);
    }, 30000);

    it("set up and run their own workspace's agent with Taico's baseline tools only", async () => {
      const workerTokenB = await sign(WORKSPACE_B_ID, { clientId: WORKER_A });
      // A registry server of the default workspace, which B must not see.
      const privateServer = (
        await call(tokenA, 'POST', '/mcp/servers')
          .send({
            providedId: `entry-points-private-${hex}`,
            name: `Private ${CANARY}`,
            description: `Private ${CANARY}`,
            type: 'http',
            url: `https://private-${hex}.example.test/mcp`,
          })
          .expect(201)
      ).body;

      const agentB = await app.get(AgentsService).createAgent(WORKSPACE_B_ID, {
        slug: `entry-points-b-runner-${hex}`,
        name: 'B runner',
        systemPrompt: 'run',
        statusTriggers: [TaskStatus.NOT_STARTED],
        allowedTools: [],
      });
      const taskB = (
        await call(tokenB, 'POST', '/tasks/tasks')
          .send({ name: 'B work', description: 'b', assigneeActorId: agentB.actorId })
          .expect(201)
      ).body;

      // Claim it, as the worker does when it hears the task was queued.
      let queued = false;
      for (let i = 0; i < 40 && !queued; i++) {
        const queue = await call(workerTokenB, 'GET', '/executions/queue').expect(200);
        queued = queue.text.includes(taskB.id);
        if (!queued) await new Promise((r) => setTimeout(r, 250));
      }
      expect(queued).toBe(true);
      const execution = (
        await call(workerTokenB, 'POST', `/executions/queue/${taskB.id}/claim`).expect(201)
      ).body;

      // The worker's setup calls (apps/worker/src/task-runner.ts), in order.
      const permissions = (
        await call(workerTokenB, 'GET', `/agents/${agentB.actorId}/tool-permissions`).expect(200)
      ).body as { server: { id: string; providedId: string } }[];
      expect(permissions.map((p) => p.server.providedId).sort()).toEqual(['context', 'tasks']);
      const servers = await Promise.all(
        permissions.map(
          async (p) => (await call(workerTokenB, 'GET', `/mcp/servers/${p.server.id}`).expect(200)).body,
        ),
      );
      expect(servers.map((s: { providedId: string }) => s.providedId).sort()).toEqual(['context', 'tasks']);
      await call(workerTokenB, 'GET', `/mcp/servers/${privateServer.id}`).expect(404);
      await call(workerTokenB, 'GET', `/mcp/servers/${privateServer.providedId}`).expect(404);
      await call(tokenA, 'GET', `/mcp/servers/${privateServer.id}`).expect(200);

      const agentToken = (
        await call(workerTokenB, 'POST', `/agents/${agentB.slug}/execution-token`)
          .send({ expirationSeconds: 600 })
          .expect(201)
      ).body.token as string;

      // The harness's first tool calls, on the tasks server the worker was given.
      const tasksServer = servers.find((s: { providedId: string }) => s.providedId === 'tasks');
      const mcpPath = new URL(tasksServer.url).pathname;
      const callTool = async (name: string, args: Record<string, unknown>) => {
        const res = await request(http)
          .post(mcpPath)
          .set('Authorization', `Bearer ${agentToken}`)
          .set('x-taico-execution-id', execution.id)
          .set('Accept', 'application/json, text/event-stream')
          .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
          .expect(200);
        return res.body.error ? { isError: true, text: res.body.error.message } : {
          isError: Boolean(res.body.result.isError),
          text: res.body.result.content.map((c: { text: string }) => c.text).join('\n'),
        };
      };
      const own = await callTool('add_comment', { taskId: taskB.id, content: `Done ${hex}` });
      expect(own.isError).toBe(false);
      const commented = (await call(tokenB, 'GET', `/tasks/tasks/${taskB.id}`).expect(200)).body;
      expect(
        commented.comments.find((c: { content: string }) => c.content === `Done ${hex}`)?.commenterActor.id,
      ).toBe(agentB.actorId);

      const foreign = await callTool('fetch', { taskId: ids.task });
      expect(foreign.isError).toBe(true);
      expect(foreign.text).not.toContain(CANARY);
    }, 30000);

    it('are registered in their own workspace and listed only there', async () => {
      await db.getRepository(RegisteredClientEntity).save({
        clientId: `${WORKER_A}-b-only`,
        clientName: 'Workspace B worker',
        redirectUris: ['http://127.0.0.1/callback'],
        grantTypes: [],
        scopes: [],
        tokenEndpointAuthMethod: TokenEndpointAuthMethod.NONE,
      });
      const workerB = await connectWorker(await sign(WORKSPACE_B_ID, { clientId: `${WORKER_A}-b-only` }));
      await new Promise((r) => setTimeout(r, 500));
      workerB.close();
      const listB = await call(tokenB, 'GET', '/workers').expect(200);
      const listA = await call(tokenA, 'GET', '/workers').expect(200);
      expect(listB.body.map((w: { oauthClientId: string }) => w.oauthClientId)).toContain(`${WORKER_A}-b-only`);
      expect(listA.body.map((w: { oauthClientId: string }) => w.oauthClientId)).not.toContain(`${WORKER_A}-b-only`);
    }, 30000);
  });
});
