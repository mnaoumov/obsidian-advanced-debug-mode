import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { HookCallbacks } from 'node:v8';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import process from 'node:process';
import { App } from 'obsidian';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PromiseHooks } from './desktop-async-long-stack-traces-component.ts';

import { PluginSettingsComponent } from '../plugin-settings-component.ts';
import { PluginSettings } from '../plugin-settings.ts';
import { AsyncLongStackTracesComponent } from './desktop-async-long-stack-traces-component.ts';
import { LongStackTracesDesktopComponent } from './desktop-long-stack-traces-component.ts';

interface AsyncComponentPrivateMembers {
  executingPromises: Promise<unknown>[];
  promiseHookAfter: (promise: Promise<unknown>) => void;
  promiseHookBefore: (promise: Promise<unknown>) => void;
  promiseHookInit: (promise: Promise<unknown>, parent: Promise<unknown> | undefined) => void;
  promiseStackFrameMap: WeakMap<Promise<unknown>, AsyncStackFrameEntry>;
}

interface AsyncStackFrameEntry {
  currentError: Error;
  parentPromise: Promise<unknown> | undefined;
  parentStackFrame: ParentStackFrame | undefined;
}

interface CreateComponentsResult {
  readonly ComponentEx: AsyncLongStackTracesComponent;
  readonly longStackTracesComponent: LongStackTracesDesktopComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

interface FakePromiseHooks {
  callbacks: HookCallbacks | undefined;
  readonly promiseHooks: PromiseHooks;
  readonly stop: () => void;
}

interface ParentStackFrame {
  parentStackError: Error;
  title: string;
}

const COMMAND_LINE_API_PROPERTY_NAME = '$_';

function createComponents(settingsOverrides?: Partial<PluginSettings>, componentPromiseHooks: PromiseHooks = createFakePromiseHooks().promiseHooks): CreateComponentsResult {
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler: createDataHandler(),
    pluginEventSource: createPluginEventSource()
  });
  vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
    ...pluginSettingsComponent.defaultSettings,
    ...settingsOverrides
  });
  const app = new App();
  const longStackTracesComponent = new LongStackTracesDesktopComponent({
    app,
    nodeProcess: process,
    pluginId: 'test-plugin',
    pluginSettingsComponent,
    promiseHooks: componentPromiseHooks
  });

  const ComponentEx = new AsyncLongStackTracesComponent({
    longStackTracesComponent,
    pluginSettingsComponent,
    promiseHooks: componentPromiseHooks
  });

  return { ComponentEx, longStackTracesComponent, pluginSettingsComponent };
}

function createDataHandler(): DataHandler {
  return {
    loadData: vi.fn().mockResolvedValue(null),
    saveData: vi.fn().mockResolvedValue(undefined)
  };
}
/**
 * The tests key on promise identity, so every call must return a new promise; `noopAsync()` returns one shared promise.
 *
 * @returns A new resolved promise.
 */
async function createDistinctPromise(): Promise<void> {
  await new Promise<void>((resolve) => {
    resolve();
  });
}

/**
 * Unit tests run in a VM context, and the real `v8.promiseHooks` see only the main context's promises, so the hooks
 * are captured and driven by hand. The desktop integration suite runs them against the real renderer.
 *
 * @returns The fake hooks, the callbacks the component registered, and the stop function it was given.
 */
function createFakePromiseHooks(): FakePromiseHooks {
  const result: FakePromiseHooks = {
    callbacks: undefined,
    promiseHooks: {
      createHook(callbacks: HookCallbacks): () => void {
        result.callbacks = callbacks;
        return result.stop;
      }
    },
    stop: vi.fn()
  };
  return result;
}

