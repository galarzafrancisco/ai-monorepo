import { INestApplication, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { ActiveExecutionsChangedEvent } from '../src/executions/events/active-executions-changed.event';
import { TaskEligibilitySchedulerService } from '../src/executions/readiness/task-eligibility-scheduler.service';
import { StaleActiveTaskExecutionSchedulerService } from '../src/executions/staleness/stale-active-task-execution-scheduler.service';
import { DEFAULT_WORKSPACE_ID } from '../src/workspaces/workspaces.constants';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const DB_GONE = /driver not connected|connection terminated/i;

/**
 * Background queue sweeps and scans must finish (or never start) before
 * TypeORM closes its connection on `app.close()`, or they fail with
 * "Driver not Connected" / "Connection terminated" after shutdown.
 */
describe('Executions background work on shutdown (e2e)', () => {
  let errors: string[];

  async function boot(): Promise<INestApplication> {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleFixture.createNestApplication();
    await app.init();
    return app;
  }

  beforeEach(() => {
    errors = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      errors.push(JSON.stringify(message));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['scheduled but not started', 0],
    ['in flight', 260],
  ])('drops or waits for a queue re-check after an execution change (%s)', async (_label, delayMs) => {
    const app = await boot();
    app.get(EventEmitter2).emit(
      ActiveExecutionsChangedEvent.INTERNAL,
      new ActiveExecutionsChangedEvent(DEFAULT_WORKSPACE_ID),
    );
    await sleep(delayMs);
    await app.close();
    await sleep(500); // past the 250ms coalescing delay
    expect(errors.filter((e) => DB_GONE.test(e))).toEqual([]);
  }, 60000);

  it('waits for cron ticks that are in flight', async () => {
    const app = await boot();
    const sweep = app.get(TaskEligibilitySchedulerService).reconcileAllTasks();
    const scan = app.get(StaleActiveTaskExecutionSchedulerService).pruneStaleExecutions();
    await app.close();
    await expect(sweep).resolves.toBeUndefined();
    await scan;
    expect(errors.filter((e) => DB_GONE.test(e))).toEqual([]);
    // Ticks after shutdown do nothing rather than hit a closed connection.
    await expect(app.get(TaskEligibilitySchedulerService).reconcileAllTasks()).resolves.toBeUndefined();
  }, 60000);
});
