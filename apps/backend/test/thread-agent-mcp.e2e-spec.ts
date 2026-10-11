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
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('loads the tasks and context tools and can call them as the agent', async () => {
    const self = await app.get(AgentsService).getAgentBySlug({ slug: 'taico' });

    const mcp = await app.get(TaicoMcpToolsFactory).open({
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
        .createThread({ title: 'MCP thread', createdByActorId: userActorId });
      const result = await mcp.tools['tasks__list_tasks_by_thread'].execute!(
        { threadId: thread.id },
        { toolCallId: 'call-1', messages: [] } as never,
      );
      expect((result as { isError?: boolean }).isError).not.toBe(true);
    } finally {
      await mcp.close();
    }
  });
});
