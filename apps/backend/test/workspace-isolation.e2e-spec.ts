import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { TaskWireEvents } from '@taico/events';
import { AppModule } from '../src/app.module';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { TokenSignerService } from '../src/auth/crypto/token-signer.service';
import { AccessTokenClaims } from '../src/auth/core/types/access-token-claims.type';
import { getConfig } from '../src/config/env.config';
import { ActorType } from '../src/identity-provider/enums';
import { WorkspaceEntity } from '../src/workspaces/workspace.entity';
import { WorkspaceMemberEntity } from '../src/workspaces/workspace-member.entity';
import { WorkspaceRole } from '../src/workspaces/enums';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import { ContextWireEvents } from '../src/context/api/context.wire-events';
import { TasksScopes } from '../src/tasks/tasks.scopes';
import { ContextScopes } from '../src/context/context.scopes';
import { MetaScopes } from '../src/meta/meta.scopes';
import { McpScopes } from '../src/auth/core/scopes/mcp.scopes';
import {
  ensureAgentActor,
  ensureTestUser,
  TEST_USER_SLUG,
} from './helpers/auth.helper';

/** A second workspace; the test user is a member of both. */
const WORKSPACE_B_ID = '33333333-3333-4333-8333-333333333333';

const TASKS_MCP_PATH = '/api/v1/tasks/tasks/mcp';
const CONTEXT_MCP_PATH = '/api/v1/context/blocks/mcp';

/**
 * Workspaces phase 3a: tasks, context blocks, tags and projects in one
 * workspace cannot be seen or changed from another, over REST, MCP or the
 * WebSocket. Another workspace's row answers "not found".
 */
