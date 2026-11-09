import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AgentsService } from '../src/agents/agents.service';
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
import { WorkersService } from '../src/workers/workers.service';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

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
  const WORKER = `sched-worker-${randomUUID().slice(0, 8)}`;
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

  const setStatus = (taskId: string, status: TaskStatus) =>
    db.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, taskId]);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new AppValidationPipe());
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    db = app.get(DataSource);
    await ensureTestUser(app);
    cookies = await getAuthCookies(app.getHttpServer());
    await db.getRepository(RegisteredClientEntity).save({
      clientId: WORKER,
      clientName: WORKER,
      redirectUris: ['http://127.0.0.1/callback'],
      grantTypes: [],
      scopes: [WorkersScopes.CONNECT.id],
      tokenEndpointAuthMethod: TokenEndpointAuthMethod.NONE,
    });
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

    it("count a stopped worker's executions as stale after 2 minutes, but not an old worker's", async () => {
      const a = await agent();
      const t = await task(a);
      await eventually(() => queuedFor(a), (n) => n === 1);
      const execution = await claims().claimTask(ws, { taskId: t, workerClientId: WORKER });
      const now = Date.now();
      // Claimed 5 min ago; the agent was last heard from 3 min ago (under the
      // 10-min rule); the worker heartbeated after the claim, then went quiet.
      await executions().update({ id: execution.id }, {
        claimedAt: new Date(now - 5 * 60_000), lastHeartbeatAt: new Date(now - 3 * 60_000),
      });
      const workers = app.get(WorkersService);
      await workers.recordWorkerSeen(ws, { oauthClientId: WORKER, seenAt: new Date(now - 3 * 60_000) });
      const detector = app.get(StaleActiveTaskExecutionDetectorService);
      expect((await detector.findStaleExecutions()).map((e) => e.id)).toContain(execution.id);

      // A worker last seen before the claim never heartbeated during it (an
      // old worker): only the 10-min rule applies.
      await workers.recordWorkerSeen(ws, { oauthClientId: WORKER, seenAt: new Date(now - 6 * 60_000) });
      expect((await detector.findStaleExecutions()).map((e) => e.id)).not.toContain(execution.id);
      await app.get(StaleActiveTaskExecutionPrunerService).pruneExecutionById(execution.id);
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
    await app.get(StaleActiveTaskExecutionPrunerService).pruneExecutionById(execution.id);
    expect(await eventually(() => queue().countBy({ taskId: second }), (n) => n === 1)).toBe(1);
  });
});
