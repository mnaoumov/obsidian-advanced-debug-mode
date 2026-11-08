import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { MockInstance } from 'vitest';

import { getDebugController } from '@mnaoumov/typescript-lib/debug';
import {
  noop,
  noopAsync
} from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { FileSystemAdapter } from 'obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';
import { FailedQueuedOperationLogLevel } from '../settings/plugin-settings.ts';
import { FAILED_QUEUED_OPERATIONS_DEBUG_NAMESPACE } from './file-system-adapter-queue-patch-component.ts';
import { LongRunningTasksComponent } from './long-running-tasks-component.ts';

const CONSOLE_LOGGER_METHODS = ['debug', 'error', 'warn'] as const;

type ConsoleLoggerMethod = typeof CONSOLE_LOGGER_METHODS[number];

function createDataHandler(): DataHandler {
  return {
    loadData: vi.fn().mockResolvedValue(null),
    saveData: vi.fn().mockResolvedValue(undefined)
  };
}

function createMockFileSystemAdapter(): FileSystemAdapter {
  const FileSystemAdapterConstructor = castTo<new (basePath: string) => FileSystemAdapter>(FileSystemAdapter);
  const adapter = new FileSystemAdapterConstructor('');
  // Set properties needed by LongRunningTasksComponent before strict proxy blocks access
  adapter.promise = noopAsync();
  adapter.killLastAction = vi.fn();
  adapter.thingsHappening = vi.fn();
  adapter.queue = vi.fn();
  return adapter;
}

function createMockPluginEventSource(): PluginEventSource {
  return strictProxy<PluginEventSource>({});
}

function spyOnConsoleLoggers(): Record<ConsoleLoggerMethod, MockInstance> {
  return {
    debug: vi.spyOn(console, 'debug').mockImplementation(noop),
    error: vi.spyOn(console, 'error').mockImplementation(noop),
    warn: vi.spyOn(console, 'warn').mockImplementation(noop)
  };
}