describe('Workspace isolation: tasks, context and meta (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let port: number;
  let actorId: string;
  let tokenA: string;
  let tokenB: string;

  // Rows created in workspace A (the default workspace).
  let taskA: { id: string };
  let blockA: { id: string };
  const suffix = randomBytes(4).toString('hex');
  const tagName = `iso-${suffix}`;
  const projectSlug = `iso-${suffix}`;

  /** A first-party token for the test user in a workspace, with every scope these modules use. */
  async function signToken(workspaceId: string): Promise<string> {
    const config = getConfig();
    const now = Math.floor(Date.now() / 1000);
    const claims: AccessTokenClaims = {
      iss: config.issuerUrl,
      sub: actorId,
      workspace_id: workspaceId,
      actor_id: actorId,
      actor_slug: TEST_USER_SLUG,
      actor_type: ActorType.HUMAN,
      aud: config.issuerUrl,
      exp: now + 600,
      iat: now,
      jti: randomBytes(16).toString('hex'),
      client_id: 'web-app',
      scope: [
        TasksScopes.READ.id,
        TasksScopes.WRITE.id,
        ContextScopes.READ.id,
        ContextScopes.WRITE.id,
        MetaScopes.READ.id,
        MetaScopes.WRITE.id,
        McpScopes.USE.id,
      ],
      resource: config.issuerUrl,
      version: '0.0.0',
    };
    return app.get(TokenSignerService).signToken(claims);
  }

  const as = (token: string) => ({
    get: (path: string) =>
      request(http)
        .get(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`),
    post: (path: string) =>
      request(http)
        .post(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`),
    patch: (path: string) =>
      request(http)
        .patch(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`),
    delete: (path: string) =>
      request(http)
        .delete(`/api/v1${path}`)
        .set('Authorization', `Bearer ${token}`),
  });

  /** Calls an MCP tool; returns its result (`isError` set when the tool failed). */
  async function callTool(
    path: string,
    token: string,
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ isError?: boolean; content: { type: string; text: string }[] }> {
    const res = await request(http)
      .post(path)
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      })
      .expect(200);
    if (res.body.error) {
      return {
        isError: true,
        content: [{ type: 'text', text: res.body.error.message }],
      };
    }
    return res.body.result;
  }

  async function connect(namespace: string, token: string): Promise<Socket> {
    const socket = io(`http://127.0.0.1:${port}${namespace}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  }

  /** Collects the payload ids of an event a socket hears. */
  function collect(socket: Socket, event: string, idOf: (e: any) => string) {
    const ids: string[] = [];
    socket.on(event, (e) => ids.push(idOf(e)));
    return ids;
  }

  const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    http = app.getHttpServer();
    port = (http as unknown as { address(): { port: number } }).address().port;

    actorId = await ensureTestUser(app);
    const workspaces: Repository<WorkspaceEntity> = app.get(
      getRepositoryToken(WorkspaceEntity),
    );
    const members: Repository<WorkspaceMemberEntity> = app.get(
      getRepositoryToken(WorkspaceMemberEntity),
    );
    await workspaces
      .createQueryBuilder()
      .insert()
      .values({ id: WORKSPACE_B_ID, slug: 'isolation-b', name: 'Isolation B' })
      .orIgnore()
      .execute();
    await members
      .createQueryBuilder()
      .insert()
      .values({
        workspaceId: WORKSPACE_B_ID,
        actorId,
        role: WorkspaceRole.ADMIN,
      })
      .orIgnore()
      .execute();

    tokenA = await signToken(DEFAULT_WORKSPACE_ID);
    tokenB = await signToken(WORKSPACE_B_ID);

    taskA = (
      await as(tokenA)
        .post('/tasks/tasks')
        .send({
          name: `Task in A ${suffix}`,
          description: 'Only workspace A can see this',
          tagNames: [tagName, `project:${projectSlug}`],
        })
        .expect(201)
    ).body;
    await as(tokenA)
      .post(`/tasks/tasks/${taskA.id}/comments`)
      .send({ content: 'A comment in A' })
      .expect(201);
    blockA = (
      await as(tokenA)
        .post('/context/blocks')
        .send({
          title: `Block in A ${suffix}`,
          content: 'A only',
          tagNames: [tagName],
        })
        .expect(201)
    ).body;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('over REST', () => {
    it('answers not found for a task in another workspace', async () => {
      await as(tokenB).get(`/tasks/tasks/${taskA.id}`).expect(404);
      await as(tokenB)
        .patch(`/tasks/tasks/${taskA.id}`)
        .send({ name: 'x' })
        .expect(404);
      await as(tokenB)
        .patch(`/tasks/tasks/${taskA.id}/status`)
        .send({ status: 'IN_PROGRESS' })
        .expect(404);
      await as(tokenB)
        .post(`/tasks/tasks/${taskA.id}/comments`)
        .send({ content: 'sneaky' })
        .expect(404);
      await as(tokenB)
        .post(`/tasks/tasks/${taskA.id}/tags`)
        .send({ name: 'x' })
        .expect(404);
      await as(tokenB).delete(`/tasks/tasks/${taskA.id}`).expect(404);

      // Still there, unchanged, for its own workspace.
      const task = (
        await as(tokenA).get(`/tasks/tasks/${taskA.id}`).expect(200)
      ).body;
      expect(task.name).toBe(`Task in A ${suffix}`);
      expect(task.comments.map((c: any) => c.content)).toEqual([
        'A comment in A',
      ]);
    });

    it('leaves another workspace out of task lists', async () => {
      const inB = (await as(tokenB).get('/tasks/tasks?limit=100').expect(200))
        .body;
      expect(inB.items.map((t: any) => t.id)).not.toContain(taskA.id);
      const byTag = (
        await as(tokenB).get(`/tasks/tasks?tag=${tagName}`).expect(200)
      ).body;
      expect(byTag.items).toHaveLength(0);

      const inA = (
        await as(tokenA).get(`/tasks/tasks?tag=${tagName}`).expect(200)
      ).body;
      expect(inA.items.map((t: any) => t.id)).toEqual([taskA.id]);
    });

    it('does not let a task in one workspace depend on a task in another', async () => {
      const res = await as(tokenB)
        .post('/tasks/tasks')
        .send({ name: 'B task', description: 'd', dependsOnIds: [taskA.id] });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('only assigns members of the workspace', async () => {
      // A new agent is only a member of the default workspace.
      const agentId = await ensureAgentActor(
        app,
        `iso-agent-${suffix}`,
        'Isolation agent',
      );
      const taskB = (
        await as(tokenB)
          .post('/tasks/tasks')
          .send({ name: 'B task', description: 'd' })
          .expect(201)
      ).body;
      await as(tokenB)
        .patch(`/tasks/tasks/${taskB.id}/assign`)
        .send({ assigneeActorId: agentId })
        .expect(404);
      await as(tokenA)
        .patch(`/tasks/tasks/${taskA.id}/assign`)
        .send({ assigneeActorId: agentId })
        .expect(200);
    });

    it('answers not found for a context block in another workspace', async () => {
      await as(tokenB).get(`/context/blocks/${blockA.id}`).expect(404);
      await as(tokenB)
        .patch(`/context/blocks/${blockA.id}`)
        .send({ title: 'x' })
        .expect(404);
      await as(tokenB)
        .post(`/context/blocks/${blockA.id}/append`)
        .send({ content: 'x' })
        .expect(404);
      await as(tokenB).delete(`/context/blocks/${blockA.id}`).expect(404);
      // Nor can a block in B be nested under it.
      await as(tokenB)
        .post('/context/blocks')
        .send({ title: 'child', content: 'c', parentId: blockA.id })
        .expect(404);

      const block = (
        await as(tokenA).get(`/context/blocks/${blockA.id}`).expect(200)
      ).body;
      expect(block.content).toBe('A only');
    });

    it('leaves another workspace out of block lists and the tree', async () => {
      const list = (await as(tokenB).get('/context/blocks').expect(200)).body;
      expect(list.items.map((b: any) => b.id)).not.toContain(blockA.id);
      const tree = (await as(tokenB).get('/context/blocks/tree').expect(200))
        .body;
      expect(JSON.stringify(tree)).not.toContain(blockA.id);
    });

    it('keeps tags and projects per workspace', async () => {
      const tagsB = (await as(tokenB).get('/meta/tags').expect(200)).body;
      expect(tagsB.map((t: any) => t.name)).not.toContain(tagName);
      await as(tokenB).get(`/meta/projects/by-slug/${projectSlug}`).expect(404);
      const projectsB = (await as(tokenB).get('/meta/projects').expect(200))
        .body;
      expect(projectsB.map((p: any) => p.slug)).not.toContain(projectSlug);

      // The same names are free in workspace B, as different rows.
      const tagA = (await as(tokenA).get('/meta/tags').expect(200)).body.find(
        (t: any) => t.name === tagName,
      );
      const tagB = (
        await as(tokenB).post('/meta/tags').send({ name: tagName }).expect(201)
      ).body;
      expect(tagB.id).not.toBe(tagA.id);

      const projectA = (
        await as(tokenA)
          .get(`/meta/projects/by-slug/${projectSlug}`)
          .expect(200)
      ).body;
      const projectB = (
        await as(tokenB)
          .post('/meta/projects')
          .send({ slug: projectSlug })
          .expect(201)
      ).body;
      expect(projectB.id).not.toBe(projectA.id);

      // Deleting B's tag leaves A's alone.
      await as(tokenB).delete(`/meta/tags/${tagA.id}`).expect(204);
      const tagsA = (await as(tokenA).get('/meta/tags').expect(200)).body;
      expect(tagsA.map((t: any) => t.id)).toContain(tagA.id);
      await as(tokenB).get(`/meta/projects/${projectA.id}`).expect(404);
    });
  });

  describe('over MCP', () => {
    it('answers not found for a task in another workspace', async () => {
      const fetched = await callTool(TASKS_MCP_PATH, tokenB, 'fetch', {
        taskId: taskA.id,
      });
      expect(fetched.isError).toBe(true);
      const commented = await callTool(TASKS_MCP_PATH, tokenB, 'add_comment', {
        taskId: taskA.id,
        content: 'sneaky',
      });
      expect(commented.isError).toBe(true);

      const listed = await callTool(TASKS_MCP_PATH, tokenB, 'list_tasks', {});
      expect(listed.content[0].text).not.toContain(taskA.id);

      const ownFetch = await callTool(TASKS_MCP_PATH, tokenA, 'fetch', {
        taskId: taskA.id,
      });
      expect(ownFetch.isError).toBeFalsy();
      expect(ownFetch.content[0].text).not.toContain('sneaky');
    });

    it('answers not found for a context block in another workspace', async () => {
      const got = await callTool(CONTEXT_MCP_PATH, tokenB, 'get_block', {
        blockId: blockA.id,
      });
      expect(got.isError).toBe(true);
      const updated = await callTool(CONTEXT_MCP_PATH, tokenB, 'update_block', {
        blockId: blockA.id,
        content: 'overwritten',
      });
      expect(updated.isError).toBe(true);

      const ownGet = await callTool(CONTEXT_MCP_PATH, tokenA, 'get_block', {
        blockId: blockA.id,
      });
      expect(ownGet.isError).toBeFalsy();
      expect(ownGet.content[0].text).toContain('A only');
    });
  });

  describe('over the WebSocket', () => {
    it('only sends task events to sockets in the same workspace', async () => {
      const socketA = await connect('/tasks', tokenA);
      const socketB = await connect('/tasks', tokenB);
      try {
        await socketA.timeout(5000).emitWithAck('tasks.subscribe', {});
        await socketB.timeout(5000).emitWithAck('tasks.subscribe', {});
        const heardA = collect(
          socketA,
          TaskWireEvents.TASK_CREATED,
          (e) => e.payload.id,
        );
        const heardB = collect(
          socketB,
          TaskWireEvents.TASK_CREATED,
          (e) => e.payload.id,
        );

        const created = (
          await as(tokenA)
            .post('/tasks/tasks')
            .send({ name: 'Realtime A', description: 'd' })
            .expect(201)
        ).body;
        await settle();

        expect(heardA).toContain(created.id);
        expect(heardB).not.toContain(created.id);
      } finally {
        socketA.disconnect();
        socketB.disconnect();
      }
    });

    it('only sends context events to sockets in the same workspace', async () => {
      const socketA = await connect('/context', tokenA);
      const socketB = await connect('/context', tokenB);
      try {
        await socketA.timeout(5000).emitWithAck('context.subscribe', {});
        await socketB.timeout(5000).emitWithAck('context.subscribe', {});
        // B cannot follow a block from another workspace.
        const ack = await socketB
          .timeout(5000)
          .emitWithAck('context.subscribe', { blockId: blockA.id });
        expect(ack.ok).toBe(false);

        const heardA = collect(
          socketA,
          ContextWireEvents.CONTEXT_BLOCK_UPDATED,
          (e) => e.payload.id,
        );
        const heardB = collect(
          socketB,
          ContextWireEvents.CONTEXT_BLOCK_UPDATED,
          (e) => e.payload.id,
        );

        await as(tokenA)
          .patch(`/context/blocks/${blockA.id}`)
          .send({ title: 'Renamed in A' })
          .expect(200);
        await settle();

        expect(heardA).toContain(blockA.id);
        expect(heardB).not.toContain(blockA.id);
      } finally {
        socketA.disconnect();
        socketB.disconnect();
      }
    });
  });
});
