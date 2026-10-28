import { ThreadTurnStatus } from './thread-agent.enums';
import { ThreadTurnsService } from './thread-turns.service';

describe('ThreadTurnsService', () => {
  it('records a conflicting request on the running turn and returns its count on finish', async () => {
    let claimedId: string | null = null;
    let requests = 0;
    const query = jest.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('INSERT INTO thread_turns')) {
        if (!claimedId) claimedId = params[0] as string;
        else requests += 1;
        return [{ id: claimedId }];
      }
      if (sql.includes('RETURNING request_count')) {
        return [[{ request_count: String(requests) }], 1];
      }
      return [[], 0];
    });
    const turns = new ThreadTurnsService({ query } as never);

    const claimed = await turns.tryClaim('thread-id');
    expect(claimed?.id).toBe(claimedId);
    expect(await turns.tryClaim('thread-id')).toBeNull();
    expect(await turns.finish(claimed!.id, ThreadTurnStatus.FAILED)).toBe(1);
    expect(query.mock.calls.at(-1)?.[0]).toContain('RETURNING request_count');
  });
});
