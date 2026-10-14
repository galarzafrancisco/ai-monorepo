import { AiModelJob } from 'src/ai-providers/enums';
import { ActorType } from 'src/identity-provider/enums';
import { ThreadTitleService } from './thread-title.service';

jest.mock('./chat.service', () => ({ ChatService: class {} }));

describe('ThreadTitleService', () => {
  const setup = (generated: string | null = 'Release plan') => {
    const generateText = jest.fn(async () => generated);
    const service = new ThreadTitleService({ generateText } as never);
    return { service, generateText };
  };

  const human = (id: string) => ({ id, type: ActorType.HUMAN });
  const agent = (id: string) => ({ id, type: ActorType.AGENT });

  it('names a thread from a person’s first message on user small tasks, for that person', async () => {
    const { service, generateText } = setup();

    await expect(
      service.generateFromMessage('Plan the release', human('author-1')),
    ).resolves.toBe('Release plan');

    expect(generateText).toHaveBeenCalledWith(expect.stringContaining('Plan the release'), {
      job: AiModelJob.USER_SMALL_TASKS,
      onBehalfOf: {
        actorId: 'author-1',
        automated: false,
        description: 'the person who wrote the first message',
      },
    });
  });

  it('names a thread a person created for a task on user small tasks, for that person', async () => {
    const { service, generateText } = setup();

    await service.generateFromParentTask(
      { name: 'Ship it', description: 'Release 1.0' } as never,
      human('creator-1'),
    );

    expect(generateText).toHaveBeenCalledWith(expect.stringContaining('Ship it'), {
      job: AiModelJob.USER_SMALL_TASKS,
      onBehalfOf: {
        actorId: 'creator-1',
        automated: false,
        description: 'the person who created this thread',
      },
    });
  });

  it('names a thread an agent created (e.g. for a subtask) on system small tasks, for nobody', async () => {
    const { service, generateText } = setup();

    await expect(
      service.generateFromParentTask(
        { name: 'Ship it', description: 'Release 1.0' } as never,
        agent('agent-1'),
      ),
    ).resolves.toBe('Release plan');

    expect(generateText).toHaveBeenCalledWith(expect.stringContaining('Ship it'), {
      job: AiModelJob.SYSTEM_SMALL_TASKS,
    });
  });

  it('names a thread from an agent’s first message on system small tasks', async () => {
    const { service, generateText } = setup();

    await service.generateFromMessage('Status update', agent('agent-1'));

    expect(generateText).toHaveBeenCalledWith(expect.stringContaining('Status update'), {
      job: AiModelJob.SYSTEM_SMALL_TASKS,
    });
  });

  it('leaves the title alone when the model gives nothing', async () => {
    const { service } = setup(null);

    await expect(service.generateFromMessage('Hi', human('author-1'))).resolves.toBeNull();
  });
});
