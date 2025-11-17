import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryController } from './discovery.controller';

describe('DiscoveryController', () => {
  let controller: DiscoveryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DiscoveryController],
    }).compile();

    controller = module.get<DiscoveryController>(DiscoveryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
