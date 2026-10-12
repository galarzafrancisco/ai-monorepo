import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

/**
 * Words the fake embedding model treats as the same idea. Everything else is
 * spread over other dimensions by a hash, so unrelated texts are not similar.
 */
const CONCEPTS: Record<string, number> = {
  car: 0, cars: 0, automobile: 0, vehicle: 0, engine: 0,
  pizza: 1, dough: 1, oven: 1, bake: 1,
  budget: 2, spend: 2, invoice: 2, invoices: 2, costs: 2,
};
const DIMENSIONS = 32;

function fakeEmbedding(text: string): number[] {
  const vector = new Array<number>(DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    const concept = CONCEPTS[word];
    if (concept !== undefined) {
      vector[concept] += 1;
      continue;
    }
    let hash = 0;
    for (const char of word) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    vector[8 + (hash % (DIMENSIONS - 8))] += 0.2;
  }
  const length = Math.hypot(...vector) || 1;
  return vector.map((value) => value / length);
}

/** An OpenAI-compatible /embeddings endpoint. */
function startFakeEmbeddingServer(calls: string[][]): Promise<Server> {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const input: string[] = [JSON.parse(body).input].flat();
      calls.push(input);
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          object: 'list',
          model: 'fake-embed',
          data: input.map((text, index) => ({
            object: 'embedding',
            index,
            embedding: fakeEmbedding(text),
          })),
          usage: { prompt_tokens: 1, total_tokens: 1 },
        }),
      );
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function eventually<T>(check: () => Promise<T>, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await check();
    } catch (error) {
      if (Date.now() > deadline) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

type Result = {
  id: string;
  type: string;
  title: string;
  score: number;
  url: string;
  matchedBy: string[];
  matchedOn: string;
  excerpt: string;
  excerptIsComplete: boolean;
  commentId: string | null;
  commentAuthor: string | null;
};

describe('Search E2E', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let embeddingServer: Server;
  const embeddingCalls: string[][] = [];

  const api = (method: 'post' | 'patch' | 'get' | 'put' | 'delete', path: string) =>
    request(httpServer)[method](`/api/v1${path}`).set('Cookie', authCookies);

  const search = async (query: string, extra: Record<string, unknown> = {}): Promise<Result[]> =>
    (await api('get', '/search/query').query({ query, ...extra }).expect(200)).body;

  const createBlock = async (title: string, content: string): Promise<string> =>
    (await api('post', '/context/blocks').send({ title, content }).expect(201)).body.id;

  const createTask = async (name: string, description: string): Promise<string> =>
    (await api('post', '/tasks/tasks').send({ name, description }).expect(201)).body.id;

  const indexStatus = async () => (await api('get', '/search/index').expect(200)).body;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    httpServer = app.getHttpServer();

    await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);
    embeddingServer = await startFakeEmbeddingServer(embeddingCalls);
  }, 30000);

  afterAll(async () => {
    await app.close();
    await new Promise((resolve) => embeddingServer.close(resolve));
  });

  describe('without an embedding model', () => {
    it('reports that semantic search is not active, and why', async () => {
      const status = await indexStatus();
      expect(status.semanticActive).toBe(false);
      expect(status.semanticInactiveReason).toEqual(expect.any(String));
      expect(status.pending).toBe(0);
    });

    it('finds a new block by a keyword in its content, and returns a short block whole', async () => {
      const id = await createBlock('Quarterly report', 'Unpaid invoices are chased on Fridays.');

      const [result] = await eventually(async () => {
        const results = await search('invoices');
        expect(results.map((entry) => entry.id)).toContain(id);
        return results;
      });

      expect(result).toMatchObject({
        id,
        type: 'context_block',
        title: 'Quarterly report',
        url: `/context/block/${id}`,
        matchedBy: ['keyword'],
        matchedOn: 'content',
        excerpt: 'Unpaid invoices are chased on Fridays.',
        excerptIsComplete: true,
        commentId: null,
      });
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('matches word forms, not only exact words', async () => {
      const results = await search('chasing invoice');
      expect(results[0]).toMatchObject({ title: 'Quarterly report', matchedBy: ['keyword'] });
    });

    it('finds a title despite typos, and shows the start of the item for a title match', async () => {
      const results = await search('quartely reprt');

      expect(results[0]).toMatchObject({
        title: 'Quarterly report',
        matchedBy: ['fuzzy_title'],
        matchedOn: 'title',
        excerpt: 'Unpaid invoices are chased on Fridays.',
        excerptIsComplete: true,
      });
    });

    it('says when the excerpt is only part of a long block', async () => {
      const filler = 'Nothing of note happens in this paragraph of the handbook.\n\n'.repeat(60);
      const id = await createBlock(
        'Office handbook',
        `Welcome to the office.\n\n${filler}The spare projector lives in the basement cupboard.\n\n${filler}`,
      );

      const byTitle = await eventually(async () => {
        const results = await search('office handbook');
        expect(results[0]?.id).toBe(id);
        return results[0];
      });
      expect(byTitle.matchedOn).toBe('title');
      expect(byTitle.excerpt.startsWith('Welcome to the office.')).toBe(true);
      expect(byTitle.excerptIsComplete).toBe(false);

      const byContent = (await search('projector basement'))[0];
      expect(byContent).toMatchObject({ id, matchedOn: 'content', excerptIsComplete: false });
      expect(byContent.excerpt).toContain('projector');
      expect(byContent.excerpt.length).toBeLessThan(2000);
    });

    it('finds a task through a comment and returns the comment', async () => {
      const taskId = await createTask('Plan the team lunch', 'Decide where to go.');
      const comment = (
        await api('post', `/tasks/tasks/${taskId}/comments`)
          .send({ content: 'The sourdough place needs a booking two days ahead.' })
          .expect(201)
      ).body;

      const result = await eventually(async () => {
        const results: Array<Record<string, unknown>> = (
          await api('get', '/tasks/tasks/search/query').query({ query: 'sourdough booking' }).expect(200)
        ).body;
        expect(results[0]?.id).toBe(taskId);
        return results[0];
      });

      expect(result).toMatchObject({
        id: taskId,
        name: 'Plan the team lunch',
        status: 'NOT_STARTED',
        matchedOn: 'comment',
        excerpt: 'The sourdough place needs a booking two days ahead.',
        excerptIsComplete: true,
        commentId: comment.id,
        commentAuthor: expect.any(String),
      });

      // One result per task, however many of its texts match.
      const all = await search('lunch');
      expect(all.filter((entry) => entry.id === taskId)).toHaveLength(1);
    });

    it('ranks different kinds of item in one list and filters by kind', async () => {
      await createTask('Renew the parking permit', 'The parking permit expires in March.');
      await createBlock('Parking rules', 'Visitors need a parking permit from reception.');

      const everything = await eventually(async () => {
        const results = await search('parking permit');
        expect(results.map((entry) => entry.type).sort()).toEqual(['context_block', 'task']);
        return results;
      });
      expect(everything[0].score).toBeGreaterThanOrEqual(everything[1].score);

      const onlyTasks = await search('parking permit', { types: 'task' });
      expect(onlyTasks.map((entry) => entry.type)).toEqual(['task']);

      const blocks: Array<{ title: string }> = (
        await api('get', '/context/blocks/search/query').query({ query: 'parking permit' }).expect(200)
      ).body;
      expect(blocks.map((entry) => entry.title)).toEqual(['Parking rules']);
    });

    it('follows edits and deletions', async () => {
      const id = await createBlock('Travel policy', 'Book trains through the portal.');
      await eventually(async () => expect((await search('trains portal'))[0]?.id).toBe(id));

      await api('patch', `/context/blocks/${id}`).send({ content: 'Book flights through the agency.' }).expect(200);
      await eventually(async () => {
        expect((await search('flights agency'))[0]?.id).toBe(id);
        expect(await search('trains portal')).toEqual([]);
      });

      await api('delete', `/context/blocks/${id}`).expect(204);
      await eventually(async () => expect(await search('flights agency')).toEqual([]));
    });

    it('returns nothing for a query that matches nothing', async () => {
      expect(await search('zzqqxx vbnmk')).toEqual([]);
      expect(await search('   ')).toEqual([]);
    });
  });

  describe('settings', () => {
    it('returns defaults, changes only what is sent, validates, and resets', async () => {
      const defaults = (await api('get', '/search/settings').expect(200)).body;
      expect(defaults).toMatchObject({ semanticEnabled: true, rrfK: 60, defaultLimit: 10 });

      const changed = (
        await api('patch', '/search/settings').send({ defaultLimit: 1, queryInstruction: '' }).expect(200)
      ).body;
      expect(changed).toEqual({ ...defaults, defaultLimit: 1, queryInstruction: '' });
      expect(await search('parking permit')).toHaveLength(1);

      await api('patch', '/search/settings').send({ rrfK: 0 }).expect(400);
      await api('patch', '/search/settings').send({ notASetting: 1 }).expect(400);

      expect((await api('delete', '/search/settings').expect(200)).body).toEqual(defaults);
    });
  });

  describe('with an embedding model', () => {
    let carBlockId: string;

    beforeAll(async () => {
      carBlockId = await createBlock('Fleet notes', 'Service every car engine twice a year.');

      const { port } = embeddingServer.address() as AddressInfo;
      const provider = (
        await api('post', '/ai-providers')
          .send({ name: 'Fake embedder', type: 'openai_compatible', baseUrl: `http://127.0.0.1:${port}/v1` })
          .expect(201)
      ).body;
      await api('put', '/ai-model-selections/embeddings')
        .send({ aiProviderId: provider.id, modelId: 'fake-embed' })
        .expect(200);
      // The fake model takes no instruction; a real instruction-aware one would.
      await api('patch', '/search/settings').send({ queryInstruction: '' }).expect(200);
    });

    it('embeds everything already indexed', async () => {
      // Kick the worker instead of waiting for its next tick.
      await api('post', '/search/index/rebuild').expect(201);

      const status = await eventually(async () => {
        const current = await indexStatus();
        expect(current.semanticActive).toBe(true);
        expect(current.pending).toBe(0);
        return current;
      }, 30_000);

      expect(status).toMatchObject({
        semanticInactiveReason: null,
        embeddingModelId: 'fake-embed',
        failed: 0,
        lastError: null,
      });
      expect(status.documents).toBeGreaterThan(0);
      expect(status.embedded).toBe(status.documents);
    }, 40_000);

    it('finds an item by meaning when no word matches', async () => {
      const results = await search('automobile');

      expect(results[0]).toMatchObject({
        id: carBlockId,
        matchedBy: ['semantic'],
        matchedOn: 'content',
        excerpt: 'Service every car engine twice a year.',
        excerptIsComplete: true,
      });
    });

    it('merges keyword and semantic matches for the same item', async () => {
      const results = await search('car engine');
      expect(results[0]).toMatchObject({ id: carBlockId, matchedBy: ['keyword', 'semantic'] });
    });

    it('embeds only the passages that changed when a block is appended to', async () => {
      const sections = Array.from(
        { length: 6 },
        (_, index) => `## Section ${index}\n\n${`Filler sentence number ${index}. `.repeat(40)}`,
      );
      const id = await createBlock('Long manual', sections.join('\n\n'));
      await eventually(async () => expect((await indexStatus()).pending).toBe(0), 30_000);

      embeddingCalls.length = 0;
      await api('patch', `/context/blocks/${id}`)
        .send({ content: `${sections.join('\n\n')}\n\n## Appendix\n\nThe pizza oven is in the yard.` })
        .expect(200);

      await eventually(async () => {
        const results = await search('dough');
        expect(results[0]).toMatchObject({ id, matchedBy: ['semantic'], excerptIsComplete: false });
        expect(results[0].excerpt).toContain('pizza oven');
      }, 30_000);

      const embeddedPassages = embeddingCalls.flat().filter((text) => text.startsWith('Long manual'));
      expect(embeddedPassages).toEqual(['Long manual > Appendix\n\n## Appendix\n\nThe pizza oven is in the yard.']);
    }, 70_000);

    it('falls back to keyword search when the embedding model is down', async () => {
      await new Promise((resolve) => embeddingServer.close(resolve));

      const results = await search('parking permit rules for visitors');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((entry) => !entry.matchedBy.includes('semantic'))).toBe(true);

      embeddingServer = await startFakeEmbeddingServer(embeddingCalls);
    });

    it('stops using embeddings when semantic search is turned off', async () => {
      await api('patch', '/search/settings').send({ semanticEnabled: false }).expect(200);

      expect(await search('automobile')).toEqual([]);
      expect(await indexStatus()).toMatchObject({ semanticActive: false, pending: 0 });

      await api('delete', '/search/settings').expect(200);
    });
  });
});
