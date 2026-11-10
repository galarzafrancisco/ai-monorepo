import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomBytes, randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { ErrorCodes } from '@taico/errors';
import { AgentsService } from '../src/agents/agents.service';
import { AccessTokenClaims } from '../src/auth/core/types/access-token-claims.type';
import { TokenSignerService } from '../src/auth/crypto/token-signer.service';
import { getConfig } from '../src/config/env.config';
import { ActorType } from '../src/identity-provider/enums';
import { AppModule } from '../src/app.module';
import { RegisteredClientEntity } from '../src/authorization-server/entities/registered-client.entity';
import { TokenEndpointAuthMethod } from '../src/authorization-server/enums/token-endpoint-auth-method.enum';
import { ActiveTaskExecutionService } from '../src/executions/active/active-task-execution.service';
import { ActiveTaskExecutionEntity } from '../src/executions/active/active-task-execution.entity';
import { AgentConcurrencyLimitReachedError } from '../src/executions/errors/executions.errors';
import { TaskExecutionQueueEntity } from '../src/executions/queue/task-execution-queue.entity';
import { TaskExecutionQueuePopulatorService } from '../src/executions/readiness/task-execution-queue-populator.service';
import { StaleActiveTaskExecutionDetectorService } from '../src/executions/staleness/stale-active-task-execution-detector.service';
import { StaleActiveTaskExecutionPrunerService } from '../src/executions/staleness/stale-active-task-execution-pruner.service';
import { WorkersScopes } from '../src/executions/workers.scopes';
import { AppValidationPipe } from '../src/http/app-validation.pipe';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { TaskStatus } from '../src/tasks/enums/task-status.enum';
import { TasksScopes } from '../src/tasks/tasks.scopes';
import { WorkersService } from '../src/workers/workers.service';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import { ensureTestUser, getAuthCookies, TEST_USER_SLUG } from './helpers/auth.helper';

/**
 * Regressions for the scheduling bugs found running real tasks through a
 * worker on live: stale pruning re-running finished tasks, concurrency limits
 * not enforced, slow handover after a worker stops, and waiting tasks
 * starting late.
 */
