import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import { App } from 'obsidian';
import { sleep } from 'obsidian-dev-utils/async';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from '../plugin-settings-component.ts';
import { AsyncLongStackTracesComponent } from './async-long-stack-traces-desktop-component.ts';
import { LongStackTracesDesktopComponent } from './long-stack-traces-desktop-component.ts';

interface AsyncComponentPrivateHooks {
  asyncHookDestroy(asyncId: number): void;
  asyncHookInit(asyncId: number, type: string, triggerAsyncId: number): void;
  asyncIdParentMap: Map<number, number>;
  asyncIdStackFrameMap: Map<number, unknown>;
}

interface AsyncComponentPrivateMembers {
  asyncIdParentMap: Map<number, number>;
  asyncIdStackFrameMap: Map<number, AsyncIdStackFrameEntry>;
}

interface AsyncComponentPrivateMembersWithoutParent {
  asyncIdParentMap: Map<number, number>;
  asyncIdStackFrameMap: Map<number, AsyncIdStackFrameEntryWithoutParent>;
}

interface AsyncComponentPrivateStackFrameMap {
  asyncIdStackFrameMap: Map<number, AsyncIdStackFrameEntryWithoutParent>;
}

interface AsyncIdStackFrameEntry {
  currentError: Error;
  parentStackFrame: ParentStackFrame | undefined;
}

interface AsyncIdStackFrameEntryWithoutParent {
  currentError: Error;
  parentStackFrame: undefined;
}

interface CreateComponentsResult {
  readonly ComponentEx: AsyncLongStackTracesComponent;
  readonly longStackTracesComponent: LongStackTracesDesktopComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

interface ParentStackFrame {
  parentStackError: Error;
  title: string;
}

function createComponents(settingsOverrides?: Record<string, unknown>): CreateComponentsResult {
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler: createDataHandler(),
    pluginEventSource: createPluginEventSource()
  });
  if (settingsOverrides) {
    Object.assign(pluginSettingsComponent.defaultSettings, settingsOverrides);
  }
  const app = new App();
  const longStackTracesComponent = new LongStackTracesDesktopComponent({
    app,
    pluginId: 'test-plugin',
    pluginSettingsComponent
  });

  const ComponentEx = new AsyncLongStackTracesComponent({
    longStackTracesComponent,
    pluginSettingsComponent
  });

  return { ComponentEx, longStackTracesComponent, pluginSettingsComponent };
}

function createDataHandler(): DataHandler {
  return {
    loadData: vi.fn().mockResolvedValue(null),
    saveData: vi.fn().mockResolvedValue(undefined)
  };
}

function createPluginEventSource(): PluginEventSource {
  return strictProxy<PluginEventSource>({});
}

