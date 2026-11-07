import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { getConfig } from '../src/config/env.config';
import { AgentsService } from '../src/agents/agents.service';
import { ActorType } from '../src/identity-provider/enums';
import { ThreadsService } from '../src/threads/threads.service';
import { TaicoMcpToolsFactory } from '../src/threads/agent/taico-mcp-tools.factory';
import { ensureTestUser, TEST_USER_DISPLAY_NAME, TEST_USER_SLUG } from './helpers/auth.helper';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { IssuedAccessTokenService } from '../src/authorization-server/issued-access-token.service';
import { TasksService } from '../src/tasks/tasks.service';
import { ThreadAgentService } from '../src/threads/agent/thread-agent.service';
import { WorkspaceEntity } from '../src/workspaces/workspace.entity';
import { WorkspaceMemberEntity } from '../src/workspaces/workspace-member.entity';
import { WorkspaceRole } from '../src/workspaces/enums';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';

/** A workspace both the test user and the threads agent are members of. */
const WORKSPACE_B_ID = '44444444-4444-4444-8444-444444444444';
/** A workspace only the test user is a member of. */
const WORKSPACE_C_ID = '55555555-5555-4555-8555-555555555555';

type ToolResult = { isError?: boolean; content: Array<{ type: string; text: string }> };

/**
 * The agent reaches Taico's MCP endpoints over HTTP at the issuer URL, so this
 * spec listens on that port. Set ISSUER_URL to a free port when the default is taken.
 */
