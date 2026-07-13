import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ServerLifecycleService } from './server-lifecycle.service';

describe('AppController', () => {
  let appController: AppController;
  let serverLifecycle: ServerLifecycleService;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, ServerLifecycleService],
    }).compile();

    appController = app.get<AppController>(AppController);
    serverLifecycle = app.get<ServerLifecycleService>(ServerLifecycleService);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return live status', () => {
      expect(appController.getLive()).toEqual({ status: 'ok' });
    });

    it('should return ready status before shutdown', () => {
      expect(appController.getReady()).toEqual({ status: 'ready' });
    });

    it('should reject readiness after shutdown starts', () => {
      serverLifecycle.beginShutdown('SIGTERM');

      expect(() => appController.getReady()).toThrow('Server is shutting down');
    });
  });
});