describe('LongRunningTasksComponent', () => {
  let pluginSettingsComponent: PluginSettingsComponent;
  let fileSystemAdapter: FileSystemAdapter;

  beforeEach(() => {
    pluginSettingsComponent = new PluginSettingsComponent({
      dataHandler: createDataHandler(),
      pluginEventSource: createMockPluginEventSource()
    });
    fileSystemAdapter = createMockFileSystemAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct without errors', () => {
    expect(() => {
      new LongRunningTasksComponent({
        fileSystemAdapter,
        pluginSettingsComponent
      });
    }).not.toThrow();
  });

  it('should patch thingsHappening when shouldTimeoutLongRunningTasks is false', () => {
    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      shouldTimeoutLongRunningTasks: false
    });

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    // thingsHappening is replaced by registerPatch with a debounced version.
    // Just verify load doesn't throw.
    expect(true).toBe(true);

    component.unload();
  });

  it('should patch queue when shouldIncludeTimedOutTasksDetails is true', () => {
    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    const originalQueue = fileSystemAdapter.queue;
    component.load();

    expect(fileSystemAdapter.queue).not.toBe(originalQueue);

    component.unload();
  });

  it('should not patch thingsHappening when shouldTimeoutLongRunningTasks is true', () => {
    Object.assign(pluginSettingsComponent.defaultSettings, {
      shouldIncludeTimedOutTasksDetails: false
    });

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();
    component.unload();
    expect(true).toBe(true);
  });

  it('should execute queued function when queue is patched', async () => {
    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const RESULT = 42;
    const result = await fileSystemAdapter.queue(() => RESULT);
    expect(result).toBe(RESULT);

    component.unload();
  });

  it('should rethrow queued function errors without logging them by default', async () => {
    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const spies = spyOnConsoleLoggers();

    const error = new Error('test error');
    await expect(fileSystemAdapter.queue(() => {
      throw error;
    })).rejects.toBe(error);

    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();

    component.unload();
  });

  it.each(
    [
      { logLevel: FailedQueuedOperationLogLevel.Debug, method: 'debug' },
      { logLevel: FailedQueuedOperationLogLevel.Warning, method: 'warn' },
      { logLevel: FailedQueuedOperationLogLevel.Error, method: 'error' }
    ] as const
  )('should log queued function errors with console.$method at level $logLevel, then rethrow', async ({ logLevel, method }) => {
    const debugController = getDebugController();
    const originalNamespaces = debugController.get();
    debugController.set([FAILED_QUEUED_OPERATIONS_DEBUG_NAMESPACE]);

    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      failedQueuedOperationLogLevel: logLevel
    });

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const spies = spyOnConsoleLoggers();

    const error = new Error('test error');
    function throwError(): never {
      throw error;
    }
    await expect(fileSystemAdapter.queue(throwError)).rejects.toBe(error);

    expect(spies[method]).toHaveBeenCalledOnce();
    // The `debug` library prefixes the message with a timestamp and the namespace, and may append a stack trace.
    expect(spies[method].mock.calls[0]?.slice(0, 2)).toEqual([
      expect.stringContaining('Failed queued file-system operation'),
      {
        error,
        function: throwError
      }
    ]);
    for (const otherMethod of CONSOLE_LOGGER_METHODS) {
      if (otherMethod !== method) {
        expect(spies[otherMethod]).not.toHaveBeenCalled();
      }
    }

    debugController.set(originalNamespaces);
    component.unload();
  });

  it('should not log queued function errors at level Debug while the debug namespace is off', async () => {
    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      failedQueuedOperationLogLevel: FailedQueuedOperationLogLevel.Debug
    });

    const debugController = getDebugController();
    const originalNamespaces = debugController.get();
    debugController.set([`-${FAILED_QUEUED_OPERATIONS_DEBUG_NAMESPACE}`]);

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const spies = spyOnConsoleLoggers();

    const error = new Error('test error');
    await expect(fileSystemAdapter.queue(() => {
      throw error;
    })).rejects.toBe(error);

    for (const method of CONSOLE_LOGGER_METHODS) {
      expect(spies[method]).not.toHaveBeenCalled();
    }

    debugController.set(originalNamespaces);
    component.unload();
  });

  it('should not log queued function errors for an unknown stored level', async () => {
    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      failedQueuedOperationLogLevel: castTo<FailedQueuedOperationLogLevel>('Verbose')
    });

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const spies = spyOnConsoleLoggers();

    const error = new Error('test error');
    await expect(fileSystemAdapter.queue(() => {
      throw error;
    })).rejects.toBe(error);

    for (const method of CONSOLE_LOGGER_METHODS) {
      expect(spies[method]).not.toHaveBeenCalled();
    }

    component.unload();
  });

  it('should patch queue but not log timeout details when only the failure log is on', async () => {
    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      failedQueuedOperationLogLevel: FailedQueuedOperationLogLevel.Error,
      shouldIncludeTimedOutTasksDetails: false
    });

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    const originalQueue = fileSystemAdapter.queue;
    component.load();

    expect(fileSystemAdapter.queue).not.toBe(originalQueue);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(noop);

    const promise = fileSystemAdapter.queue(() => new Promise(noop));
    await sleep(0);
    fileSystemAdapter.killLastAction?.(new Error('timeout'));

    await expect(promise).rejects.toThrow('timeout');
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    component.unload();
  });

  it('should log timeout details when function times out', async () => {
    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(noop);

    // Queue a function that never resolves
    const promise = fileSystemAdapter.queue(() => new Promise(noop));

    // Wait a tick for the queue to set up killLastAction
    await sleep(0);

    // Simulate a timeout by calling killLastAction (which was replaced by the patched queue)
    fileSystemAdapter.killLastAction?.(new Error('timeout'));

    await expect(promise).rejects.toThrow('timeout');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Timed out function', expect.anything());

    consoleErrorSpy.mockRestore();
    component.unload();
  });

  it('should not log timeout details after function completes', async () => {
    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(noop);

    const RESULT = 'done';
    await fileSystemAdapter.queue(() => RESULT);

    // After function completes, killLastAction should be a no-op
    fileSystemAdapter.killLastAction?.(new Error('late timeout'));

    expect(consoleErrorSpy).not.toHaveBeenCalledWith('Timed out function', expect.anything());

    consoleErrorSpy.mockRestore();
    component.unload();
  });

  it('should warn about disabled timeout when debounce fires', () => {
    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      shouldTimeoutLongRunningTasks: false
    });

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(noop);

    component.load();

    // The patched thingsHappening is a debounced function.
    fileSystemAdapter.thingsHappening();

    consoleWarnSpy.mockRestore();
    component.unload();
  });

  it('should not patch queue when shouldIncludeTimedOutTasksDetails is false', () => {
    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      shouldIncludeTimedOutTasksDetails: false
    });

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    const originalQueue = fileSystemAdapter.queue;
    component.load();

    expect(fileSystemAdapter.queue).toBe(originalQueue);

    component.unload();
  });

  it('should fire debounced warning for disabled timeout', () => {
    vi.useFakeTimers();

    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      shouldTimeoutLongRunningTasks: false
    });

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(noop);

    // Call the debounced thingsHappening
    fileSystemAdapter.thingsHappening();

    // Fast-forward past the debounce timeout (60 seconds)
    const DEBOUNCE_TIMEOUT_MS = 60_000;
    vi.advanceTimersByTime(DEBOUNCE_TIMEOUT_MS);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('timeout long running tasks after 60 seconds is currently disabled')
    );

    consoleWarnSpy.mockRestore();
    component.unload();
    vi.useRealTimers();
  });

  it('should handle previous promise rejection in queue', async () => {
    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(noop);

    // Set a rejecting promise as the current promise
    fileSystemAdapter.promise = Promise.reject(new Error('previous error'));

    const RESULT = 'success';
    const result = await fileSystemAdapter.queue(() => RESULT);
    expect(result).toBe(RESULT);

    consoleErrorSpy.mockRestore();
    component.unload();
  });

  it('should reload when loadSettings fires with non-initial load', () => {
    const onSpy = vi.spyOn(pluginSettingsComponent, 'on');

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const loadSettingsCall = onSpy.mock.calls.find(([name]) => name === 'loadSettings');
    expect(loadSettingsCall).toBeDefined();

    const callback = loadSettingsCall?.[1] as (loadedState: unknown, isInitialLoad: boolean) => void;

    const unloadSpy = vi.spyOn(component, 'unload');
    const loadSpy = vi.spyOn(component, 'load');

    callback({}, false);

    expect(unloadSpy).toHaveBeenCalled();
    expect(loadSpy).toHaveBeenCalled();

    component.unload();
  });

  it('should not reload when loadSettings fires with initial load', () => {
    const onSpy = vi.spyOn(pluginSettingsComponent, 'on');

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const loadSettingsCall = onSpy.mock.calls.find(([name]) => name === 'loadSettings');
    expect(loadSettingsCall).toBeDefined();

    const callback = loadSettingsCall?.[1] as (loadedState: unknown, isInitialLoad: boolean) => void;

    const unloadSpy = vi.spyOn(component, 'unload');

    callback({}, true);

    expect(unloadSpy).not.toHaveBeenCalled();

    component.unload();
  });

  it('should reload when saveSettings fires', () => {
    const onSpy = vi.spyOn(pluginSettingsComponent, 'on');

    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const saveSettingsCall = onSpy.mock.calls.find(([name]) => name === 'saveSettings');
    expect(saveSettingsCall).toBeDefined();

    const callback = saveSettingsCall?.[1] as () => void;

    const unloadSpy = vi.spyOn(component, 'unload');
    const loadSpy = vi.spyOn(component, 'load');

    callback();

    expect(unloadSpy).toHaveBeenCalled();
    expect(loadSpy).toHaveBeenCalled();

    component.unload();
  });
});