describe('Thread agent MCP tools E2E', () => {
  let app: INestApplication<App>;
  let userActorId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.listen(Number(new URL(getConfig().issuerUrl).port));

    userActorId = await ensureTestUser(app);

    const workspaces: Repository<WorkspaceEntity> = app.get(getRepositoryToken(WorkspaceEntity));
    const members: Repository<WorkspaceMemberEntity> = app.get(
      getRepositoryToken(WorkspaceMemberEntity),
    );
    const self = await app.get(AgentsService).getAgentBySlug(DEFAULT_WORKSPACE_ID, { slug: 'taico' });
    for (const [id, slug, actorIds] of [
      [WORKSPACE_B_ID, 'agent-mcp-b', [userActorId, self.actorId]],
      [WORKSPACE_C_ID, 'agent-mcp-c', [userActorId]],
    ] as const) {
      await workspaces.createQueryBuilder().insert().values({ id, slug, name: slug }).orIgnore().execute();
      for (const actorId of actorIds) {
        await members
          .createQueryBuilder()
          .insert()
          .values({ workspaceId: id, actorId, role: WorkspaceRole.ADMIN })
          .orIgnore()
          .execute();
      }
    }
  }, 30000);

  const user = () => ({
    id: userActorId,
    slug: TEST_USER_SLUG,
    type: ActorType.HUMAN,
    displayName: TEST_USER_DISPLAY_NAME,
  });

  async function agentSubject() {
    const self = await app.get(AgentsService).getAgentBySlug(DEFAULT_WORKSPACE_ID, { slug: 'taico' });
    return { id: self.actorId, slug: self.slug, type: ActorType.AGENT, displayName: self.name };
  }

  async function call(
    mcp: Awaited<ReturnType<TaicoMcpToolsFactory['open']>>,
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    return (await mcp.tools[name].execute!(args, {
      toolCallId: `call-${name}`,
      messages: [],
    } as never)) as ToolResult;
  }

  afterAll(async () => {
    await app.close();
  });

  it('loads the tasks and context tools and can call them as the agent', async () => {
    const self = await app.get(AgentsService).getAgentBySlug(DEFAULT_WORKSPACE_ID, { slug: 'taico' });

    const mcp = await app.get(TaicoMcpToolsFactory).open({
      workspaceId: DEFAULT_WORKSPACE_ID,
      subject: { id: self.actorId, slug: self.slug, type: ActorType.AGENT, displayName: self.name },
      issuedBy: {
        id: userActorId,
        slug: TEST_USER_SLUG,
        type: ActorType.HUMAN,
        displayName: TEST_USER_DISPLAY_NAME,
      },
    });

    try {
      const names = Object.keys(mcp.tools);
      expect(names).toEqual(
        expect.arrayContaining([
          'tasks__list_tasks_by_thread',
          'tasks__attach_task_to_thread',
          'context__get_thread_state_memory',
          'context__update_block',
        ]),
      );

      const thread = await app
        .get(ThreadsService)
        .createThread(DEFAULT_WORKSPACE_ID, { title: 'MCP thread', createdByActorId: userActorId });
      const result = await mcp.tools['tasks__list_tasks_by_thread'].execute!(
        { threadId: thread.id },
        { toolCallId: 'call-1', messages: [] } as never,
      );
      expect((result as { isError?: boolean }).isError).not.toBe(true);
    } finally {
      await mcp.close();
    }
  });

  describe('workspace of the token', () => {
    const canary = `canary-${randomBytes(4).toString('hex')}`;

    it("reaches only the thread's workspace, in both directions", async () => {
      const tasks = app.get(TasksService);
      const taskA = await tasks.createTask(DEFAULT_WORKSPACE_ID, {
        name: `A task ${canary}`,
        description: `A only ${canary}`,
        createdByActorId: userActorId,
      });
      const taskB = await tasks.createTask(WORKSPACE_B_ID, {
        name: 'B task',
        description: 'B only',
        createdByActorId: userActorId,
      });

      const inB = await app.get(TaicoMcpToolsFactory).open({
        workspaceId: WORKSPACE_B_ID,
        subject: await agentSubject(),
        issuedBy: user(),
      });
      const inA = await app.get(TaicoMcpToolsFactory).open({
        workspaceId: DEFAULT_WORKSPACE_ID,
        subject: await agentSubject(),
        issuedBy: user(),
      });
      try {
        // B's token: A's task is not found, for reading and for writing.
        const fetchA = await call(inB, 'tasks__fetch', { taskId: taskA.id });
        expect(fetchA.isError).toBe(true);
        expect(JSON.stringify(fetchA)).not.toContain(canary);
        const commentA = await call(inB, 'tasks__add_comment', { taskId: taskA.id, content: 'from B' });
        expect(commentA.isError).toBe(true);
        // B's own task works.
        const fetchB = await call(inB, 'tasks__fetch', { taskId: taskB.id });
        expect(fetchB.isError).not.toBe(true);
        expect(JSON.parse(fetchB.content[0].text)).toMatchObject({ id: taskB.id });
        expect((await call(inB, 'tasks__add_comment', { taskId: taskB.id, content: 'from B' })).isError).not.toBe(true);

        // The other direction: A's token does not reach B's task.
        expect((await call(inA, 'tasks__fetch', { taskId: taskB.id })).isError).toBe(true);
        expect((await call(inA, 'tasks__fetch', { taskId: taskA.id })).isError).not.toBe(true);

        // A is unchanged by B's attempt.
        const after = await tasks.getTaskById(DEFAULT_WORKSPACE_ID, taskA.id);
        expect(after.comments.map((comment) => comment.content)).not.toContain('from B');
      } finally {
        await inB.close();
        await inA.close();
      }
    });

    it('issues no token in a workspace the agent is not a member of', async () => {
      await expect(
        app.get(TaicoMcpToolsFactory).open({
          workspaceId: WORKSPACE_C_ID,
          subject: await agentSubject(),
          issuedBy: user(),
        }),
      ).rejects.toMatchObject({ code: 'TOKEN_ACTOR_NOT_IN_WORKSPACE' });
    });

    it("never mints a token outside the thread's workspace during a turn", async () => {
      const issuer = app.get(IssuedAccessTokenService);
      const issue = jest.spyOn(issuer, 'issueSystemToken');
      try {
        const threads = app.get(ThreadsService);
        const threadC = await threads.createThread(WORKSPACE_C_ID, {
          title: 'C thread',
          createdByActorId: userActorId,
        });
        await threads.createMessage(WORKSPACE_C_ID, {
          threadId: threadC.id,
          content: `List my tasks ${canary}`,
          createdByActorId: userActorId,
        });
        await app.get(ThreadAgentService).drain(threadC.id);
        await new Promise((resolve) => setTimeout(resolve, 300));

        for (const [input] of issue.mock.calls) {
          expect(input.workspaceId).toBe(WORKSPACE_C_ID);
        }
      } finally {
        issue.mockRestore();
      }
    });
  });
});
