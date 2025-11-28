import { Test, TestingModule } from '@nestjs/testing';
import { Documents } from './documents';

describe('Documents', () => {
  let provider: Documents;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [Documents],
    }).compile();

    provider = module.get<Documents>(Documents);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