function createPluginEventSource(): PluginEventSource {
  return strictProxy<PluginEventSource>({});
}
describe('AsyncLongStackTracesComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should construct without errors', () => {
    const { ComponentEx } = createComponents();
    expect(ComponentEx).toBeTruthy();
  });

  it('should return undefined for getExecutingPromise when disabled', () => {
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: false
    });

    expect(ComponentEx.getExecutingPromise()).toBeUndefined();
  });

  it('should not create promise hooks when disabled', () => {
    const createHookSpy = vi.fn();
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: false
    }, { createHook: createHookSpy });

    ComponentEx.load();
    ComponentEx.unload();

    expect(createHookSpy).not.toHaveBeenCalled();
  });

  it('should create promise hooks on load and stop them on unload when enabled', () => {
    const stop = vi.fn();
    const createHookSpy = vi.fn().mockReturnValue(stop);
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    }, { createHook: createHookSpy });

    ComponentEx.load();
    expect(createHookSpy).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();

    ComponentEx.unload();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('should not adjust stack lines when disabled', () => {
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: false
    });

    const lines = ['    at test (test.js:1:0)'];

    ComponentEx.adjustStackLines(lines, createDistinctPromise());

    expect(lines).toHaveLength(1);
  });

  it('should not adjust stack lines when no promise is executing', () => {
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    });

    const lines = ['    at test (test.js:1:0)'];

    ComponentEx.adjustStackLines(lines, undefined);

    expect(lines).toHaveLength(1);
  });

  it('should not adjust stack lines when no async stack frame was recorded for the promise', () => {
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    });

    const lines = ['    at test (test.js:1:0)'];

    ComponentEx.adjustStackLines(lines, createDistinctPromise());

    expect(lines).toHaveLength(1);
  });

  it('should record a stack frame for each promise the registered init hook sees', () => {
    const fakePromiseHooks = createFakePromiseHooks();
    const { ComponentEx, longStackTracesComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeLongStackTraces: true
    }, fakePromiseHooks.promiseHooks);

    longStackTracesComponent.load();
    ComponentEx.load();

    const componentAny = castTo<AsyncComponentPrivateMembers>(ComponentEx);
    const promise = createDistinctPromise();
    const parent = createDistinctPromise();
    ensureNonNullable(fakePromiseHooks.callbacks?.init)(promise, parent);

    expect(componentAny.promiseStackFrameMap.get(promise)).toEqual({
      currentError: expect.any(longStackTracesComponent.OriginalError) as unknown,
      parentPromise: parent,
      parentStackFrame: undefined
    });

    ComponentEx.unload();
    longStackTracesComponent.unload();
  });

  it('should report the promise between the registered before and after hooks as the executing promise', () => {
    const fakePromiseHooks = createFakePromiseHooks();
    const { ComponentEx } = createComponents({
      shouldIncludeAsyncLongStackTraces: true
    }, fakePromiseHooks.promiseHooks);

    ComponentEx.load();

    const callbacks = ensureNonNullable(fakePromiseHooks.callbacks);
    const promise = createDistinctPromise();

    expect(ComponentEx.getExecutingPromise()).toBeUndefined();
    ensureNonNullable(callbacks.before)(promise);
    expect(ComponentEx.getExecutingPromise()).toBe(promise);
    ensureNonNullable(callbacks.after)(promise);
    expect(ComponentEx.getExecutingPromise()).toBeUndefined();

    ComponentEx.unload();
  });

  it('should link a promise to its parent, or else to the executing promise', () => {
    const { ComponentEx, longStackTracesComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeLongStackTraces: true
    });

    longStackTracesComponent.load();

    const componentAny = castTo<AsyncComponentPrivateMembers>(ComponentEx);
    const parent = createDistinctPromise();
    const executing = createDistinctPromise();
    const withParent = createDistinctPromise();
    const withoutParent = createDistinctPromise();

    componentAny.promiseHookBefore(executing);
    componentAny.promiseHookInit(withParent, parent);
    componentAny.promiseHookInit(withoutParent, undefined);
    componentAny.promiseHookAfter(executing);

    expect(componentAny.promiseStackFrameMap.get(withParent)?.parentPromise).toBe(parent);
    expect(componentAny.promiseStackFrameMap.get(withoutParent)?.parentPromise).toBe(executing);
    expect(componentAny.executingPromises).toHaveLength(0);

    longStackTracesComponent.unload();
  });

  it('should leave the executing promises alone when after fires for a promise that is not on top', () => {
    const { ComponentEx } = createComponents();

    const componentAny = castTo<AsyncComponentPrivateMembers>(ComponentEx);
    const executing = createDistinctPromise();

    componentAny.promiseHookBefore(executing);
    componentAny.promiseHookAfter(createDistinctPromise());

    expect(componentAny.executingPromises).toEqual([executing]);
  });

  it('should record nothing while a console evaluation is running', () => {
    const { ComponentEx, longStackTracesComponent } = createComponents({ shouldIncludeLongStackTraces: true });

    longStackTracesComponent.load();

    const componentAny = castTo<AsyncComponentPrivateMembers>(ComponentEx);
    const promise = createDistinctPromise();

    Object.defineProperty(window, COMMAND_LINE_API_PROPERTY_NAME, { configurable: true, value: undefined });
    try {
      componentAny.promiseHookBefore(promise);
      componentAny.promiseHookInit(promise, undefined);
    } finally {
      Reflect.deleteProperty(window, COMMAND_LINE_API_PROPERTY_NAME);
    }

    expect(componentAny.executingPromises).toHaveLength(0);
    expect(componentAny.promiseStackFrameMap.has(promise)).toBe(false);

    longStackTracesComponent.unload();
  });

  it('should adjust stack lines with async stack frame that has parentStackFrame', () => {
    const { ComponentEx, longStackTracesComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeInternalStackFrames: true,
      shouldIncludeLongStackTraces: true
    });

    longStackTracesComponent.load();

    const componentAny = castTo<AsyncComponentPrivateMembers>(ComponentEx);
    const promise = createDistinctPromise();

    const currentError = new longStackTracesComponent.OriginalError('current');
    currentError.stack = 'Error: current\n    at asyncFn (async-file.js:10:0)\n    at asyncFn2 (async-file.js:20:0)';

    const parentError = new longStackTracesComponent.OriginalError('parent');
    parentError.stack = 'Error: parent\n    at parentFn (parent-file.js:5:0)';

    const parentStackFrame = {
      parentStackError: parentError,
      title: 'setTimeout'
    };
    componentAny.promiseStackFrameMap.set(promise, {
      currentError,
      parentPromise: undefined,
      parentStackFrame
    });

    const addStackFrameSpy = vi.spyOn(longStackTracesComponent, 'addStackFrame');
    const adjustStackLinesSpy = vi.spyOn(longStackTracesComponent, 'adjustStackLines');

    const lines = ['    at test (test.js:1:0)'];
    ComponentEx.adjustStackLines(lines, promise);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any(Array) is an asymmetric matcher typed as `any`.
    expect(addStackFrameSpy).toHaveBeenCalledWith({ newLines: expect.any(Array), previousLines: lines, title: 'async' });
    expect(adjustStackLinesSpy).toHaveBeenCalledWith({ executingPromise: undefined, lines, parentStackFrame });

    longStackTracesComponent.unload();
  });

  it('should continue with the parent promise when the async stack frame has no parentStackFrame', () => {
    const { ComponentEx, longStackTracesComponent } = createComponents({
      shouldIncludeAsyncLongStackTraces: true,
      shouldIncludeInternalStackFrames: true,
      shouldIncludeLongStackTraces: true
    });

    longStackTracesComponent.load();

    const componentAny = castTo<AsyncComponentPrivateMembers>(ComponentEx);
    const promise = createDistinctPromise();
    const parentPromise = createDistinctPromise();

    const currentError = new longStackTracesComponent.OriginalError('current');
    currentError.stack = 'Error: current\n    at asyncFn (async-file2.js:10:0)';

    componentAny.promiseStackFrameMap.set(promise, {
      currentError,
      parentPromise,
      parentStackFrame: undefined
    });

    const adjustStackLinesSpy = vi.spyOn(longStackTracesComponent, 'adjustStackLines');

    const lines = ['    at test (test.js:1:0)'];
    ComponentEx.adjustStackLines(lines, promise);

    expect(adjustStackLinesSpy).toHaveBeenCalledWith({ executingPromise: parentPromise, lines, parentStackFrame: undefined });

    longStackTracesComponent.unload();
  });
});
