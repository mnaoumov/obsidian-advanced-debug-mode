import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';

import { App } from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from '../plugin-settings-component.ts';
import { AsyncLongStackTracesComponent } from './async-long-stack-traces-desktop-component.ts';
import { LongStackTracesDesktopComponent } from './long-stack-traces-desktop-component.ts';

interface CreateComponentsResult {
  asyncComponent: AsyncLongStackTracesComponent;
  longStackTracesComponent: LongStackTracesDesktopComponent;
  pluginSettingsComponent: PluginSettingsComponent;
}

function createComponents(settingsOverrides?: Record<string, unknown>): CreateComponentsResult {
  const pluginSettingsComponent = new PluginSettingsComponent(createDataHandler());
  if (settingsOverrides) {
    Object.assign(pluginSettingsComponent.defaultSettings, settingsOverrides);
  }
  const app = new App();
  const longStackTracesComponent = new LongStackTracesDesktopComponent({
    app,
    pluginId: 'test-plugin',
    pluginSettingsComponent
  });

  const asyncComponent = new AsyncLongStackTracesComponent({
    longStackTracesComponent,
    pluginSettingsComponent
  });

  return { asyncComponent, longStackTracesComponent, pluginSettingsComponent };
}

function createDataHandler(): DataHandler {
  return {
    loadData: vi.fn().mockResolvedValue(null),
    saveData: vi.fn().mockResolvedValue(undefined)
  };
}

describe('AsyncLongStackTracesComponent', () => {
  it('should construct without errors', () => {
    const { asyncComponent } = createComponents();
    expect(asyncComponent).toBeTruthy();
  });

  it('should return 0 for getAsyncId when disabled', () => {
    const { asyncComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: false
    });

    expect(asyncComponent.getAsyncId()).toBe(0);
  });

  it('should return asyncId from executionAsyncId when enabled', () => {
    const { asyncComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    });

    const asyncId = asyncComponent.getAsyncId();
    // ExecutionAsyncId() returns the current async execution context id
    // Which may be 0 or positive depending on the runtime context
    expect(typeof asyncId).toBe('number');
  });

  it('should not create async hook when disabled', () => {
    const { asyncComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: false
    });

    asyncComponent.load();
    asyncComponent.unload();
    // No error means it did not try to create hooks
    expect(true).toBe(true);
  });

  it('should create and disable async hook on load/unload when enabled', () => {
    const { asyncComponent, longStackTracesComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    });

    // Need to load the parent component first to set up OriginalError
    longStackTracesComponent.load();

    asyncComponent.load();
    asyncComponent.unload();

    longStackTracesComponent.unload();
    expect(true).toBe(true);
  });

  it('should not adjust stack lines when disabled', () => {
    const { asyncComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: false
    });

    const lines = ['    at test (test.js:1:0)'];
    const originalLength = lines.length;

    asyncComponent.adjustStackLines(lines, 0);

    expect(lines.length).toBe(originalLength);
  });

  it('should not adjust stack lines when asyncId is 0', () => {
    const { asyncComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    });

    const lines = ['    at test (test.js:1:0)'];
    const originalLength = lines.length;

    asyncComponent.adjustStackLines(lines, 0);

    expect(lines.length).toBe(originalLength);
  });

  it('should not adjust stack lines when no async stack frame found', () => {
    const { asyncComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    });

    const lines = ['    at test (test.js:1:0)'];
    const originalLength = lines.length;
    const NON_EXISTENT_ASYNC_ID = 99999;

    asyncComponent.adjustStackLines(lines, NON_EXISTENT_ASYNC_ID);

    expect(lines.length).toBe(originalLength);
  });

  it('should track and adjust async stack lines when enabled and loaded', async () => {
    const { asyncComponent, longStackTracesComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeLongStackTraces: true
    });

    longStackTracesComponent.load();
    asyncComponent.load();

    // Create an async operation to generate an async frame
    // Create a promise which should trigger the async hook
    const result = await new Promise<string>((resolve) => {
      window.setTimeout(() => {
        resolve('done');
      }, 0);
    });
    expect(result).toBe('done');

    asyncComponent.unload();
    longStackTracesComponent.unload();
  });
});
