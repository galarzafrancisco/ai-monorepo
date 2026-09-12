const WRITE_CHARACTERISTIC = '12345678-1234-5678-1234-56789abcdef2';
const RETRY_DELAY_MS = 5_000;

type Noble = {
  state: string;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
  startScanning(
    serviceUuids: string[],
    allowDuplicates: boolean,
    callback: (error: Error | null) => void,
  ): void;
  stopScanning(callback: () => void): void;
};

type BleCharacteristic = {
  uuid: string;
  write(data: Buffer, withoutResponse: boolean, callback: (error: Error | null) => void): void;
};

type BlePeripheral = {
  advertisement?: { localName?: string };
  connect(callback: (error: Error | null) => void): void;
  once(event: 'disconnect', listener: () => void): void;
  discoverSomeServicesAndCharacteristics(
    serviceUuids: string[],
    characteristicUuids: string[],
    callback: (
      error: Error | null,
      services: unknown[],
      characteristics: BleCharacteristic[],
    ) => void,
  ): void;
};

export type DisplaySnapshot = {
  todo: number;
  doing: number;
  review: number;
  done: number;
  workers: number;
  active: number;
};

export class BleDisplay {
  private characteristic: BleCharacteristic | null = null;
  private latestSnapshot: DisplaySnapshot | null = null;
  private layoutDefined = false;
  private started = false;

  constructor(private readonly deviceName: string) {}

  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    void this.runConnectionLoop();
  }

  update(snapshot: DisplaySnapshot): void {
    this.latestSnapshot = snapshot;
    void this.renderLatest();
  }

  private async runConnectionLoop(): Promise<void> {
    while (this.started) {
      try {
        const noble = await this.loadBluetoothClient();
        await waitForBluetooth(noble);

        const peripheral = await discover(noble, this.deviceName);
        await connect(peripheral);
        this.characteristic = await getWriteCharacteristic(peripheral);
        this.layoutDefined = false;

        console.log(`[display] Connected to ${this.deviceName}.`);
        await this.renderLatest();
        await waitForDisconnect(peripheral);
        console.warn('[display] Bluetooth display disconnected. Reconnecting.');
      } catch (error) {
        console.warn(
          `[display] Bluetooth unavailable: ${message(error)}. Retrying in 5 seconds.`,
        );
      } finally {
        this.characteristic = null;
        this.layoutDefined = false;
      }

      await sleep(RETRY_DELAY_MS);
    }
  }

  private async loadBluetoothClient(): Promise<Noble> {
    try {
      const { default: noble } = await import('@stoprocent/noble');
      return noble as Noble;
    } catch (error) {
      throw new Error(
        `Bluetooth support is unavailable. Install @stoprocent/noble. (${message(error)})`,
      );
    }
  }

  private async renderLatest(): Promise<void> {
    if (!this.characteristic || !this.latestSnapshot) {
      return;
    }

    try {
      if (!this.layoutDefined) {
        await this.send('CLEAR_ALL');
        for (const field of FIELDS) {
          await this.send(`FIELD ${field}`);
        }
        this.layoutDefined = true;
        await this.render('FULL');
        return;
      }

      await this.render('PARTIAL');
    } catch (error) {
      console.warn(`[display] Failed to write display: ${message(error)}.`);
      this.characteristic = null;
      this.layoutDefined = false;
    }
  }

  private async render(refreshType: 'FULL' | 'PARTIAL'): Promise<void> {
    if (!this.latestSnapshot) {
      return;
    }

    const { todo, doing, review, done, workers, active } = this.latestSnapshot;
    await this.send(`TEXT todo To do:  ${formatCount(todo)}`);
    await this.send(`TEXT doing Doing:  ${formatCount(doing)}`);
    await this.send(`TEXT review Review: ${formatCount(review)}`);
    await this.send(`TEXT done Done:   ${formatCount(done)}`);
    await this.send('TEXT workersBox');
    await this.send(`TEXT workers workers\n${formatCount(workers)}`);
    await this.send('TEXT runsBox');
    await this.send(`TEXT active runs\n${formatCount(active)}`);
    await this.send(`COMMIT ${refreshType}`);
  }

  private async send(command: string): Promise<void> {
    const characteristic = this.characteristic;
    if (!characteristic) {
      throw new Error('Display is disconnected.');
    }

    await new Promise<void>((resolve, reject) => {
      characteristic.write(Buffer.from(command, 'ascii'), false, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

const FIELDS = [
  'todo 4 2 142 27 2 LEFT 0 0',
  'doing 4 31 142 27 2 LEFT 0 0',
  'review 4 60 142 27 2 LEFT 0 0',
  'done 4 89 142 27 2 LEFT 0 0',
  'workersBox 150 0 96 58 1 CENTER 1 0',
  'workers 151 1 94 44 2 CENTER 0 0',
  'runsBox 150 58 96 58 1 CENTER 1 0',
  'active 151 59 94 44 2 CENTER 0 0',
];

function waitForBluetooth(noble: Noble): Promise<void> {
  if (noble.state === 'poweredOn') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const onStateChange = (state: unknown) => {
      if (state !== 'poweredOn') {
        return;
      }
      noble.removeListener('stateChange', onStateChange);
      resolve();
    };
    noble.on('stateChange', onStateChange);
  });
}

function discover(noble: Noble, deviceName: string): Promise<BlePeripheral> {
  return new Promise((resolve, reject) => {
    const onDiscover = (candidate: unknown) => {
      const peripheral = candidate as BlePeripheral;
      if (peripheral.advertisement?.localName !== deviceName) {
        return;
      }
      finish();
      resolve(peripheral);
    };

    const timeout = setTimeout(() => {
      finish();
      reject(new Error(`Could not find ${deviceName}.`));
    }, 10_000);

    const finish = () => {
      clearTimeout(timeout);
      noble.removeListener('discover', onDiscover);
      noble.stopScanning(() => undefined);
    };

    noble.on('discover', onDiscover);
    noble.startScanning([], false, (error) => {
      if (!error) {
        return;
      }
      finish();
      reject(error);
    });
  });
}

function connect(peripheral: BlePeripheral): Promise<void> {
  return new Promise((resolve, reject) => {
    peripheral.connect((error) => (error ? reject(error) : resolve()));
  });
}

function getWriteCharacteristic(peripheral: BlePeripheral): Promise<BleCharacteristic> {
  return new Promise((resolve, reject) => {
    peripheral.discoverSomeServicesAndCharacteristics(
      [],
      [WRITE_CHARACTERISTIC],
      (error, _services, characteristics) => {
        if (error) {
          reject(error);
          return;
        }

        const characteristic = characteristics.find(
          (item) => item.uuid === WRITE_CHARACTERISTIC.replaceAll('-', ''),
        );
        if (!characteristic) {
          reject(new Error('Display write characteristic was not found.'));
          return;
        }
        resolve(characteristic);
      },
    );
  });
}

function waitForDisconnect(peripheral: BlePeripheral): Promise<void> {
  return new Promise((resolve) => peripheral.once('disconnect', resolve));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}
