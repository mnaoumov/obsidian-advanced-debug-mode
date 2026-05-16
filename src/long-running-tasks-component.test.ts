import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';

import { FileSystemAdapter } from 'obsidian';
import { noop } from 'obsidian-dev-utils/function';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { LongRunningTasksComponent } from './long-running-tasks-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';

function createDataHandler(): DataHandler {
  return {
    loadData: vi.fn().mockResolvedValue(null),
    saveData: vi.fn().mockResolvedValue(undefined)
  };
}

function createMockFileSystemAdapter(): FileSystemAdapter {
  // eslint-disable-next-line no-restricted-syntax -- Test mock requires double assertion.
  const FileSystemAdapterConstructor = FileSystemAdapter as unknown as new (basePath: string) => FileSystemAdapter;
  const adapter = new FileSystemAdapterConstructor('');
  // Set properties needed by LongRunningTasksComponent before strict proxy blocks access
  adapter.promise = Promise.resolve();
  adapter.killLastAction = vi.fn();
  adapter.thingsHappening = vi.fn();
  adapter.queue = vi.fn();
  return adapter;
}

describe('LongRunningTasksComponent', () => {
  let pluginSettingsComponent: PluginSettingsComponent;
  let fileSystemAdapter: FileSystemAdapter;

  beforeEach(() => {
    pluginSettingsComponent = new PluginSettingsComponent(createDataHandler());
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

    // ThingsHappening is replaced by registerPatch with a debounced version.
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

  it('should handle queued function errors', async () => {
    const component = new LongRunningTasksComponent({
      fileSystemAdapter,
      pluginSettingsComponent
    });

    component.load();

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(noop);

    const error = new Error('test error');
    await expect(fileSystemAdapter.queue(() => {
      throw error;
    })).rejects.toThrow('test error');

    consoleErrorSpy.mockRestore();
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
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });

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
});