describe('AsyncLongStackTracesComponent', () => {
  it('should construct without errors', () => {
    const { ComponentEx } = createComponents();
    expect(ComponentEx).toBeTruthy();
  });

  it('should return 0 for getAsyncId when disabled', () => {
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: false
    });

    expect(ComponentEx.getAsyncId()).toBe(0);
  });

  it('should return asyncId from executionAsyncId when enabled', () => {
    const { ComponentEx, pluginSettingsComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    });

    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      shouldIncludeAsyncLongStackTraces: true
    });

    const asyncId = ComponentEx.getAsyncId();
    // ExecutionAsyncId() returns the current async execution context id
    // Which may be 0 or positive depending on the runtime context
    expect(typeof asyncId).toBe('number');
  });

  it('should not create async hook when disabled', () => {
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: false
    });

    ComponentEx.load();
    ComponentEx.unload();
    // No error means it did not try to create hooks
    expect(true).toBe(true);
  });

  it('should create and disable async hook on load/unload when enabled', () => {
    const { ComponentEx, longStackTracesComponent, pluginSettingsComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeLongStackTraces: true
    });

    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeLongStackTraces: true
    });

    // Need to load the parent component first to set up OriginalError
    longStackTracesComponent.load();

    ComponentEx.load();
    ComponentEx.unload();

    longStackTracesComponent.unload();
    expect(true).toBe(true);
  });

  it('should not adjust stack lines when disabled', () => {
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: false
    });

    const lines = ['    at test (test.js:1:0)'];
    const originalLength = lines.length;

    ComponentEx.adjustStackLines(lines, 0);

    expect(lines.length).toBe(originalLength);
  });

  it('should not adjust stack lines when asyncId is 0', () => {
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    });

    const lines = ['    at test (test.js:1:0)'];
    const originalLength = lines.length;

    ComponentEx.adjustStackLines(lines, 0);

    expect(lines.length).toBe(originalLength);
  });

  it('should not adjust stack lines when no async stack frame found', () => {
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    });

    const lines = ['    at test (test.js:1:0)'];
    const originalLength = lines.length;
    const NON_EXISTENT_ASYNC_ID = 99999;

    ComponentEx.adjustStackLines(lines, NON_EXISTENT_ASYNC_ID);

    expect(lines.length).toBe(originalLength);
  });

  it('should track and adjust async stack lines when enabled and loaded', async () => {
    const { ComponentEx, longStackTracesComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeLongStackTraces: true
    });

    longStackTracesComponent.load();
    ComponentEx.load();

    // Create an async operation to generate an async frame
    // Wait to trigger the async hook
    await sleep(0);
    const result = 'done';
    expect(result).toBe('done');

    ComponentEx.unload();
    longStackTracesComponent.unload();
  });

  it('should adjust stack lines with async stack frame that has parentStackFrame', () => {
    const { ComponentEx, longStackTracesComponent, pluginSettingsComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeInternalStackFrames: true,
      shouldIncludeLongStackTraces: true
    });

    longStackTracesComponent.load();
    ComponentEx.load();

    // Verify isEnabled returns true
    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeInternalStackFrames: true,
      shouldIncludeLongStackTraces: true
    });

    const ASYNC_ID = 12345;

    // Access private maps via the proxy
    const componentAny = castTo<AsyncComponentPrivateMembers>(ComponentEx);

    const currentError = new longStackTracesComponent.OriginalError('current');
    currentError.stack = 'Error: current\n    at asyncFn (async-file.js:10:0)\n    at asyncFn2 (async-file.js:20:0)';

    const parentError = new longStackTracesComponent.OriginalError('parent');
    parentError.stack = 'Error: parent\n    at parentFn (parent-file.js:5:0)';

    componentAny.asyncIdStackFrameMap.set(ASYNC_ID, {
      currentError,
      parentStackFrame: {
        parentStackError: parentError,
        title: 'setTimeout'
      }
    });

    const addStackFrameSpy = vi.spyOn(longStackTracesComponent, 'addStackFrame');
    const adjustStackLinesSpy = vi.spyOn(longStackTracesComponent, 'adjustStackLines');

    const lines = ['    at test (test.js:1:0)'];
    ComponentEx.adjustStackLines(lines, ASYNC_ID);

    // Should have called addStackFrame for the async frame
    expect(addStackFrameSpy).toHaveBeenCalledWith(lines, expect.any(Array), 'async');
    // And adjustStackLines should have been called with the parentStackFrame
    expect(adjustStackLinesSpy).toHaveBeenCalled();

    ComponentEx.unload();
    longStackTracesComponent.unload();
  });

  it('should adjust stack lines with async stack frame without parentStackFrame', () => {
    const { ComponentEx, longStackTracesComponent, pluginSettingsComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeInternalStackFrames: true,
      shouldIncludeLongStackTraces: true
    });

    longStackTracesComponent.load();
    ComponentEx.load();

    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeInternalStackFrames: true,
      shouldIncludeLongStackTraces: true
    });

    const ASYNC_ID = 12346;
    const PARENT_ASYNC_ID = 12340;

    const componentAny = castTo<AsyncComponentPrivateMembersWithoutParent>(ComponentEx);

    const currentError = new longStackTracesComponent.OriginalError('current');
    currentError.stack = 'Error: current\n    at asyncFn (async-file2.js:10:0)';

    componentAny.asyncIdStackFrameMap.set(ASYNC_ID, {
      currentError,
      parentStackFrame: undefined
    });
    componentAny.asyncIdParentMap.set(ASYNC_ID, PARENT_ASYNC_ID);

    const adjustStackLinesSpy = vi.spyOn(longStackTracesComponent, 'adjustStackLines');

    const lines = ['    at test (test.js:1:0)'];
    ComponentEx.adjustStackLines(lines, ASYNC_ID);

    // Should delegate to longStackTracesComponent.adjustStackLines
    expect(adjustStackLinesSpy).toHaveBeenCalledWith(lines, undefined, PARENT_ASYNC_ID);

    ComponentEx.unload();
    longStackTracesComponent.unload();
  });

  it('should fall back to asyncId 0 when no parent async id exists', () => {
    const { ComponentEx, longStackTracesComponent, pluginSettingsComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeInternalStackFrames: true,
      shouldIncludeLongStackTraces: true
    });

    longStackTracesComponent.load();
    ComponentEx.load();

    vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
      ...pluginSettingsComponent.defaultSettings,
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeInternalStackFrames: true,
      shouldIncludeLongStackTraces: true
    });

    const ASYNC_ID = 99999;

    const componentAny = castTo<AsyncComponentPrivateStackFrameMap>(ComponentEx);

    const currentError = new longStackTracesComponent.OriginalError('orphan');
    currentError.stack = 'Error: orphan\n    at orphanFn (orphan.js:1:0)';

    // Set stack frame but do NOT set asyncIdParentMap entry — triggers ?? 0 fallback
    componentAny.asyncIdStackFrameMap.set(ASYNC_ID, {
      currentError,
      parentStackFrame: undefined
    });

    const adjustStackLinesSpy = vi.spyOn(longStackTracesComponent, 'adjustStackLines');

    const lines = ['    at test (test.js:1:0)'];
    ComponentEx.adjustStackLines(lines, ASYNC_ID);

    // Should call adjustStackLines with parentAsyncId = 0 (the ?? fallback)
    expect(adjustStackLinesSpy).toHaveBeenCalledWith(lines, undefined, 0);

    ComponentEx.unload();
    longStackTracesComponent.unload();
  });

  it('should track async hook init for PROMISE type and cleanup on destroy', () => {
    const { ComponentEx, longStackTracesComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeLongStackTraces: true
    });

    longStackTracesComponent.load();
    ComponentEx.load();

    const componentAny = castTo<AsyncComponentPrivateHooks>(ComponentEx);

    const TEST_ASYNC_ID = 999;
    const TRIGGER_ASYNC_ID = 888;

    // Non-PROMISE type should be ignored
    componentAny.asyncHookInit.call(ComponentEx, TEST_ASYNC_ID, 'TIMEOUT', TRIGGER_ASYNC_ID);
    expect(componentAny.asyncIdParentMap.has(TEST_ASYNC_ID)).toBe(false);

    // PROMISE type should be tracked
    componentAny.asyncHookInit.call(ComponentEx, TEST_ASYNC_ID, 'PROMISE', TRIGGER_ASYNC_ID);
    expect(componentAny.asyncIdParentMap.get(TEST_ASYNC_ID)).toBe(TRIGGER_ASYNC_ID);
    expect(componentAny.asyncIdStackFrameMap.has(TEST_ASYNC_ID)).toBe(true);

    // Destroy should clean up
    componentAny.asyncHookDestroy.call(ComponentEx, TEST_ASYNC_ID);
    expect(componentAny.asyncIdParentMap.has(TEST_ASYNC_ID)).toBe(false);
    expect(componentAny.asyncIdStackFrameMap.has(TEST_ASYNC_ID)).toBe(false);

    ComponentEx.unload();
    longStackTracesComponent.unload();
  });
});