describe('Execution scheduling (e2e)', () => {
  let app: INestApplication<App>;
  let cookies: string;
  let db: DataSource;
  let actorId: string;
  const WORKER = `sched-worker-${randomUUID().slice(0, 8)}`;
  /** A worker that never sends worker heartbeats (an older worker). */
  const OLD_WORKER = `sched-old-worker-${randomUUID().slice(0, 8)}`;
  const ws = DEFAULT_WORKSPACE_ID;

  const claims = () => app.get(ActiveTaskExecutionService);
  const queue = () => db.getRepository(TaskExecutionQueueEntity);
  const executions = () => db.getRepository(ActiveTaskExecutionEntity);

  async function agent(concurrencyLimit?: number): Promise<string> {
    const created = await app.get(AgentsService).createAgent(ws, {
      slug: `sched-${randomUUID().slice(0, 8)}`,
      name: 'Scheduling agent',
      systemPrompt: 'test',
      statusTriggers: [TaskStatus.NOT_STARTED],
      allowedTools: [],
      ...(concurrencyLimit ? { concurrencyLimit } : {}),
    });
    return created.actorId;
  }

  async function task(assigneeActorId: string): Promise<string> {
    const res = await request(app.getHttpServer()).post('/api/v1/tasks/tasks').set('Cookie', cookies)
      .send({ name: `Sched ${randomUUID().slice(0, 6)}`, description: 'x', assigneeActorId }).expect(201);
    return res.body.id;
  }

  async function queuedFor(agentActorId: string): Promise<number> {
    const [{ count }] = await db.query(
      `SELECT count(*)::int AS count FROM task_execution_queue q JOIN tasks t ON t.id = q.task_id
        WHERE t.assignee_actor_id = $1`,
      [agentActorId],
    );
    return count;
  }

  async function eventually<T>(check: () => Promise<T>, ok: (v: T) => boolean, ms = 3000): Promise<T> {
    const until = Date.now() + ms;
    let value = await check();
    while (!ok(value) && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 100));
      value = await check();
    }
    return value;
  }

  /** A worker access token, as the worker sends on its HTTP calls. */
  async function workerToken(clientId: string): Promise<string> {
    const config = getConfig();
    const now = Math.floor(Date.now() / 1000);
    const claims: AccessTokenClaims = {
      iss: config.issuerUrl,
      sub: actorId,
      workspace_id: ws,
      actor_id: actorId,
      actor_slug: TEST_USER_SLUG,
      actor_type: ActorType.HUMAN,
      aud: config.issuerUrl,
      exp: now + 1800,
      iat: now,
      jti: randomBytes(16).toString('hex'),
      client_id: clientId,
      scope: [TasksScopes.READ.id, WorkersScopes.CONNECT.id],
      resource: config.issuerUrl,
      version: '0.0.0',
    };
    return app.get(TokenSignerService).signToken(claims);
  }

  const claimOverHttp = async (taskId: string) =>
    request(app.getHttpServer())
      .post(`/api/v1/executions/queue/${taskId}/claim`)
      .set('Authorization', `Bearer ${await workerToken(WORKER)}`);

  const setStatus = (taskId: string, status: TaskStatus) =>
    db.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, taskId]);

  /** Backdates an execution past the 10-minute rule, so the pruner takes it. */
  const makeStale = (executionId: string) =>
    executions().update({ id: executionId }, {
      claimedAt: new Date(Date.now() - 11 * 60_000), lastHeartbeatAt: new Date(Date.now() - 11 * 60_000),
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    db = app.get(DataSource);
    actorId = await ensureTestUser(app);
    cookies = await getAuthCookies(app.getHttpServer());
    for (const clientId of [WORKER, OLD_WORKER]) {
      await db.getRepository(RegisteredClientEntity).save({
        clientId,
        clientName: clientId,
        redirectUris: ['http://127.0.0.1/callback'],
        grantTypes: [],
        scopes: [WorkersScopes.CONNECT.id],
        tokenEndpointAuthMethod: TokenEndpointAuthMethod.NONE,
      });
    }
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  describe('stale executions', () => {
    it('leave a task the agent finished as it is, and roll back one it left unfinished', async () => {
      const a = await agent();
      const finished = await task(a);
      const unfinished = await task(a);
      await eventually(() => queuedFor(a), (n) => n === 2);
      const e1 = await claims().claimTask(ws, { taskId: finished, workerClientId: WORKER });
      const e2 = await claims().claimTask(ws, { taskId: unfinished, workerClientId: WORKER });
      await setStatus(finished, TaskStatus.DONE);
      await setStatus(unfinished, TaskStatus.IN_PROGRESS);

      await makeStale(e1.id);
      await makeStale(e2.id);
      const pruner = app.get(StaleActiveTaskExecutionPrunerService);
      expect(await pruner.pruneExecutionById(e1.id)).toBe(true);
      expect(await pruner.pruneExecutionById(e2.id)).toBe(true);

      const [{ status: finishedNow }] = await db.query('SELECT status FROM tasks WHERE id = $1', [finished]);
      const [{ status: unfinishedNow }] = await db.query('SELECT status FROM tasks WHERE id = $1', [unfinished]);
      expect(finishedNow).toBe(TaskStatus.DONE);
      expect(unfinishedNow).toBe(TaskStatus.NOT_STARTED);
      const history = await db.query('SELECT status FROM task_execution_history WHERE id = ANY($1)', [[e1.id, e2.id]]);
      expect(history.map((h: { status: string }) => h.status)).toEqual(['STALE', 'STALE']);
    });

    it("count a stopped worker's executions as stale 2 minutes after the claim, even if it died right after claiming", async () => {
      const a = await agent();
      const t = await task(a);
      await eventually(() => queuedFor(a), (n) => n === 1);
      const execution = await claims().claimTask(ws, { taskId: t, workerClientId: WORKER });
      const now = Date.now();
      // The worker heartbeated 3s before claiming, 3 minutes ago, and was
      // never heard from again: no heartbeat after the claim.
      await executions().update({ id: execution.id }, { claimedAt: new Date(now - 3 * 60_000), lastHeartbeatAt: null });
      const workers = app.get(WorkersService);
      await workers.recordWorkerSeen(ws, { oauthClientId: WORKER, seenAt: new Date(now - 3 * 60_000 - 3000), heartbeat: true });
      const detector = app.get(StaleActiveTaskExecutionDetectorService);
      expect((await detector.findStaleExecutions()).map((e) => e.id)).toContain(execution.id);

      // Not yet 2 minutes since the claim: still running.
      await executions().update({ id: execution.id }, { claimedAt: new Date(now - 60_000) });
      expect((await detector.findStaleExecutions()).map((e) => e.id)).not.toContain(execution.id);
      await makeStale(execution.id);
      await app.get(StaleActiveTaskExecutionPrunerService).pruneExecutionById(execution.id);
    });

    it("keep only the 10-minute rule for a worker that never sends worker heartbeats", async () => {
      const a = await agent();
      const t = await task(a);
      await eventually(() => queuedFor(a), (n) => n === 1);
      const execution = await claims().claimTask(ws, { taskId: t, workerClientId: OLD_WORKER });
      const now = Date.now();
      await executions().update({ id: execution.id }, { claimedAt: new Date(now - 5 * 60_000), lastHeartbeatAt: new Date(now - 3 * 60_000) });
      await app.get(WorkersService).recordWorkerSeen(ws, { oauthClientId: OLD_WORKER, seenAt: new Date(now - 6 * 60_000) });
      const detector = app.get(StaleActiveTaskExecutionDetectorService);
      expect((await detector.findStaleExecutions()).map((e) => e.id)).not.toContain(execution.id);
      await makeStale(execution.id);
      expect((await detector.findStaleExecutions()).map((e) => e.id)).toContain(execution.id);
      await app.get(StaleActiveTaskExecutionPrunerService).pruneExecutionById(execution.id);
    });

    it('are not pruned if they recovered after the scan found them', async () => {
      const a = await agent();
      const t = await task(a);
      await eventually(() => queuedFor(a), (n) => n === 1);
      const execution = await claims().claimTask(ws, { taskId: t, workerClientId: WORKER });
      await makeStale(execution.id);
      const found = await app.get(StaleActiveTaskExecutionDetectorService).findStaleExecutions();
      expect(found.map((e) => e.id)).toContain(execution.id);

      // The agent heartbeats between the scan and the prune.
      await executions().update({ id: execution.id }, { lastHeartbeatAt: new Date() });
      const pruner = app.get(StaleActiveTaskExecutionPrunerService);
      expect(await pruner.pruneExecutionById(execution.id)).toBe(false);
      expect(await executions().countBy({ id: execution.id })).toBe(1);

      await makeStale(execution.id);
      expect(await pruner.pruneExecutionById(execution.id)).toBe(true);
    });
  });

  describe('concurrency limits', () => {
    it('queue no more of an agent’s tasks than its limit', async () => {
      const a = await agent(1);
      await task(a);
      await task(a);
      await task(a);
      await app.get(TaskExecutionQueuePopulatorService).populateAllTasks();
      expect(await queuedFor(a)).toBe(1);
    });

    it('hold when several of an agent’s tasks are reconciled at once', async () => {
      const a = await agent(1);
      const ids = [await task(a), await task(a), await task(a), await task(a)];
      const populator = app.get(TaskExecutionQueuePopulatorService);
      for (let round = 0; round < 5; round++) {
        await db.query('DELETE FROM task_execution_queue WHERE task_id = ANY($1)', [ids]);
        await Promise.all(ids.map((id) => populator.populateTask(id)));
        expect(await queuedFor(a)).toBe(1);
      }
    });

    it('are enforced when claiming, even when the queue holds more', async () => {
      const a = await agent(1);
      const first = await task(a);
      const second = await task(a);
      // As if two workers raced: both tasks in the queue at once.
      await queue().upsert([{ workspaceId: ws, taskId: first }, { workspaceId: ws, taskId: second }], ['taskId']);
      await claims().claimTask(ws, { taskId: first, workerClientId: WORKER });
      await expect(claims().claimTask(ws, { taskId: second, workerClientId: WORKER }))
        .rejects.toBeInstanceOf(AgentConcurrencyLimitReachedError);
      // Nothing started for it; it waits for the slot (see the last test).
      expect(await executions().countBy({ taskId: second })).toBe(0);
    });

    it('answer a claim over the limit with 409 AGENT_CONCURRENCY_LIMIT_REACHED', async () => {
      const a = await agent(1);
      const first = await task(a);
      const second = await task(a);
      await queue().upsert([{ workspaceId: ws, taskId: first }, { workspaceId: ws, taskId: second }], ['taskId']);
      await claimOverHttp(first).expect(201);

      const res = await claimOverHttp(second).expect(409);
      expect(res.body).toMatchObject({
        status: 409,
        code: ErrorCodes.AGENT_CONCURRENCY_LIMIT_REACHED,
        title: 'Agent concurrency limit reached',
        context: { agentActorId: a, limit: 1 },
      });
    });
  });

  describe('claim errors over HTTP', () => {
    it('answer a second claim of the same task with 409 TASK_EXECUTION_ALREADY_CLAIMED', async () => {
      const a = await agent();
      const t = await task(a);
      await queue().upsert([{ workspaceId: ws, taskId: t }], ['taskId']);
      await claimOverHttp(t).expect(201);

      const res = await claimOverHttp(t).expect(409);
      expect(res.body).toMatchObject({ status: 409, code: ErrorCodes.TASK_EXECUTION_ALREADY_CLAIMED });
    });

    it('answer a claim of a task that is not queued with 404 TASK_EXECUTION_QUEUE_ENTRY_NOT_FOUND', async () => {
      const a = await agent();
      const t = await task(a);
      // Let the populator queue it first, so it can't re-add it after the delete.
      await eventually(() => queue().countBy({ taskId: t }), (n) => n === 1);
      await db.query('DELETE FROM task_execution_queue WHERE task_id = $1', [t]);

      const res = await claimOverHttp(t).expect(404);
      expect(res.body).toMatchObject({ status: 404, code: ErrorCodes.TASK_EXECUTION_QUEUE_ENTRY_NOT_FOUND });
    });

    it('answer a claim of an unknown task with 404 TASK_NOT_FOUND', async () => {
      const res = await claimOverHttp(randomUUID()).expect(404);
      expect(res.body).toMatchObject({ status: 404, code: ErrorCodes.TASK_NOT_FOUND });
    });
  });

  it('queues the next waiting task as soon as a slot frees, not at the next sweep', async () => {
    const a = await agent(1);
    const first = await task(a);
    await eventually(() => queuedFor(a), (n) => n === 1);
    const execution = await claims().claimTask(ws, { taskId: first, workerClientId: WORKER });
    const second = await task(a);
    await new Promise((r) => setTimeout(r, 500));
    expect(await queue().countBy({ taskId: second })).toBe(0);

    await setStatus(first, TaskStatus.DONE);
    await makeStale(execution.id);
    await app.get(StaleActiveTaskExecutionPrunerService).pruneExecutionById(execution.id);
    expect(await eventually(() => queue().countBy({ taskId: second }), (n) => n === 1)).toBe(1);
  });
});
