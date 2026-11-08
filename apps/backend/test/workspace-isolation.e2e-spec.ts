import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { randomBytes } from 'crypto';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { TaskWireEvents, ThreadWireEvents } from '@taico/events';
import { AppModule } from '../src/app.module';
import { FakeGithub } from './helpers/fake-github';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { TokenSignerService } from '../src/auth/crypto/token-signer.service';
import { AccessTokenClaims } from '../src/auth/core/types/access-token-claims.type';
import { getConfig } from '../src/config/env.config';
import { ActorType, UserRole } from '../src/identity-provider/enums';
import { IdentityProviderService } from '../src/identity-provider/identity-provider.service';
import {
  InvalidCredentialsError,
  UserSlugConflictError,
} from '../src/identity-provider/errors/identity-provider.errors';
import { ActorService } from '../src/identity-provider/actor.service';
import { WorkspaceEntity } from '../src/workspaces/workspace.entity';
import { WorkspaceMemberEntity } from '../src/workspaces/workspace-member.entity';
import { WorkspaceRole } from '../src/workspaces/enums';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import { ContextWireEvents } from '../src/context/api/context.wire-events';
import { TasksScopes } from '../src/tasks/tasks.scopes';
import { ContextScopes } from '../src/context/context.scopes';
import { MetaScopes } from '../src/meta/meta.scopes';
import { McpScopes } from '../src/auth/core/scopes/mcp.scopes';
import { ThreadsScopes } from '../src/threads/threads.scopes';
import { AgentRunsScopes } from '../src/agent-runs/agent-runs.scopes';
import { PullRequestsScopes } from '../src/pull-requests/pull-requests.scopes';
import { IssuesScopes } from '../src/issues/issues.scopes';
import { AgentsScopes } from '../src/agents/agents.scopes';
import { ThreadTaskSubscriptionsService } from '../src/threads/task-subscriptions/thread-task-subscriptions.service';
import { ThreadTimersService } from '../src/threads/timers/thread-timers.service';
import { ThreadTimerKind } from '../src/threads/timers/thread-timer.enums';
import { ThreadWatchesService } from '../src/threads/watches/thread-watches.service';
import { ThreadWatchKind } from '../src/threads/watches/thread-watch.enums';
import { ThreadTurnsService } from '../src/threads/agent/thread-turns.service';
import { ThreadAgentLogService } from '../src/threads/agent/thread-agent-log.service';
import { ThreadAgentMessageRole, ThreadTurnStatus } from '../src/threads/agent/thread-agent.enums';
import { TaskStatus } from '../src/tasks/enums';
import { ThreadAgentToolsFactory } from '../src/threads/agent/thread-agent-tools.factory';
import { GET_PULL_REQUEST_TOOL } from '../src/threads/agent/thread-agent.prompts';
import { WATCH_PULL_REQUEST_TOOL } from '../src/threads/watches/pull-request-watch.format';
import { PullRequestEntity } from '../src/pull-requests/pull-request.entity';
import { IssueEntity } from '../src/issues/issue.entity';
import { AgentsService } from '../src/agents/agents.service';
import { DataSource } from 'typeorm';
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
 * Workspaces phase 3: tasks, context blocks, tags and projects (3a) and
 * threads with everything that hangs off them (3b) in one workspace cannot
 * be seen or changed from another, over REST, MCP or the WebSocket. Another
 * workspace's row answers "not found".
 */
