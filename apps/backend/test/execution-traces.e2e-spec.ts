import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { ExecutionWireEvents, PostExecutionTracePayload } from '@taico/events';
import { RegisteredClientEntity } from '../src/authorization-server/entities/registered-client.entity';
import { TokenEndpointAuthMethod } from '../src/authorization-server/enums';
import { PostgresIoAdapter } from '../src/common/postgres-io.adapter';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';
import { AgentsService } from '../src/agents/agents.service';
import { ActiveTaskExecutionEntity } from '../src/executions/active/active-task-execution.entity';
import { TaskExecutionHistoryEntity } from '../src/executions/history/task-execution-history.entity';
import { TaskExecutionHistoryStatus } from '../src/executions/history/task-execution-history-status.enum';
import { TaskStatus } from '../src/tasks/enums';
import { AccessTokenValidationService } from '../src/auth/guards/validation/access-token-validation.service';
import { WorkersScopes } from '../src/executions/workers.scopes';
import { StaleActiveTaskExecutionPrunerService } from '../src/executions/staleness/stale-active-task-execution-pruner.service';
import { ExecutionTraceEntity } from '../src/executions/traces/execution-trace.entity';

// Real migration + PostgreSQL + worker socket + authenticated read API. Only
// token verification is stubbed for two synthetic worker client identities.
describe('Raw execution traces E2E', () => {
  let app: INestApplication;
  let db: DataSource;
  let cookies: string;
  let agentActorId: string;
  let taskId: string;
  let executionId: string;
  let owner: Socket;
  let stranger: Socket;
  const sockets: Socket[] = [];
  let tokenSpy: jest.SpyInstance;

  const connect = async (token: string) => {
    const { port } = app.getHttpServer().address() as AddressInfo;
    const socket = io(`http://127.0.0.1:${port}/executions/worker`, {
      transports: ['websocket'],
      auth: { token },
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  };
  const payload = (sequence = 1): PostExecutionTracePayload => ({
    executionId,
    harness: 'claude',
    events: [
      {
        sequence,
        emittedAt: new Date().toISOString(),
        runnerSessionId: 'session-1',
        payload: {
          type: 'tool_result',
          output: { content: ['full result'], arbitrary: { untouched: true } },
        },
      },
    ],
  });
  const post = (socket: Socket, body: unknown) =>
    socket
      .timeout(5000)
      .emitWithAck(ExecutionWireEvents.EXECUTION_TRACE_POST, body);
  const read = (query = '') =>
    request(app.getHttpServer())
      .get(`/api/v1/executions/${executionId}/traces${query}`)
      .set('Cookie', cookies);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    const ioAdapter = new PostgresIoAdapter(app);
    await ioAdapter.prepare();
    app.useWebSocketAdapter(ioAdapter);
    await app.listen(0, '127.0.0.1');
    db = app.get(DataSource);
    await ensureTestUser(app);
    cookies = await getAuthCookies(app.getHttpServer());
    const agent = await app.get(AgentsService).createAgent({
      slug: `trace-${randomUUID()}`,
      name: 'Trace Agent',
      systemPrompt: 'test',
      statusTriggers: [],
      allowedTools: [],
    });
    agentActorId = agent.actorId;
    const validator = app.get(AccessTokenValidationService);
    const original = validator.validateAccessToken.bind(validator);
    tokenSpy = jest
      .spyOn(validator, 'validateAccessToken')
      .mockImplementation(async (token, ...args) => {
        if (token === 'trace-owner' || token === 'trace-stranger') {
          return {
            sub: 'worker',
            client_id: token,
            scope: [WorkersScopes.CONNECT.id],
            aud: 'ai-backend',
            exp: Math.floor(Date.now() / 1000) + 3600,
          } as any;
        }
        return original(token, ...args);
      });
    for (const clientId of ['trace-owner', 'trace-stranger']) {
      await db.getRepository(RegisteredClientEntity).save({
        clientId,
        clientName: clientId,
        redirectUris: ['http://127.0.0.1/callback'],
        grantTypes: [],
        scopes: [WorkersScopes.CONNECT.id],
        tokenEndpointAuthMethod: TokenEndpointAuthMethod.NONE,
      });
    }
    owner = await connect('trace-owner');
    stranger = await connect('trace-stranger');
  }, 60000);

  beforeEach(async () => {
    const task = await request(app.getHttpServer())
      .post('/api/v1/tasks/tasks')
      .set('Cookie', cookies)
      .send({ name: 'Trace task', description: 'test' })
      .expect(201);
    taskId = task.body.id;
    const execution = await db.getRepository(ActiveTaskExecutionEntity).save({
      taskId,
      agentActorId,
      workerClientId: 'trace-owner',
      claimedAt: new Date(),
      taskStatusBeforeClaim: TaskStatus.NOT_STARTED,
      taskTagsBeforeClaim: [],
      taskAssigneeActorIdBeforeClaim: null,
      lastHeartbeatAt: new Date(),
      toolCallCount: 0,
    });
    executionId = execution.id;
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.close());
    tokenSpy?.mockRestore();
    if (app) await app.close();
  });

  it('persists unmodified JSON and handles duplicate retries without overwrite', async () => {
    const body = payload();
    expect(await post(owner, body)).toEqual({ ok: true });
    body.events[0].payload = { tampered: true };
    expect(await post(owner, body)).toEqual({ ok: true });
    const response = await read().expect(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      sequence: 1,
      harness: 'claude',
      runnerSessionId: 'session-1',
      payload: payload().events[0].payload,
    });
  });

  it('stores tool output larger than the default Socket.IO frame limit without truncation', async () => {
    const body = payload();
    const content = 'x'.repeat(2 * 1024 * 1024);
    body.events[0].payload = { type: 'tool_result', content };
    expect(await post(owner, body)).toEqual({ ok: true });
    expect((await read().expect(200)).body.items[0].payload).toEqual(
      body.events[0].payload,
    );
  });

  it('round-trips NULs, lone surrogates and JSON-looking escapes without altering raw payloads', async () => {
    const body = payload();
    body.events[0].payload = {
      text: 'before\u0000after',
      surrogate: '\ud800',
      literal: '\\u0000',
      nested: { ['key\u0000']: ['\udfff', null, '😀'] },
    };
    expect(await post(owner, body)).toEqual({ ok: true });
    expect((await read().expect(200)).body.items[0].payload).toEqual(
      body.events[0].payload,
    );
    expect(await post(owner, payload(2))).toEqual({ ok: true });
    expect((await read().expect(200)).body.items).toHaveLength(2);
  });

  it('orders by sequence and pages by cursor, including JSON null', async () => {
    expect(await post(owner, payload(3))).toEqual({ ok: true });
    const body = payload(1);
    body.events.push({ ...body.events[0], sequence: 2, payload: null });
    expect(await post(owner, body)).toEqual({ ok: true });
    const first = await read('?limit=2').expect(200);
    expect(first.body.items.map((item: any) => item.sequence)).toEqual([1, 2]);
    expect(first.body.items[1].payload).toBeNull();
    expect(first.body.nextAfterSequence).toBe(2);
    const second = await read('?afterSequence=2').expect(200);
    expect(second.body.items.map((item: any) => item.sequence)).toEqual([3]);
  });

  it('rejects other workers and malformed batches without writes', async () => {
    expect(await post(stranger, payload())).toMatchObject({
      ok: false,
      permanent: true,
    });
    for (const body of [
      null,
      { ...payload(), executionId: 'invalid' },
      { ...payload(), events: [] },
      { ...payload(), events: [{ ...payload().events[0], sequence: 0 }] },
      {
        ...payload(),
        events: [{ ...payload().events[0], emittedAt: 'bad date' }],
      },
    ]) {
      expect(await post(owner, body)).toMatchObject({
        ok: false,
        permanent: true,
      });
    }
    expect((await read().expect(200)).body.items).toEqual([]);
    await request(app.getHttpServer())
      .get(`/api/v1/executions/${executionId}/traces`)
      .expect(401);
    await read('?limit=101').expect(400);
  });

  it('accepts late batches after moving to history and keeps existing traces', async () => {
    await post(owner, payload());
    await db.transaction(async (manager) => {
      const execution = await manager.findOneByOrFail(
        ActiveTaskExecutionEntity,
        { id: executionId },
      );
      await manager.delete(ActiveTaskExecutionEntity, { id: executionId });
      await manager.save(TaskExecutionHistoryEntity, {
        id: executionId,
        taskId,
        agentActorId,
        workerClientId: execution.workerClientId,
        claimedAt: execution.claimedAt,
        transitionedAt: new Date(),
        toolCallCount: 0,
        status: TaskExecutionHistoryStatus.SUCCEEDED,
      });
    });
    expect(await post(owner, payload(2))).toEqual({ ok: true });
    expect((await post(stranger, payload(3))).ok).toBe(false);
    expect((await read().expect(200)).body.items).toHaveLength(2);
  });

  it('preserves stale execution IDs so their traces remain available', async () => {
    await post(owner, payload());
    await app
      .get(StaleActiveTaskExecutionPrunerService)
      .pruneExecutionById(executionId);
    expect(
      await db
        .getRepository(TaskExecutionHistoryEntity)
        .findOneBy({ id: executionId }),
    ).not.toBeNull();
    expect(await post(owner, payload(2))).toEqual({ ok: true });
    expect((await read().expect(200)).body.items).toHaveLength(2);
    await request(app.getHttpServer())
      .delete(`/api/v1/tasks/tasks/${taskId}`)
      .set('Cookie', cookies)
      .expect(204);
    expect(
      await db.getRepository(ExecutionTraceEntity).countBy({ executionId }),
    ).toBe(2);
    expect((await read().expect(200)).body.items).toHaveLength(2);
  });
});
