import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  PluginLoadDelayMode,
  PluginSettings
} from '../settings/plugin-settings.ts';
import {
  busyWait,
  delay,
  formatPluginLoadDelays,
  getPluginLoadDelayInMilliseconds,
  isValidDelay,
  parsePluginLoadDelays
} from './plugin-load-delays.ts';

const DEFAULT_DELAY = 100;
const JITTER = 50;
const OWN_DELAY = 300;

function createSettings(): PluginSettings {
  const settings = new PluginSettings();
  settings.defaultPluginLoadDelayInMilliseconds = DEFAULT_DELAY;
  settings.pluginLoadDelayJitterInMilliseconds = JITTER;
  settings.pluginLoadDelaysInMilliseconds = { 'plugin-own': OWN_DELAY, 'plugin-skipped': 0 };
  return settings;
}

describe('busyWait', () => {
  it('should spin until the clock passes the end', () => {
    const BUSY_WAIT_MS = 3;
    let time = 0;
    const now = vi.fn(() => time++);

    busyWait(BUSY_WAIT_MS, now);

    // One read for the end (0 + 3), then reads at 1 and 2 that keep spinning, and the read at 3 that ends it.
    expect(now).toHaveBeenCalledTimes(BUSY_WAIT_MS + 1);
  });
});

describe('delay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should sleep in the async mode', async () => {
    vi.useFakeTimers();
    const SLEEP_MS = 1000;
    let isDone = false;
    const promise = delay(PluginLoadDelayMode.Async, SLEEP_MS).then(() => {
      isDone = true;
    });

    await vi.advanceTimersByTimeAsync(SLEEP_MS - 1);
    expect(isDone).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(isDone).toBe(true);
  });

  it('should block in the sync mode', async () => {
    const BLOCK_MS = 20;
    const start = performance.now();
    await delay(PluginLoadDelayMode.Sync, BLOCK_MS);
    expect(performance.now() - start).toBeGreaterThanOrEqual(BLOCK_MS);
  });
});

describe('getPluginLoadDelayInMilliseconds', () => {
  it('should use the plugin\'s own delay over the default, plus the jitter', () => {
    const settings = createSettings();
    expect(getPluginLoadDelayInMilliseconds({ pluginId: 'plugin-own', random: () => 1, settings })).toBe(OWN_DELAY + JITTER);
    expect(getPluginLoadDelayInMilliseconds({ pluginId: 'plugin-other', random: () => 0, settings })).toBe(DEFAULT_DELAY);
  });

  it('should leave a plugin given 0 alone, jitter or not', () => {
    const settings = createSettings();
    expect(getPluginLoadDelayInMilliseconds({ pluginId: 'plugin-skipped', random: () => 1, settings })).toBe(0);
  });

  it('should treat a missing entry value as 0', () => {
    const settings = createSettings();
    settings.pluginLoadDelaysInMilliseconds = { 'plugin-own': castTo<number>(undefined) };
    expect(getPluginLoadDelayInMilliseconds({ pluginId: 'plugin-own', random: () => 1, settings })).toBe(0);
  });
});

describe('isValidDelay', () => {
  it('should accept whole numbers of 0 or more only', () => {
    const FRACTION = 0.5;
    expect(isValidDelay(0)).toBe(true);
    expect(isValidDelay(DEFAULT_DELAY)).toBe(true);
    expect(isValidDelay(-1)).toBe(false);
    expect(isValidDelay(FRACTION)).toBe(false);
    expect(isValidDelay('1')).toBe(false);
  });
});

describe('parsePluginLoadDelays and formatPluginLoadDelays', () => {
  it('should round-trip the delays', () => {
    const delays = { 'plugin-a': DEFAULT_DELAY, 'plugin-b': 0 };
    const text = formatPluginLoadDelays(delays);
    expect(text).toBe('plugin-a: 100\nplugin-b: 0');
    expect(parsePluginLoadDelays(text)).toEqual(delays);
  });

  it('should skip blank lines and trim spaces', () => {
    expect(parsePluginLoadDelays('\n  plugin-a :  5  \n\n')).toEqual({ 'plugin-a': 5 });
  });

  it('should name the first bad line', () => {
    expect(parsePluginLoadDelays('plugin-a: 5\nplugin-b: -1')).toEqual({
      validationMessage: 'Expected "<plugin-id>: <milliseconds>", got "plugin-b: -1"'
    });
    expect(parsePluginLoadDelays('plugin-a')).toEqual({
      validationMessage: 'Expected "<plugin-id>: <milliseconds>", got "plugin-a"'
    });
    expect(parsePluginLoadDelays('plugin-a: 99999999999999999999')).toEqual({
      validationMessage: 'Expected "<plugin-id>: <milliseconds>", got "plugin-a: 99999999999999999999"'
    });
  });
});