describe('Workspace isolation: tasks, context, meta and threads (e2e)', () => {
  let app: INestApplication<App>;
  let http: App;
  let port: number;
  let actorId: string;
  let tokenA: string;
  let tokenB: string;

  // Rows created in workspace A (the default workspace).
  let taskA: { id: string };
  let blockA: { id: string };
  let threadA: { id: string; stateContextBlockId: string };
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
        ThreadsScopes.READ.id,
        ThreadsScopes.WRITE.id,
        AgentRunsScopes.READ.id,
        AgentRunsScopes.WRITE.id,
        PullRequestsScopes.READ.id,
        IssuesScopes.READ.id,
        McpScopes.USE.id,
        AgentsScopes.READ.id,
        AgentsScopes.WRITE.id,
        AgentsScopes.ACT_AS.id,
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
    put: (path: string) =>
      request(http)
        .put(`/api/v1${path}`)
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
    threadA = (
      await as(tokenA)
        .post('/threads')
        .send({
          title: `Thread in A ${suffix}`,
          taskIds: [taskA.id],
          contextBlockIds: [blockA.id],
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
      const name = `B dependent ${suffix}`;
      const res = await as(tokenB)
        .post('/tasks/tasks')
        .send({ name, description: 'd', dependsOnIds: [taskA.id] });
      expect(res.status).toBeGreaterThanOrEqual(400);

      // The failed request leaves no task behind.
      const inB = (await as(tokenB).get('/tasks/tasks?limit=100').expect(200))
        .body;
      expect(inB.items.map((t: any) => t.name)).not.toContain(name);
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
      // Nor through the general update, which then changes nothing.
      await as(tokenB)
        .patch(`/tasks/tasks/${taskB.id}`)
        .send({ name: 'renamed', assigneeActorId: agentId })
        .expect(404);
      const unchanged = (
        await as(tokenB).get(`/tasks/tasks/${taskB.id}`).expect(200)
      ).body;
      expect(unchanged.name).toBe('B task');
      expect(unchanged.assigneeActor).toBeFalsy();

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

  describe('threads', () => {
    it('creates a thread and its state block in the caller workspace', async () => {
      const threadB = (
        await as(tokenB)
          .post('/threads')
          .send({ title: `Thread in B ${suffix}`, tagNames: [tagName] })
          .expect(201)
      ).body;
      await as(tokenB)
        .get(`/context/blocks/${threadB.stateContextBlockId}`)
        .expect(200);
      await as(tokenA)
        .get(`/context/blocks/${threadB.stateContextBlockId}`)
        .expect(404);
      const blocksA = (await as(tokenA).get('/context/blocks').expect(200))
        .body;
      expect(blocksA.items.map((b: any) => b.id)).not.toContain(
        threadB.stateContextBlockId,
      );
      await as(tokenA).get(`/threads/${threadB.id}/state`).expect(404);
      await as(tokenB).get(`/threads/${threadB.id}/state`).expect(200);
    });

    it('does not create a thread around rows of another workspace', async () => {
      await as(tokenB)
        .post('/threads')
        .send({ title: `Orphan ${suffix}`, taskIds: [taskA.id] })
        .expect(404);
      await as(tokenB)
        .post('/threads')
        .send({ title: `Orphan ${suffix}`, parentTaskId: taskA.id })
        .expect(404);
      await as(tokenB)
        .post('/threads')
        .send({ title: `Orphan ${suffix}`, contextBlockIds: [blockA.id] })
        .expect(404);
      // The failed requests left no state block (nor thread) behind.
      const blocksB = (await as(tokenB).get('/context/blocks').expect(200))
        .body;
      expect(blocksB.items.map((b: any) => b.title)).not.toContain(
        `Thread State: Orphan ${suffix}`,
      );
    });

    it('answers not found for a thread or its rows in another workspace', async () => {
      // Finding the thread of another workspace's task.
      const byTask = await as(tokenB)
        .get(`/threads/by-task/${taskA.id}`)
        .expect(200);
      expect(byTask.text).not.toContain(taskA.id);
      const ownByTask = (
        await as(tokenA).get(`/threads/by-task/${taskA.id}`).expect(200)
      ).body;
      expect(ownByTask.id).toBe(threadA.id);

      await as(tokenB).get(`/threads/${threadA.id}`).expect(404);
      await as(tokenB).get(`/threads/${threadA.id}/state`).expect(404);
      await as(tokenB)
        .patch(`/threads/${threadA.id}/state`)
        .send({ content: 'overwritten' })
        .expect(404);
      await as(tokenB)
        .post(`/threads/${threadA.id}/state/append`)
        .send({ content: 'sneaky' })
        .expect(404);
      await as(tokenB)
        .post(`/threads/${threadA.id}/tags`)
        .send({ name: 'x' })
        .expect(404);
      await as(tokenB).delete(`/threads/${threadA.id}`).expect(404);

      // Attaching across workspaces, in either direction.
      const taskB = (
        await as(tokenB)
          .post('/tasks/tasks')
          .send({ name: 'B task for threads', description: 'd' })
          .expect(201)
      ).body;
      const threadB = (
        await as(tokenB)
          .post('/threads')
          .send({ title: `Second thread in B ${suffix}` })
          .expect(201)
      ).body;
      await as(tokenB)
        .post(`/threads/${threadA.id}/tasks`)
        .send({ taskId: taskB.id })
        .expect(404);
      await as(tokenB)
        .post(`/threads/${threadB.id}/tasks`)
        .send({ taskId: taskA.id })
        .expect(404);
      await as(tokenB)
        .post(`/threads/${threadB.id}/context-blocks`)
        .send({ contextBlockId: blockA.id })
        .expect(404);

      const ownThread = (
        await as(tokenA).get(`/threads/${threadA.id}`).expect(200)
      ).body;
      expect(ownThread.tasks.map((t: any) => t.id)).toEqual([taskA.id]);
      const ownState = (
        await as(tokenA).get(`/threads/${threadA.id}/state`).expect(200)
      ).body;
      expect(ownState.content).not.toContain('sneaky');
      expect(ownState.content).not.toContain('overwritten');
    });

    it('does not find threads by a state block of another workspace', async () => {
      const crossWorkspace = (
        await as(tokenB)
          .get(`/threads/by-state-block/${threadA.stateContextBlockId}`)
          .expect(200)
      ).body;
      expect(crossWorkspace).toEqual([]);
      const own = (
        await as(tokenA)
          .get(`/threads/by-state-block/${threadA.stateContextBlockId}`)
          .expect(200)
      ).body;
      expect(own.map((t: any) => t.id)).toEqual([threadA.id]);
    });

    it('does not rename a thread of another workspace', async () => {
      await as(tokenB)
        .patch(`/threads/${threadA.id}`)
        .send({ title: `Renamed by B ${suffix}` })
        .expect(404);
      const ownThread = (
        await as(tokenA).get(`/threads/${threadA.id}`).expect(200)
      ).body;
      expect(ownThread.title).toBe(`Thread in A ${suffix}`);
      const stateBlock = (
        await as(tokenA)
          .get(`/context/blocks/${threadA.stateContextBlockId}`)
          .expect(200)
      ).body;
      expect(stateBlock.title).not.toContain('Renamed by B');
    });
  });

  /**
   * Every other public thread route names a thread, so each one is checked
   * against the caller's workspace first (docs/architecture/workspaces.md,
   * "Entry points").
   */
  describe('every other thread route', () => {
    const missingId = '00000000-0000-4000-8000-0000000000ff';

    it('leaves threads of another workspace out of the thread list', async () => {
      const listB = (await as(tokenB).get('/threads?limit=100').expect(200)).body;
      expect(listB.items.map((t: any) => t.id)).not.toContain(threadA.id);
      const listA = (await as(tokenA).get('/threads?limit=100').expect(200)).body;
      expect(listA.items.map((t: any) => t.id)).toContain(threadA.id);
    });

    it('answers not found on every per-thread route of another workspace', async () => {
      const b = as(tokenB);
      await b.get(`/threads/${threadA.id}/messages`).expect(404);
      await b.get(`/threads/${threadA.id}/token-usage`).expect(404);
      await b.get(`/threads/${threadA.id}/pull-requests`).expect(404);
      await b.get(`/threads/${threadA.id}/issues`).expect(404);
      await b.post(`/threads/${threadA.id}/read`).expect(404);
      await b.put(`/threads/${threadA.id}/pin`).expect(404);
      await b.delete(`/threads/${threadA.id}/pin`).expect(404);
      await b.delete(`/threads/${threadA.id}/timers/${missingId}`).expect(404);
      await b.delete(`/threads/${threadA.id}/watches/${missingId}`).expect(404);
      await b
        .delete(`/threads/${threadA.id}/task-subscriptions/${taskA.id}`)
        .expect(404);
      // The same routes still work in the thread's own workspace.
      const a = as(tokenA);
      await a.get(`/threads/${threadA.id}/messages`).expect(200);
      await a.get(`/threads/${threadA.id}/pull-requests`).expect(200);
      await a.delete(`/threads/${threadA.id}/timers/${missingId}`).expect(204);
    });

    it('does not add a participant to a thread of another workspace', async () => {
      const before = (await as(tokenA).get(`/threads/${threadA.id}`).expect(200))
        .body;
      const res = await as(tokenB)
        .post(`/threads/${threadA.id}/participants`)
        .send({ actorId })
        .expect(404);
      // The response carries nothing of the thread.
      expect(JSON.stringify(res.body)).not.toContain(`Task in A ${suffix}`);
      const after = (await as(tokenA).get(`/threads/${threadA.id}`).expect(200))
        .body;
      expect(after.participants.map((p: any) => p.id).sort()).toEqual(
        before.participants.map((p: any) => p.id).sort(),
      );
    });

    it('only adds members of the workspace as participants', async () => {
      // A new agent is only a member of the default workspace.
      const agentId = await ensureAgentActor(
        app,
        `iso-participant-${suffix}`,
        'Isolation participant',
      );
      await as(tokenB)
        .post('/threads')
        .send({ participantActorIds: [agentId] })
        .expect(404);
      const threadB = (
        await as(tokenB).post('/threads').send({ title: 'B participants' }).expect(201)
      ).body;
      await as(tokenB)
        .post(`/threads/${threadB.id}/participants`)
        .send({ actorId: agentId })
        .expect(404);
      await as(tokenB)
        .post(`/threads/${threadB.id}/participants`)
        .send({ actorId })
        .expect(201);
    });

    it('does not post a message to a thread of another workspace', async () => {
      // A thread with the placeholder title, so a first message would name it.
      const fresh = (await as(tokenA).post('/threads').send({}).expect(201)).body;
      await as(tokenB)
        .post(`/threads/${fresh.id}/messages`)
        .send({ content: 'Name this thread Hijacked' })
        .expect(404);
      const messages = (
        await as(tokenA).get(`/threads/${fresh.id}/messages`).expect(200)
      ).body;
      expect(messages.total).toBe(0);
      const after = (await as(tokenA).get(`/threads/${fresh.id}`).expect(200)).body;
      expect(after.title).toBe(fresh.title);
      const stateBlock = (
        await as(tokenA)
          .get(`/context/blocks/${fresh.stateContextBlockId}`)
          .expect(200)
      ).body;
      expect(stateBlock.title).toBe(`Thread State: ${fresh.title}`);
    });

    it("does not let a thread's agent watch a task of another workspace", async () => {
      const subscriptions = app.get(ThreadTaskSubscriptionsService);
      const threadB = (
        await as(tokenB).post('/threads').send({ title: 'B watcher' }).expect(201)
      ).body;
      const taskB = (
        await as(tokenB)
          .post('/tasks/tasks')
          .send({ name: 'B watched', description: 'd' })
          .expect(201)
      ).body;
      expect(
        await subscriptions.subscribe(WORKSPACE_B_ID, {
          threadId: threadB.id,
          taskId: taskA.id,
          forActorId: actorId,
          waitingFor: '',
        }),
      ).toBeNull();
      expect(
        await subscriptions.subscribe(WORKSPACE_B_ID, {
          threadId: threadB.id,
          taskId: taskB.id,
          forActorId: actorId,
          waitingFor: '',
        }),
      ).toMatchObject({ id: taskB.id });
    });
  });

  /**
   * Phase 3b: threads and every table that hangs off them carry their own
   * `workspace_id`, always the thread's.
   */
  describe('rows that hang off a thread', () => {
    const THREAD_CHILD_TABLES = [
      'thread_messages',
      'thread_agent_messages',
      'thread_turns',
      'thread_pins',
      'thread_read_states',
      'thread_task_subscriptions',
      'thread_timers',
      'thread_timer_firings',
      'thread_watches',
      'thread_watch_deliveries',
    ];

    /** The workspaces of a thread's own row and of every row hanging off it, per table. */
    async function workspacesOf(threadId: string): Promise<Record<string, string[]>> {
      const db = app.get(DataSource);
      const result: Record<string, string[]> = {};
      for (const table of ['threads', ...THREAD_CHILD_TABLES]) {
        const column = table === 'threads' ? 'id' : 'thread_id';
        const rows: Array<{ workspace_id: string }> = await db.query(
          `SELECT DISTINCT workspace_id FROM "${table}" WHERE "${column}" = $1`,
          [threadId],
        );
        result[table] = rows.map((row) => row.workspace_id);
      }
      return result;
    }

    it("puts every row a thread writes in the thread's workspace", async () => {
      const b = as(tokenB);
      const threadB = (
        await b.post('/threads').send({ title: `Stamped in B ${suffix}` }).expect(201)
      ).body;
      const taskB = (
        await b.post('/tasks/tasks').send({ name: 'B stamped', description: 'd' }).expect(201)
      ).body;
      // Hold the thread's turn for the whole test. Otherwise the agent turn
      // started by the message below can ingest the timer firing and watch
      // delivery (deleting them, and the finished one-shot timer) before the
      // rows are inspected.
      const turns = app.get(ThreadTurnsService);
      const turn = await turns.tryClaim(threadB.id);
      expect(turn).toMatchObject({ threadId: threadB.id, workspaceId: WORKSPACE_B_ID });
      await b.post(`/threads/${threadB.id}/messages`).send({ content: 'hello from B' }).expect(201);
      await b.put(`/threads/${threadB.id}/pin`).expect(204);
      await b.post(`/threads/${threadB.id}/read`).expect(204);

      const timers = app.get(ThreadTimersService);
      const subscriptions = app.get(ThreadTaskSubscriptionsService);
      const watches = app.get(ThreadWatchesService);
      // Already due, so a sweep queues a firing for it.
      const timer = await timers.create(WORKSPACE_B_ID, {
        threadId: threadB.id,
        kind: ThreadTimerKind.REMINDER,
        reason: 'B reminder',
        periodSeconds: null,
        maxIterations: 1,
        firstFireAt: new Date(Date.now() - 1000),
        forActorId: actorId,
      });
      expect(timer).not.toBeNull();
      expect(await timers.fireDue()).toContain(threadB.id);
      expect(
        await subscriptions.subscribe(WORKSPACE_B_ID, {
          threadId: threadB.id,
          taskId: taskB.id,
          forActorId: actorId,
          waitingFor: 'done',
        }),
      ).toMatchObject({ id: taskB.id, workspaceId: WORKSPACE_B_ID });
      const watch = await watches.watch(WORKSPACE_B_ID, {
        threadId: threadB.id,
        kind: ThreadWatchKind.PULL_REQUEST,
        targetId: '00000000-0000-4000-8000-0000000000aa',
        targetLabel: 'acme/api#1',
        targetUrl: null,
        conditions: [],
        once: true,
        waitingFor: null,
        forActorId: actorId,
        expiresAt: new Date(Date.now() + 60_000),
      });
      expect(watch).toMatchObject({ workspaceId: WORKSPACE_B_ID });
      await watches.notify([{ watch: watch!, message: 'B notification', final: false }]);
      await app.get(ThreadAgentLogService).append(threadB.id, [
        {
          role: ThreadAgentMessageRole.USER,
          message: { role: 'user', content: 'B log row' },
          source: 'user',
        },
      ]);
      let stamped: Record<string, string[]>;
      try {
        stamped = await workspacesOf(threadB.id);
      } finally {
        await turns.finish(turn!.id, ThreadTurnStatus.COMPLETED);
      }
      for (const table of ['threads', ...THREAD_CHILD_TABLES]) {
        expect({ table, workspaces: stamped[table] }).toEqual({
          table,
          workspaces: [WORKSPACE_B_ID],
        });
      }

      // A's thread is untouched by all of it.
      const ofA = await workspacesOf(threadA.id);
      for (const workspaces of Object.values(ofA)) {
        expect(workspaces.every((id) => id === DEFAULT_WORKSPACE_ID)).toBe(true);
      }
    });

    it("writes no timer, watch or subscription onto another workspace's thread", async () => {
      const taskB = (
        await as(tokenB)
          .post('/tasks/tasks')
          .send({ name: 'B not linked', description: 'd' })
          .expect(201)
      ).body;
      const before = await workspacesOf(threadA.id);

      expect(
        await app.get(ThreadTimersService).create(WORKSPACE_B_ID, {
          threadId: threadA.id,
          kind: ThreadTimerKind.REMINDER,
          reason: 'sneaky',
          periodSeconds: null,
          maxIterations: 1,
          firstFireAt: new Date(Date.now() + 60_000),
          forActorId: actorId,
        }),
      ).toBeNull();
      expect(
        await app.get(ThreadWatchesService).watch(WORKSPACE_B_ID, {
          threadId: threadA.id,
          kind: ThreadWatchKind.PULL_REQUEST,
          targetId: '00000000-0000-4000-8000-0000000000bb',
          targetLabel: 'acme/api#2',
          targetUrl: null,
          conditions: [],
          once: true,
          waitingFor: null,
          forActorId: actorId,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ).toBeNull();
      // Neither from B onto A's thread, nor from A onto A's thread with B's task.
      const subscriptions = app.get(ThreadTaskSubscriptionsService);
      expect(
        await subscriptions.subscribe(WORKSPACE_B_ID, {
          threadId: threadA.id,
          taskId: taskB.id,
          forActorId: actorId,
          waitingFor: '',
        }),
      ).toBeNull();
      expect(
        await subscriptions.subscribe(DEFAULT_WORKSPACE_ID, {
          threadId: threadA.id,
          taskId: taskB.id,
          forActorId: actorId,
          waitingFor: '',
        }),
      ).toBeNull();
      // B cannot list or cancel what A's thread waits for.
      expect(await app.get(ThreadTimersService).listActive(WORKSPACE_B_ID, threadA.id)).toEqual([]);
      expect(await subscriptions.listForThread(WORKSPACE_B_ID, threadA.id)).toEqual([]);
      expect(await app.get(ThreadWatchesService).listForThread(WORKSPACE_B_ID, threadA.id)).toEqual([]);

      expect(await workspacesOf(threadA.id)).toEqual(before);
    });

    it('fires timers of every workspace, each in its own workspace', async () => {
      const timers = app.get(ThreadTimersService);
      const threadB = (
        await as(tokenB).post('/threads').send({ title: `Timers in B ${suffix}` }).expect(201)
      ).body;
      const threadOwnA = (
        await as(tokenA).post('/threads').send({ title: `Timers in A ${suffix}` }).expect(201)
      ).body;
      const due = {
        kind: ThreadTimerKind.REMINDER,
        reason: 'due',
        periodSeconds: null,
        maxIterations: 1,
        firstFireAt: new Date(Date.now() - 1000),
        forActorId: actorId,
      };
      await timers.create(WORKSPACE_B_ID, { ...due, threadId: threadB.id });
      await timers.create(DEFAULT_WORKSPACE_ID, { ...due, threadId: threadOwnA.id });

      // One sweep (any backend) fires both.
      const fired = await timers.fireDue();
      expect(fired).toEqual(expect.arrayContaining([threadB.id, threadOwnA.id]));

      expect((await workspacesOf(threadB.id)).thread_timer_firings).toEqual([WORKSPACE_B_ID]);
      expect((await workspacesOf(threadOwnA.id)).thread_timer_firings).toEqual([
        DEFAULT_WORKSPACE_ID,
      ]);
    });

    it("only tells threads of the task's workspace that a task changed", async () => {
      const subscriptions = app.get(ThreadTaskSubscriptionsService);
      const threadOwnA = (
        await as(tokenA).post('/threads').send({ title: `Watcher in A ${suffix}` }).expect(201)
      ).body;
      const taskOwnA = (
        await as(tokenA).post('/tasks/tasks').send({ name: 'A watched', description: 'd' }).expect(201)
      ).body;
      await subscriptions.subscribe(DEFAULT_WORKSPACE_ID, {
        threadId: threadOwnA.id,
        taskId: taskOwnA.id,
        forActorId: actorId,
        waitingFor: '',
      });
      // The same task id, claimed by another workspace, triggers nothing.
      expect(
        await subscriptions.markTriggered({
          id: taskOwnA.id,
          workspaceId: WORKSPACE_B_ID,
          name: 'x',
          status: TaskStatus.DONE,
        }),
      ).toEqual([]);
      expect(
        await subscriptions.markTriggered({
          id: taskOwnA.id,
          workspaceId: DEFAULT_WORKSPACE_ID,
          name: 'A watched',
          status: TaskStatus.DONE,
        }),
      ).toEqual([threadOwnA.id]);
    });
  });

  describe('search, executions and agent runs', () => {
    it('leaves rows of another workspace out of global search', async () => {
      const query = encodeURIComponent(`Task in A ${suffix}`);
      // The index is updated in the background: wait until A finds its task.
      let foundByA = false;
      for (let attempt = 0; attempt < 20 && !foundByA; attempt++) {
        const hits = (await as(tokenA).get(`/search/query?query=${query}`).expect(200))
          .body;
        foundByA = hits.some((hit: any) => hit.id === taskA.id);
        if (!foundByA) await settle();
      }
      expect(foundByA).toBe(true);
      const hitsB = (await as(tokenB).get(`/search/query?query=${query}`).expect(200))
        .body;
      expect(hitsB.map((hit: any) => hit.id)).not.toContain(taskA.id);
      expect(hitsB.map((hit: any) => hit.id)).not.toContain(threadA.id);
    });

    it("filters by workspace before the limit, so A's matches never crowd out B's", async () => {
      const word = `crowd${suffix}`;
      for (let i = 0; i < 3; i++) {
        await as(tokenA).post('/tasks/tasks').send({ name: `A ${word} ${i}`, description: word }).expect(201);
      }
      const taskB = (
        await as(tokenB).post('/tasks/tasks').send({ name: `B ${word}`, description: word }).expect(201)
      ).body;
      const path = `/search/query?query=${encodeURIComponent(word)}&types=task&limit=1`;
      let hitsB: any[] = [];
      for (let attempt = 0; attempt < 20 && hitsB.length === 0; attempt++) {
        await settle();
        hitsB = (await as(tokenB).get(path).expect(200)).body;
      }
      expect(hitsB.map((hit: any) => hit.id)).toEqual([taskB.id]);
      const hitsA = (await as(tokenA).get(path).expect(200)).body;
      expect(hitsA).toHaveLength(1);
      expect(hitsA[0].id).not.toBe(taskB.id);
    });

    it('leaves agents out of global search for another workspace, even when the query matches', async () => {
      const canary = `agentcanary${suffix}`;
      const agent = await app.get(AgentsService).createAgent(DEFAULT_WORKSPACE_ID, {
        slug: `iso-search-agent-${suffix}`,
        name: `Agent ${canary}`,
        description: `Searchable ${canary}`,
        systemPrompt: `Prompt ${canary}`,
        statusTriggers: [],
        allowedTools: [],
      });
      const query = encodeURIComponent(canary);
      let foundByA = false;
      for (let attempt = 0; attempt < 20 && !foundByA; attempt++) {
        const hits = (await as(tokenA).get(`/search/query?query=${query}`).expect(200)).body;
        foundByA = hits.some((hit: any) => hit.type === 'agent' && hit.title?.includes(canary));
        if (!foundByA) await settle();
      }
      expect(foundByA).toBe(true);
      const hitsB = (await as(tokenB).get(`/search/query?query=${query}`).expect(200)).body;
      expect(JSON.stringify(hitsB)).not.toContain(canary);
      expect(hitsB.filter((hit: any) => hit.type === 'agent' || hit.type === 'tool')).toEqual([]);
    });

    it('leaves executions of another workspace out of the execution lists', async () => {
      for (const path of [
        '/executions/queue',
        '/executions/active',
        `/executions/history?taskId=${taskA.id}`,
      ]) {
        const body = (await as(tokenB).get(path).expect(200)).body;
        expect(body.items.map((item: any) => item.taskId)).not.toContain(taskA.id);
      }
    });

    it('answers not found for an agent run of another workspace', async () => {
      const runA = (
        await as(tokenA)
          .post('/agent-runs')
          .send({ parentTaskId: taskA.id })
          .expect(201)
      ).body;
      await as(tokenB).get(`/agent-runs/${runA.id}`).expect(404);
      await as(tokenB)
        .patch(`/agent-runs/${runA.id}`)
        .send({ startedAt: new Date().toISOString() })
        .expect(404);
      await as(tokenB)
        .post('/agent-runs')
        .send({ parentTaskId: taskA.id })
        .expect(404);
      const listB = (await as(tokenB).get('/agent-runs?limit=100').expect(200)).body;
      expect(listB.items.map((run: any) => run.id)).not.toContain(runA.id);
      await as(tokenA).get(`/agent-runs/${runA.id}`).expect(200);
    });
  });

  describe('agents and slugs', () => {
    const slug = `iso-same-slug-${suffix}`;
    let agentA: { actorId: string; slug: string };
    let agentB: { actorId: string; slug: string };

    const createAgent = (token: string, body: Record<string, unknown>) =>
      as(token)
        .post('/agents')
        .send({ systemPrompt: 'prompt', statusTriggers: [], allowedTools: [], ...body });

    beforeAll(async () => {
      agentA = (await createAgent(tokenA, { slug, name: `A agent ${suffix}` }).expect(201)).body;
      // Each workspace can have its own agent with the same slug.
      agentB = (await createAgent(tokenB, { slug, name: `B agent ${suffix}` }).expect(201)).body;
    });

    it('lets each workspace have its own agent with the same slug', async () => {
      expect(agentB.actorId).not.toBe(agentA.actorId);
      expect((await as(tokenA).get(`/agents/${slug}`).expect(200)).body.actorId).toBe(agentA.actorId);
      expect((await as(tokenB).get(`/agents/${slug}`).expect(200)).body.actorId).toBe(agentB.actorId);
    });

    it('refuses a slug taken in the same workspace or by a person', async () => {
      await createAgent(tokenB, { slug, name: 'Again' }).expect(409);
      await createAgent(tokenB, { slug: TEST_USER_SLUG, name: 'Person slug' }).expect(409);
      await as(tokenB).patch(`/agents/${agentB.actorId}`).send({ slug: TEST_USER_SLUG }).expect(409);
    });

    describe("people's slugs never collide with an agent's", () => {
      const password = 'password-123';
      const identity = () => app.get(IdentityProviderService);
      const newPerson = (personSlug: string) =>
        identity().createUser({
          email: `${personSlug}@example.test`,
          displayName: personSlug,
          slug: personSlug,
          password,
        });

      it('refuses a person the slug of an agent in any workspace', async () => {
        // The agent with `slug` in B is not a member of the default workspace.
        await expect(newPerson(slug)).rejects.toBeInstanceOf(UserSlugConflictError);

        const email = `iso-invited-${suffix}@example.test`;
        await identity().createManagedUser({ email, role: UserRole.STANDARD });
        await expect(
          identity().setupManagedUser({ email, displayName: 'Invited', slug, password }),
        ).rejects.toBeInstanceOf(UserSlugConflictError);
      });

      it("gives an invited person a slug other than an agent's", async () => {
        const user = await identity().createManagedUser({
          email: `${slug}@example.test`,
          role: UserRole.STANDARD,
        });
        expect(user.actor!.slug).not.toBe(slug);
      });

      it("refuses an agent a slug a person took through account setup", async () => {
        const email = `iso-setup-${suffix}@example.test`;
        const personSlug = `iso-setup-slug-${suffix}`;
        await identity().createManagedUser({ email, role: UserRole.STANDARD });
        await identity().setupManagedUser({ email, displayName: 'Setup', slug: personSlug, password });
        await createAgent(tokenB, { slug: personSlug, name: 'After person' }).expect(409);
      });

      it('lets only one of a concurrent person and agent take a slug', async () => {
        for (let i = 0; i < 5; i++) {
          const raced = `iso-race-${suffix}-${i}`;
          const [person, agent] = await Promise.allSettled([
            newPerson(raced),
            createAgent(tokenB, { slug: raced, name: `Race ${i}` }).then((res) => {
              if (res.status !== 201) throw new Error(`agent create: ${res.status}`);
              return res;
            }),
          ]);
          expect([person.status, agent.status].filter((s) => s === 'fulfilled')).toHaveLength(1);
          if (person.status === 'rejected') {
            expect(person.reason).toBeInstanceOf(UserSlugConflictError);
          }
        }
      });
    });

    describe('writes that wait on a concurrent rename or delete', () => {
      // A concurrent writer is a transaction holding the rows' locks. The
      // write under test starts, waits on those locks, and the writer then
      // renames or deletes the actor, hands its slug to someone else and
      // commits. The waiting write must work from the committed rows.
      const ds = () => app.get(DataSource);

      async function holdRows(lockSql: string[], id: string) {
        const writer = ds().createQueryRunner();
        await writer.connect();
        await writer.startTransaction();
        for (const sql of lockSql) await writer.query(sql, [id]);
        return writer;
      }
      const AGENT_ROWS = [
        `SELECT 1 FROM agents WHERE actor_id = $1 FOR UPDATE`,
        `SELECT 1 FROM actors WHERE id = $1 FOR UPDATE`,
      ];

      async function untilWaitingOnLock() {
        for (let i = 0; i < 200; i++) {
          const [{ n }] = await ds().query(
            `SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'`,
          );
          if (n > 0) return;
          await new Promise((r) => setTimeout(r, 25));
        }
        throw new Error('the write never waited on the locked rows');
      }

      const actorRow = async (id: string) =>
        (await ds().query(`SELECT slug, deleted_at FROM actors WHERE id = $1`, [id]))[0];

      it('does not bring back a slug that was renamed away and reused', async () => {
        const x = (await createAgent(tokenB, { slug: `iso-stale-x-${suffix}`, name: 'X' }).expect(201)).body;
        const y = (await createAgent(tokenB, { slug: `iso-stale-y-${suffix}`, name: 'Y' }).expect(201)).body;
        const writer = await holdRows(AGENT_ROWS, x.actorId);
        const patch = as(tokenB).patch(`/agents/${x.actorId}`).send({ name: 'X renamed' }).then((r) => r);
        await untilWaitingOnLock();
        await writer.query(`UPDATE actors SET slug = $2 WHERE id = $1`, [x.actorId, `${x.slug}-new`]);
        await writer.query(`UPDATE actors SET slug = $2 WHERE id = $1`, [y.actorId, x.slug]);
        await writer.commitTransaction();
        await writer.release();

        const res = await patch;
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ name: 'X renamed', slug: `${x.slug}-new` });
        expect((await actorRow(x.actorId)).slug).toBe(`${x.slug}-new`);
        expect((await actorRow(y.actorId)).slug).toBe(x.slug);
      });

      it("does not revive a deleted agent whose slug a person took", async () => {
        const x = (await createAgent(tokenB, { slug: `iso-stale-del-${suffix}`, name: 'X' }).expect(201)).body;
        const writer = await holdRows(AGENT_ROWS, x.actorId);
        const patch = as(tokenB).patch(`/agents/${x.actorId}`).send({ introduction: 'late' }).then((r) => r);
        await untilWaitingOnLock();
        await writer.query(`UPDATE agents SET deleted_at = now() WHERE actor_id = $1`, [x.actorId]);
        await writer.query(
          `UPDATE actors SET slug = slug || '~deleted-x', deleted_at = now() WHERE id = $1`,
          [x.actorId],
        );
        const person = await app
          .get(ActorService)
          .createUserActor(writer.manager, { slug: x.slug, displayName: 'Took it' });
        await writer.commitTransaction();
        await writer.release();

        expect((await patch).status).toBe(404);
        const after = await actorRow(x.actorId);
        expect(after.slug).toBe(`${x.slug}~deleted-x`);
        expect(after.deleted_at).not.toBeNull();
        expect((await actorRow(person.id)).slug).toBe(x.slug);
      });

      it('does not delete an agent under a slug it no longer has', async () => {
        const x = (await createAgent(tokenB, { slug: `iso-stale-rm-${suffix}`, name: 'X' }).expect(201)).body;
        const y = (await createAgent(tokenB, { slug: `iso-stale-rm-y-${suffix}`, name: 'Y' }).expect(201)).body;
        const writer = await holdRows(AGENT_ROWS, x.actorId);
        const removal = as(tokenB).delete(`/agents/${x.actorId}`).then((r) => r);
        await untilWaitingOnLock();
        await writer.query(`UPDATE actors SET slug = $2 WHERE id = $1`, [x.actorId, `${x.slug}-new`]);
        await writer.query(`UPDATE actors SET slug = $2 WHERE id = $1`, [y.actorId, x.slug]);
        await writer.commitTransaction();
        await writer.release();

        expect((await removal).status).toBeLessThan(300);
        const after = await actorRow(x.actorId);
        expect(after.slug.startsWith(`${x.slug}-new~deleted-`)).toBe(true);
        expect((await actorRow(y.actorId)).slug).toBe(x.slug);
      });

      it("does not let account setup undo a person's deactivation", async () => {
        const email = `iso-stale-setup-${suffix}@example.test`;
        const identity = app.get(IdentityProviderService);
        const invited = await identity.createManagedUser({ email, role: UserRole.STANDARD });
        const writer = await holdRows(
          [`SELECT 1 FROM users WHERE id = $1 FOR UPDATE`],
          invited.id,
        );
        await writer.query(`SELECT 1 FROM actors WHERE id = $1 FOR UPDATE`, [invited.actorId]);
        const setup = identity
          .setupManagedUser({ email, displayName: 'Late', slug: `iso-stale-p-${suffix}`, password: 'password-123' })
          .then(
            () => 'set up',
            (error: unknown) => error,
          );
        await untilWaitingOnLock();
        await writer.query(`UPDATE users SET "isActive" = false WHERE id = $1`, [invited.id]);
        await writer.query(
          `UPDATE actors SET slug = slug || '~deleted-x', deleted_at = now() WHERE id = $1`,
          [invited.actorId],
        );
        await writer.commitTransaction();
        await writer.release();

        expect(await setup).toBeInstanceOf(InvalidCredentialsError);
        const after = await actorRow(invited.actorId);
        expect(after.deleted_at).not.toBeNull();
        expect(after.slug.endsWith('~deleted-x')).toBe(true);
      });
    });

    it('makes an agent a member of its own workspace only', async () => {
      const members: Repository<WorkspaceMemberEntity> = app.get(
        getRepositoryToken(WorkspaceMemberEntity),
      );
      const workspacesOf = async (id: string) =>
        (await members.find({ where: { actorId: id } })).map((m) => m.workspaceId);
      expect(await workspacesOf(agentB.actorId)).toEqual([WORKSPACE_B_ID]);
      expect(await workspacesOf(agentA.actorId)).toEqual([DEFAULT_WORKSPACE_ID]);
    });

    it("never lists, changes or deletes another workspace's agent", async () => {
      const listB = (await as(tokenB).get('/agents?limit=100').expect(200)).body;
      expect(listB.items.map((a: any) => a.actorId)).toContain(agentB.actorId);
      expect(listB.items.map((a: any) => a.actorId)).not.toContain(agentA.actorId);
      const listA = (await as(tokenA).get('/agents?limit=100').expect(200)).body;
      expect(listA.items.map((a: any) => a.actorId)).not.toContain(agentB.actorId);

      await as(tokenB).patch(`/agents/${agentA.actorId}`).send({ name: 'Hijacked' }).expect(404);
      await as(tokenB).delete(`/agents/${agentA.actorId}`).expect(404);
      expect((await as(tokenA).get(`/agents/${slug}`).expect(200)).body.name).toBe(`A agent ${suffix}`);

      const exported = (await as(tokenB).get('/agent-definitions/export').expect(200)).body;
      expect(exported.agents.map((a: any) => a.name)).not.toContain(`A agent ${suffix}`);
    });

    it("resolves a mention by slug to the caller's workspace agent", async () => {
      const taskB = (
        await as(tokenB)
          .post('/tasks/tasks')
          .send({ name: `Mention ${suffix}`, description: 'mention', assigneeActorId: slug })
          .expect(201)
      ).body;
      expect(taskB.assigneeActor.id).toBe(agentB.actorId);
      const taskInA = (
        await as(tokenA)
          .post('/tasks/tasks')
          .send({ name: `Mention ${suffix}`, description: 'mention', assigneeActorId: slug })
          .expect(201)
      ).body;
      expect(taskInA.assigneeActor.id).toBe(agentA.actorId);
      // A's agent by id is not a member of B, so it cannot be given B's work.
      await as(tokenB)
        .post('/tasks/tasks')
        .send({ name: `Foreign ${suffix}`, description: 'foreign', assigneeActorId: agentA.actorId })
        .expect(404);
    });

    it("issues an execution token for the workspace's own agent, which works there only", async () => {
      const res = await as(tokenB)
        .post(`/agents/${slug}/execution-token`)
        .send({ scopes: [TasksScopes.READ.id] })
        .expect(201);
      const claims = JSON.parse(Buffer.from(res.body.token.split('.')[1], 'base64url').toString());
      expect(claims.workspace_id).toBe(WORKSPACE_B_ID);
      expect(claims.sub).toBe(agentB.actorId);

      const taskB = (
        await as(tokenB).post('/tasks/tasks').send({ name: `Run ${suffix}`, description: 'run' }).expect(201)
      ).body;
      await as(res.body.token).get(`/tasks/tasks/${taskB.id}`).expect(200);
      await as(res.body.token).get(`/tasks/tasks/${taskA.id}`).expect(404);
    });
  });

  describe('GitHub data reached through a thread', () => {
    // A private pull request and issue already in the cache, as workspace A
    // would have them. Their titles are the canary.
    const owner = `acme-${suffix}`;
    const canary = `Private A title ${suffix}`;
    const prUrl = `https://github.com/${owner}/private/pull/7`;
    const issueUrl = `https://github.com/${owner}/private/issues/8`;
    // B has no connection, so reading B's copy asks GitHub without a token.
    // A local fake answers 404, so the test never waits on github.com.
    const github = new FakeGithub();

    afterAll(async () => {
      await github.stop();
      delete process.env.GITHUB_API_URL;
    });

    beforeAll(async () => {
      await github.start();
      process.env.GITHUB_API_URL = github.url;
      const now = new Date();
      await app.get<Repository<PullRequestEntity>>(getRepositoryToken(PullRequestEntity)).insert({
        workspaceId: DEFAULT_WORKSPACE_ID,
        key: `${owner}/private#7`,
        owner,
        repo: 'private',
        number: 7,
        title: canary,
        lastFetchedAt: now,
      });
      await app.get<Repository<IssueEntity>>(getRepositoryToken(IssueEntity)).insert({
        workspaceId: DEFAULT_WORKSPACE_ID,
        key: `${owner}/private#8`,
        owner,
        repo: 'private',
        number: 8,
        title: canary,
        lastFetchedAt: now,
      });
    });

    /** A task in the workspace linking both, and a thread around it. */
    async function threadLinking(token: string): Promise<{ threadId: string; taskId: string }> {
      const task = (
        await as(token)
          .post('/tasks/tasks')
          .send({ name: `Links ${suffix}`, description: 'd' })
          .expect(201)
      ).body;
      for (const link of [prUrl, issueUrl]) {
        await as(token)
          .post(`/tasks/tasks/${task.id}/artefacts`)
          .send({ name: 'link', link })
          .expect(201);
      }
      const thread = (
        await as(token).post('/threads').send({ title: 'links', taskIds: [task.id] }).expect(201)
      ).body;
      return { threadId: thread.id, taskId: task.id };
    }

    async function linked(token: string, threadId: string) {
      const prs = (await as(token).get(`/threads/${threadId}/pull-requests`).expect(200)).body;
      const issues = (await as(token).get(`/threads/${threadId}/issues`).expect(200)).body;
      return JSON.stringify({ prs, issues });
    }

    it("shows the cached rows to the default workspace (control)", async () => {
      const { threadId } = await threadLinking(tokenA);
      // Links are recorded in the background.
      let body = '';
      for (let attempt = 0; attempt < 20 && body.split(canary).length < 3; attempt++) {
        await settle();
        body = await linked(tokenA, threadId);
      }
      expect(body.split(canary).length).toBe(3);
    });

    it("does not show them through a thread of another workspace linking the same URLs", async () => {
      const { threadId, taskId } = await threadLinking(tokenB);
      await settle();
      expect(await linked(tokenB, threadId)).not.toContain(canary);
      // The links are recorded against B's own copy of each pull request and
      // issue, never A's, so B only ever has them read with B's connections.
      const rows: Array<{ ref_ws: string; row_ws: string }> = await app
        .get(DataSource)
        .query(
          `SELECT r.workspace_id AS ref_ws, p.workspace_id AS row_ws
             FROM pull_request_references r JOIN pull_requests p ON p.id = r.pull_request_id
            WHERE r.task_id = $1
           UNION ALL
           SELECT r.workspace_id, i.workspace_id
             FROM issue_references r JOIN issues i ON i.id = r.issue_id
            WHERE r.task_id = $1`,
          [taskId],
        );
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.ref_ws === WORKSPACE_B_ID && r.row_ws === WORKSPACE_B_ID)).toBe(true);
    });

    it("does not let a thread's agent read or watch them from another workspace", async () => {
      const threadB = (
        await as(tokenB).post('/threads').send({ title: 'B agent' }).expect(201)
      ).body;
      const tools = app.get(ThreadAgentToolsFactory).build({
        threadId: threadB.id,
        workspaceId: WORKSPACE_B_ID,
        agentActorId: actorId,
        forActorId: actorId,
      });
      const options = { toolCallId: 'call', messages: [] } as never;
      // B reads its own copy, which B's connections cannot see: never A's title.
      const read = await tools[GET_PULL_REQUEST_TOOL].execute!({ pullRequest: prUrl }, options);
      expect(JSON.stringify(read)).not.toContain(canary);
      await tools[WATCH_PULL_REQUEST_TOOL].execute!(
        { pullRequest: prUrl, for: ['merged'], waitingFor: 'x' },
        options,
      ).catch(() => undefined);
      // Whatever B watches is B's copy, in B.
      const watched: Array<{ workspace_id: string }> = await app.get(DataSource).query(
        `SELECT p.workspace_id FROM thread_watches w JOIN pull_requests p ON p.id = w.target_id
          WHERE w.thread_id = $1`,
        [threadB.id],
      );
      expect(watched.every((w) => w.workspace_id === WORKSPACE_B_ID)).toBe(true);
    });
  });

  describe('task blueprints and schedules', () => {
    let blueprintA: any;

    beforeAll(async () => {
      blueprintA = (
        await as(tokenA)
          .post('/task-blueprints')
          .send({
            name: `Blueprint in A ${suffix}`,
            description: 'Only workspace A can see this',
            tagNames: [tagName],
          })
          .expect(201)
      ).body;
    });

    it('answers not found for a blueprint in another workspace', async () => {
      await as(tokenB).get(`/task-blueprints/${blueprintA.id}`).expect(404);
      await as(tokenB)
        .patch(`/task-blueprints/${blueprintA.id}`)
        .send({ tagNames: [`b-tag-${suffix}`] })
        .expect(404);
      await as(tokenB)
        .post(`/task-blueprints/${blueprintA.id}/create-task`)
        .expect(404);
      await as(tokenB)
        .post('/scheduled-tasks')
        .send({ taskBlueprintId: blueprintA.id, cronExpression: '0 0 1 1 *' })
        .expect(404);
      await as(tokenB).delete(`/task-blueprints/${blueprintA.id}`).expect(404);

      const listB = (
        await as(tokenB).get('/task-blueprints?limit=100').expect(200)
      ).body;
      expect(listB.items.map((b: any) => b.id)).not.toContain(blueprintA.id);
      // A's blueprint keeps its tags.
      const stillA = (
        await as(tokenA).get(`/task-blueprints/${blueprintA.id}`).expect(200)
      ).body;
      expect(stillA.tags.map((t: any) => t.name)).toEqual([tagName]);
    });

    it('answers not found for a schedule in another workspace', async () => {
      const scheduleA = (
        await as(tokenA)
          .post('/scheduled-tasks')
          .send({
            taskBlueprintId: blueprintA.id,
            cronExpression: '0 0 1 1 *',
            enabled: false,
          })
          .expect(201)
      ).body;
      await as(tokenB).get(`/scheduled-tasks/${scheduleA.id}`).expect(404);
      await as(tokenB)
        .patch(`/scheduled-tasks/${scheduleA.id}`)
        .send({ enabled: true })
        .expect(404);
      await as(tokenB).delete(`/scheduled-tasks/${scheduleA.id}`).expect(404);
      const listB = (
        await as(tokenB).get('/scheduled-tasks?limit=100').expect(200)
      ).body;
      expect(listB.items.map((s: any) => s.id)).not.toContain(scheduleA.id);
    });

    it('creates blueprint tags and projects in the caller workspace', async () => {
      const freshSlug = `bp-project-${suffix}`;
      const blueprintB = (
        await as(tokenB)
          .post('/task-blueprints')
          .send({
            name: `Blueprint in B ${suffix}`,
            description: 'B only',
            tagNames: [tagName, `project:${freshSlug}`],
          })
          .expect(201)
      ).body;

      const tagsA = (await as(tokenA).get('/meta/tags').expect(200)).body;
      expect(tagsA.map((t: any) => t.name)).not.toContain(
        `project:${freshSlug}`,
      );
      await as(tokenA).get(`/meta/projects/by-slug/${freshSlug}`).expect(404);
      await as(tokenB).get(`/meta/projects/by-slug/${freshSlug}`).expect(200);

      const tagsB = (await as(tokenB).get('/meta/tags').expect(200)).body;
      const tagB = tagsB.find((t: any) => t.name === tagName);
      expect(blueprintB.tags.map((t: any) => t.id)).toContain(tagB.id);
      expect(blueprintA.tags.map((t: any) => t.id)).not.toContain(tagB.id);

      const listA = (
        await as(tokenA).get('/task-blueprints?limit=100').expect(200)
      ).body;
      expect(listA.items.map((b: any) => b.id)).not.toContain(blueprintB.id);

      // A task made from it lands in B with B's tag.
      const taskB = (
        await as(tokenB)
          .post(`/task-blueprints/${blueprintB.id}/create-task`)
          .expect(201)
      ).body;
      await as(tokenA).get(`/tasks/tasks/${taskB.id}`).expect(404);
      expect(taskB.tags.map((t: any) => t.id)).toContain(tagB.id);
    });

    it('does not create a task depending on a task of another workspace', async () => {
      const blueprintB = (
        await as(tokenB)
          .post('/task-blueprints')
          .send({
            name: `Blueprint with A dependency ${suffix}`,
            description: 'Depends on A',
            dependsOnIds: [taskA.id],
          })
          .expect(201)
      ).body;
      const res = await as(tokenB).post(
        `/task-blueprints/${blueprintB.id}/create-task`,
      );
      expect(res.status).toBeGreaterThanOrEqual(400);
      const tasksB = (
        await as(tokenB).get('/tasks/tasks?limit=100').expect(200)
      ).body;
      expect(tasksB.items.map((t: any) => t.name)).not.toContain(
        `Blueprint with A dependency ${suffix}`,
      );
    });
  });

  describe('over MCP', () => {
    it('answers not found for a thread in another workspace', async () => {
      const listed = await callTool(
        TASKS_MCP_PATH,
        tokenB,
        'list_tasks_by_thread',
        { threadId: threadA.id },
      );
      expect(listed.isError).toBe(true);
      const detachedTask = await callTool(
        TASKS_MCP_PATH,
        tokenB,
        'detach_task_from_thread',
        { threadId: threadA.id, taskId: taskA.id },
      );
      expect(detachedTask.isError).toBe(true);
      const memory = await callTool(
        CONTEXT_MCP_PATH,
        tokenB,
        'get_thread_state_memory',
        { threadId: threadA.id },
      );
      expect(memory.isError).toBe(true);
      const detachedBlock = await callTool(
        CONTEXT_MCP_PATH,
        tokenB,
        'detach_block_from_thread',
        { threadId: threadA.id, blockId: blockA.id },
      );
      expect(detachedBlock.isError).toBe(true);

      // Workspace A still sees the thread with its task and block.
      const ownList = await callTool(
        TASKS_MCP_PATH,
        tokenA,
        'list_tasks_by_thread',
        { threadId: threadA.id },
      );
      expect(ownList.isError).toBeFalsy();
      expect(ownList.content[0].text).toContain(taskA.id);
      const ownThread = (
        await as(tokenA).get(`/threads/${threadA.id}`).expect(200)
      ).body;
      expect(ownThread.referencedContextBlocks.map((b: any) => b.id)).toContain(
        blockA.id,
      );
    });

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
    it('only lets a socket follow threads of its own workspace', async () => {
      const socketA = await connect('/threads', tokenA);
      const socketB = await connect('/threads', tokenB);
      try {
        // B cannot follow a thread of another workspace.
        const ack = await socketB
          .timeout(5000)
          .emitWithAck('threads.subscribe', { threadId: threadA.id });
        expect(ack.ok).toBe(false);
        const ackA = await socketA
          .timeout(5000)
          .emitWithAck('threads.subscribe', { threadId: threadA.id });
        expect(ackA.ok).toBe(true);

        // The thread list room is per workspace.
        await socketA.timeout(5000).emitWithAck('threads.subscribe', {});
        await socketB.timeout(5000).emitWithAck('threads.subscribe', {});
        const titlesA = collect(
          socketA,
          ThreadWireEvents.THREAD_TITLE_UPDATED,
          (e) => e.payload.threadId,
        );
        const titlesB = collect(
          socketB,
          ThreadWireEvents.THREAD_TITLE_UPDATED,
          (e) => e.payload.threadId,
        );
        const updatesA = collect(
          socketA,
          ThreadWireEvents.THREAD_UPDATED,
          (e) => e.payload.id,
        );
        const updatesB = collect(
          socketB,
          ThreadWireEvents.THREAD_UPDATED,
          (e) => e.payload.id,
        );
        const messagesA = collect(
          socketA,
          ThreadWireEvents.MESSAGE_CREATED,
          (e) => e.payload.threadId,
        );
        const messagesB = collect(
          socketB,
          ThreadWireEvents.MESSAGE_CREATED,
          (e) => e.payload.threadId,
        );
        const activityA = collect(
          socketA,
          ThreadWireEvents.THREAD_ACTIVITY,
          (e) => e.payload.threadId,
        );
        const activityB = collect(
          socketB,
          ThreadWireEvents.THREAD_ACTIVITY,
          (e) => e.payload.threadId,
        );

        await as(tokenA)
          .patch(`/threads/${threadA.id}`)
          .send({ title: `Thread in A ${suffix} (renamed)` })
          .expect(200);
        const blockA2 = (
          await as(tokenA)
            .post('/context/blocks')
            .send({ title: `Second block in A ${suffix}`, content: 'x' })
            .expect(201)
        ).body;
        await as(tokenA)
          .post(`/threads/${threadA.id}/context-blocks`)
          .send({ contextBlockId: blockA2.id })
          .expect(201);
        await as(tokenA)
          .post(`/threads/${threadA.id}/messages`)
          .send({ content: `Realtime message in A ${suffix}` })
          .expect(201);
        await settle();

        expect(titlesA).toContain(threadA.id);
        expect(titlesB).not.toContain(threadA.id);
        expect(updatesA).toContain(threadA.id);
        expect(updatesB).not.toContain(threadA.id);
        expect(messagesA).toContain(threadA.id);
        expect(messagesB).not.toContain(threadA.id);
        expect(activityA).toContain(threadA.id);
        expect(activityB).not.toContain(threadA.id);
      } finally {
        socketA.disconnect();
        socketB.disconnect();
      }
    });
  });
});
