// The errors package is ESM, which this Jest setup does not load. Codes equal their names.
jest.mock('@taico/errors', () => ({
  ErrorCodes: new Proxy({}, { get: (_target, name) => name }),
}));
jest.mock('../context/context.service', () => ({ ContextService: class {} }));
import { ThreadRenameService } from './thread-rename.service';
import { InvalidThreadTitleError, ThreadNotFoundError } from './errors/threads.errors';
import { ThreadTitleUpdatedEvent } from './events/threads.events';

describe('ThreadRenameService', () => {
  let repo: { findOne: jest.Mock; save: jest.Mock };
  let context: { updateBlock: jest.Mock };
  let emitter: { emit: jest.Mock };
  let service: ThreadRenameService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue({ id: 't1', title: 'old', stateContextBlockId: 'b1' }),
      save: jest.fn().mockResolvedValue(undefined),
    };
    context = { updateBlock: jest.fn().mockResolvedValue(undefined) };
    emitter = { emit: jest.fn() };
    service = new ThreadRenameService(repo as any, context as any, emitter as any);
  });

  it('persists the trimmed title, emits the event and updates the state block', async () => {
    const result = await service.rename('t1', '  New name  ', 'a1');
    expect(result).toBe('New name');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'New name' }));
    expect(emitter.emit).toHaveBeenCalledWith(
      ThreadTitleUpdatedEvent.INTERNAL,
      expect.any(ThreadTitleUpdatedEvent),
    );
    expect(context.updateBlock).toHaveBeenCalledWith('b1', { title: 'Thread State: New name' });
  });

  it('throws when the thread is missing', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.rename('x', 'Title', 'a1')).rejects.toBeInstanceOf(ThreadNotFoundError);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('rejects a blank title', async () => {
    await expect(service.rename('t1', '   ', 'a1')).rejects.toMatchObject({ code: 'INVALID_THREAD_TITLE' });
    expect(repo.save).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('still succeeds when the state block update fails', async () => {
    context.updateBlock.mockRejectedValue(new Error('boom'));
    await expect(service.rename('t1', 'Ok', 'a1')).resolves.toBe('Ok');
  });
});
