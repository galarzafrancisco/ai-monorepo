import assert from 'node:assert/strict';
import test from 'node:test';
import { BleDisplay } from '../dist/ble-display.js';

test('reconnects and renders after a write callback times out', async () => {
  const firstPeripheral = createPeripheral({ write: () => undefined });
  const secondWrites = [];
  const secondPeripheral = createPeripheral({
    write: (data, _withoutResponse, callback) => {
      secondWrites.push(data.toString('ascii'));
      callback(null);
    },
  });
  const peripherals = [firstPeripheral, secondPeripheral];
  const noble = {
    state: 'poweredOn',
    on(event, listener) {
      if (event === 'discover') queueMicrotask(() => listener(peripherals.shift()));
    },
    removeListener() {},
    startScanning(_serviceUuids, _allowDuplicates, callback) {
      callback(null);
    },
    stopScanning(callback) {
      callback();
    },
  };
  const display = new BleDisplay('Taico Display', { retryDelayMs: 1, writeTimeoutMs: 5 });
  display.loadBluetoothClient = async () => noble;

  display.start();
  display.update({ todo: 1, doing: 2, review: 3, done: 4, workers: 5, active: 6 });

  await waitFor(() => secondWrites.includes('COMMIT FULL'));
  assert.equal(firstPeripheral.disconnectCalls, 1);
  assert.ok(secondWrites.length > 0);
});

function createPeripheral(characteristic) {
  return {
    advertisement: { localName: 'Taico Display' },
    disconnectCalls: 0,
    connect(callback) {
      callback(null);
    },
    disconnect(callback) {
      this.disconnectCalls += 1;
      callback?.();
    },
    once() {},
    discoverSomeServicesAndCharacteristics(_services, _characteristics, callback) {
      callback(null, [], [{ uuid: '1234567812345678123456789abcdef2', write: characteristic.write }]);
    },
  };
}

async function waitFor(predicate) {
  const deadline = Date.now() + 1_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for display render.');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
