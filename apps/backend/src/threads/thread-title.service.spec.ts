import { ThreadTitleService } from './thread-title.service';

jest.mock('./chat.service', () => ({ ChatService: class {} }));

describe('ThreadTitleService', () => {
  const setup = (generated: string | null = 'Release plan') => {
    const generateText = jest.fn(async () => generated);
    const service = new ThreadTitleService({ generateText } as never);
    return { service, generateText };
  };

  it('names a thread from its first message on the author’s plan, as something they asked for', async () => {
    const { service, generateText } = setup();

    await expect(service.generateFromMessage('Plan the release', 'author-1')).resolves.toBe(
      'Release plan',
    );

    expect(generateText).toHaveBeenCalledWith(expect.stringContaining('Plan the release'), {
      onBehalfOf: {
        actorId: 'author-1',
        automated: false,
        description: 'the person who wrote the first message',
      },
    });
  });

  it('names a thread from its parent task on the creator’s plan, as an unattended call', async () => {
    const { service, generateText } = setup();

    await service.generateFromParentTask(
      { name: 'Ship it', description: 'Release 1.0' } as never,
      'creator-1',
    );

    expect(generateText).toHaveBeenCalledWith(expect.stringContaining('Ship it'), {
      onBehalfOf: {
        actorId: 'creator-1',
        automated: true,
        description: 'the person who created this thread',
      },
    });
  });

  it('leaves the title alone when the model gives nothing', async () => {
    const { service } = setup(null);

    await expect(service.generateFromMessage('Hi', 'author-1')).resolves.toBeNull();
  });
});
