import assert from 'node:assert/strict';
import test from 'node:test';
import { claimIfNotInFlight } from './task-claim-worker.js';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

test('deduplicates duplicate socket notifications while a claim is in flight', async () => {
  const pending = deferred();
  let calls = 0;
  const claim = () => {
    calls += 1;
    return pending.promise;
  };

  const socketNotification = claimIfNotInFlight('socket-task', claim);
  await claimIfNotInFlight('socket-task', claim);
  assert.equal(calls, 1);

  pending.resolve();
  await socketNotification;
});

test('deduplicates overlapping polling and socket claim attempts', async () => {
  const pending = deferred();
  let calls = 0;
  const claim = () => {
    calls += 1;
    return pending.promise;
  };

  const pollAttempt = claimIfNotInFlight('overlap-task', claim);
  await claimIfNotInFlight('overlap-task', claim);
  assert.equal(calls, 1);

  pending.resolve();
  await pollAttempt;
});

test('releases a task after successful and failed claim attempts', async () => {
  let calls = 0;
  const claim = async () => {
    calls += 1;
  };

  await claimIfNotInFlight('cleanup-success-task', claim);
  await claimIfNotInFlight('cleanup-success-task', claim);
  await assert.rejects(
    claimIfNotInFlight('cleanup-failure-task', async () => {
      throw new Error('claim failed');
    }),
  );
  await claimIfNotInFlight('cleanup-failure-task', claim);

  assert.equal(calls, 3);
});

test('allows claims for different tasks to run concurrently', async () => {
  const first = deferred();
  const second = deferred();
  let calls = 0;

  const firstAttempt = claimIfNotInFlight('first-task', () => {
    calls += 1;
    return first.promise;
  });
  const secondAttempt = claimIfNotInFlight('second-task', () => {
    calls += 1;
    return second.promise;
  });

  assert.equal(calls, 2);
  first.resolve();
  second.resolve();
  await Promise.all([firstAttempt, secondAttempt]);
});
