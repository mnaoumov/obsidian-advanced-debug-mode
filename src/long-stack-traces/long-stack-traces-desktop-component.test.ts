import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import { App } from 'obsidian';
import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { ensureGenericObject } from 'obsidian-dev-utils/type-guards';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from '../plugin-settings-component.ts';
import { PluginSettings } from '../plugin-settings.ts';
import { LongStackTracesDesktopComponent } from './long-stack-traces-desktop-component.ts';

interface CreateComponentResult {
  component: LongStackTracesDesktopComponent;
  pluginSettingsComponent: PluginSettingsComponent;
}

function createComponent(settingsOverrides?: Partial<PluginSettings>): CreateComponentResult {
  const pluginSettingsComponent = createSettingsComponent(settingsOverrides);
  const app = new App();
  const component = new LongStackTracesDesktopComponent({
    app,
    pluginId: 'test-plugin',
    pluginSettingsComponent
  });
  return { component, pluginSettingsComponent };
}

function createDataHandler(): DataHandler {
  return {
    loadData: vi.fn().mockResolvedValue(null),
    saveData: vi.fn().mockResolvedValue(undefined)
  };
}

function createPluginEventSource(): PluginEventSource {
  return strictProxy<PluginEventSource>({
    off: vi.fn(),
    offref: vi.fn(),
    on: vi.fn(() => castTo<ReturnType<PluginEventSource['on']>>({})),
    once: vi.fn(() => castTo<ReturnType<PluginEventSource['on']>>({}))
  });
}

function createSettingsComponent(overrides: Partial<PluginSettings> = {}): PluginSettingsComponent {
  const component = new PluginSettingsComponent({
    dataHandler: createDataHandler(),
    pluginEventSource: createPluginEventSource()
  });
  // Access the settings via the readonly getter, then apply overrides
  // We need to do this by creating a patched version
  // Since defaultSettings are frozen/readonly, we'll spy on the settings getter
  const originalSettings = { ...component.defaultSettings, ...overrides };
  vi.spyOn(component, 'settings', 'get').mockReturnValue(originalSettings);
  return component;
}

describe('LongStackTracesComponentDesktop', () => {
  let savedError: ErrorConstructor;

  beforeEach(() => {
    savedError = window.Error;
  });

  afterEach(() => {
    window.Error = savedError;
  });

  it('should construct without errors', () => {
    const { component } = createComponent();
    expect(component).toBeTruthy();
  });

  it('should throw when accessing OriginalError before load', () => {
    const { component } = createComponent();
    expect(() => component.OriginalError).toThrow('OriginalError is not set');
  });

  it('should not patch when shouldIncludeLongStackTraces is false', () => {
    const { component } = createComponent({ shouldIncludeLongStackTraces: false });

    component.load();

    // When disabled, OriginalError should not be set
    expect(() => component.OriginalError).toThrow('OriginalError is not set');

    component.unload();
  });

  it('should patch Error class on load when enabled', () => {
    const { component } = createComponent();
    const originalError = window.Error;

    component.load();

    expect(window.Error).not.toBe(originalError);

    component.unload();
  });

  it('should restore Error class on unload', () => {
    const { component } = createComponent();
    const originalError = window.Error;

    component.load();
    expect(window.Error).not.toBe(originalError);

    component.unload();
    expect(window.Error).toBe(originalError);
  });

  it('should set OriginalError on load', () => {
    const { component } = createComponent();
    const originalError = window.Error;

    component.load();

    expect(component.OriginalError).toBe(originalError);

    component.unload();
  });

  it('should create Error instances with modified stack traces', () => {
    const { component } = createComponent();
    component.load();

    const error = new Error('test');
    expect(error.message).toBe('test');
    expect(error.stack).toBeDefined();

    component.unload();
  });

  it('should handle Error called without new', () => {
    const { component } = createComponent();
    component.load();

    const error = Error('test without new');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('test without new');

    component.unload();
  });

  it('should handle Error with options', () => {
    const { component } = createComponent();
    component.load();

    const cause = new Error('root cause');
    const error = new Error('wrapper', { cause });
    expect(error.message).toBe('wrapper');
    expect(error.cause).toBe(cause);

    component.unload();
  });

  it('should apply stack trace limit', () => {
    const SMALL_LIMIT = 5;
    const { component } = createComponent({ stackTraceLimit: SMALL_LIMIT });
    component.load();

    const LINE_COUNT = 20;
    const lines = Array.from({ length: LINE_COUNT }, (_, i) => `    at fn${String(i)} (file.js:${String(i)}:0)`);
    component.applyStackTraceLimit(lines);

    expect(lines.length).toBe(SMALL_LIMIT + 1);
    expect(lines[SMALL_LIMIT]).toContain('STACK TRACE LIMIT REACHED');

    component.unload();
  });

  it('should not apply stack trace limit when lines are within limit', () => {
    const BIG_LIMIT = 100;
    const { component } = createComponent({ stackTraceLimit: BIG_LIMIT });
    component.load();

    const LINE_COUNT = 5;
    const lines = Array.from({ length: LINE_COUNT }, (_, i) => `    at fn${String(i)} (file.js:${String(i)}:0)`);
    component.applyStackTraceLimit(lines);

    expect(lines.length).toBe(LINE_COUNT);

    component.unload();
  });

  it('should add stack frames with deduplication', () => {
    const { component } = createComponent();
    component.load();

    const previousLines = ['    at fnA (a.js:1:0)', '    at fnB (b.js:2:0)'];
    const newLines = ['    at fnB (b.js:2:0)', '    at fnC (c.js:3:0)'];

    component.addStackFrame(previousLines, newLines, 'test frame');

    expect(previousLines).toContain('    at fnC (c.js:3:0)');
    expect(previousLines.some((l) => l.includes('test frame'))).toBe(true);

    component.unload();
  });

  it('should not add empty stack frames', () => {
    const { component } = createComponent();
    component.load();

    const previousLines = ['    at fnA (a.js:1:0)'];
    const originalLength = previousLines.length;

    component.addStackFrame(previousLines, ['    at fnA (a.js:1:0)'], 'test frame');

    expect(previousLines.length).toBe(originalLength);

    component.unload();
  });

  it('should filter internal stack frames when disabled', () => {
    const { component } = createComponent({
      shouldIncludeInternalStackFrames: false
    });
    component.load();

    const lines = [
      '    at userFn (user.js:1:0)',
      '    at internal (node:internal/something:1:0)',
      '    at Promise. (user.js:2:0)',
      '    at new Promise (<anonymous>)',
      '    at something (plugin:test-plugin:1:0)'
    ];

    component.adjustStackLines(lines, undefined, 0);

    expect(lines.some((l) => l.includes('node:internal'))).toBe(false);
    expect(lines.some((l) => l.includes('plugin:test-plugin'))).toBe(false);

    component.unload();
  });

  it('should keep internal stack frames when enabled', () => {
    const { component } = createComponent({
      shouldIncludeInternalStackFrames: true
    });
    component.load();

    const lines = [
      '    at userFn (user.js:1:0)',
      '    at internal (node:internal/something:1:0)'
    ];
    const originalLength = lines.length;

    component.adjustStackLines(lines, undefined, 0);

    expect(lines.length).toBe(originalLength);

    component.unload();
  });

  it('should adjust stack lines with parent stack frame', () => {
    const { component } = createComponent();
    component.load();

    const parentError = new component.OriginalError('parent');
    const parentStackFrame = {
      parentStackError: parentError,
      title: 'setTimeout'
    };

    const lines = ['    at currentFn (current.js:1:0)'];

    component.adjustStackLines(lines, parentStackFrame, 0);

    expect(lines.length).toBeGreaterThan(1);

    component.unload();
  });

  it('should set stack trace limit via property', () => {
    const { component } = createComponent();
    component.load();

    const NEW_LIMIT = 50;
    window.Error.stackTraceLimit = NEW_LIMIT;

    expect(component.OriginalError.stackTraceLimit).toBeGreaterThanOrEqual(NEW_LIMIT);

    component.unload();
  });

  it('should handle setting stack to custom value', () => {
    const { component } = createComponent();
    component.load();

    const error = new Error('test');
    const customStack = 'Custom stack trace';
    error.stack = customStack;
    expect(error.stack).toBe(customStack);

    component.unload();
  });

  it('should cache computed stack', () => {
    const { component } = createComponent();
    component.load();

    const error = new Error('test');
    const stack1 = error.stack;
    const stack2 = error.stack;
    expect(stack1).toBe(stack2);

    component.unload();
  });

  it('should patch child error classes', () => {
    const { component } = createComponent();
    const OriginalTypeError = window.TypeError;

    component.load();

    const error = new TypeError('type error test');
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toBe('type error test');
    expect(error.name).toBe('TypeError');

    component.unload();

    expect(window.TypeError).toBe(OriginalTypeError);
  });

  it('should handle TypeError called without new', () => {
    const { component } = createComponent();
    component.load();

    const error = TypeError('no new');
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toBe('no new');

    component.unload();
  });

  it('should restore child error classes on unload', () => {
    const { component } = createComponent();
    const OriginalRangeError = window.RangeError;

    component.load();
    component.unload();

    expect(window.RangeError).toBe(OriginalRangeError);
  });

  it('should set Error.stackTraceLimit based on settings', () => {
    const LIMIT = 200;
    const { component } = createComponent({ stackTraceLimit: LIMIT });

    component.load();

    expect(window.Error.stackTraceLimit).toBe(LIMIT);

    component.unload();
  });

  it('should handle stackTraceLimit of 0', () => {
    const { component } = createComponent({ stackTraceLimit: 0 });

    component.load();

    // StackTraceLimit getter returns the settings value
    expect(window.Error.stackTraceLimit).toBe(0);

    component.unload();
  });

  it('should remove consecutive stack frame titles', () => {
    const { component } = createComponent();
    component.load();

    const previousLines = ['    at fnA (a.js:1:0)'];
    const newLines = [
      '    at --- title1 --- (0)',
      '    at --- title2 --- (0)',
      '    at fnB (b.js:1:0)'
    ];

    component.addStackFrame(previousLines, newLines, 'outer');

    const nonTitleLines = previousLines.filter((l) => !l.includes('at ---'));
    expect(nonTitleLines.length).toBeGreaterThan(0);

    component.unload();
  });

  it('should wrap setTimeout callbacks with long stack traces', () => {
    const { component } = createComponent();
    component.load();

    return new Promise<void>((resolve) => {
      const callback = vi.fn(() => {
        resolve();
      });
      window.setTimeout(callback, 0);
    }).then(() => {
      component.unload();
    });
  });

  it('should wrap Promise.then callbacks', async () => {
    const { component } = createComponent();
    component.load();

    const result = await Promise.resolve('test').then((v) => `${v}-chained`);
    expect(result).toBe('test-chained');

    component.unload();
  });

  it('should wrap Promise.catch callbacks', async () => {
    const { component } = createComponent();
    component.load();

    const result = await Promise.reject(new Error('err')).catch((e: unknown) => (e as Error).message);
    expect(result).toBe('err');

    component.unload();
  });

  it('should wrap Promise.finally callbacks', async () => {
    const { component } = createComponent();
    component.load();

    let finallyCalled = false;
    await noopAsync().finally(() => {
      finallyCalled = true;
    });
    expect(finallyCalled).toBe(true);

    component.unload();
  });

  it('should wrap addEventListener and removeEventListener', () => {
    const { component } = createComponent();
    component.load();

    const listener = vi.fn();
    const target = new EventTarget();

    target.addEventListener('test', listener);
    target.dispatchEvent(new Event('test'));
    expect(listener).toHaveBeenCalledOnce();

    target.removeEventListener('test', listener);
    target.dispatchEvent(new Event('test'));
    expect(listener).toHaveBeenCalledOnce();

    component.unload();
  });

  it('should handle removeEventListener with null callback', () => {
    const { component } = createComponent();
    component.load();

    const target = new EventTarget();

    expect(() => {
      target.removeEventListener('test', null);
    }).not.toThrow();

    component.unload();
  });

  it('should handle EventListenerObject in addEventListener', () => {
    const { component } = createComponent();
    component.load();

    const handler = {
      handleEvent: vi.fn()
    };
    const target = new EventTarget();

    target.addEventListener('test', handler);
    target.dispatchEvent(new Event('test'));
    expect(handler.handleEvent).toHaveBeenCalledOnce();

    component.unload();
  });

  it('should handle EventListenerObject in removeEventListener without throwing', () => {
    const { component } = createComponent();
    component.load();

    const handler = {
      handleEvent: vi.fn()
    };
    const target = new EventTarget();

    target.addEventListener('test', handler);

    // RemoveEventListener with EventListenerObject exercises the
    // IsEventListenerObject branch in RemoveEventListenerPatchComponent
    expect(() => {
      target.removeEventListener('test', handler);
    }).not.toThrow();

    component.unload();
  });

  it('should save settings when stackTraceLimit is changed via setter', async () => {
    const { component, pluginSettingsComponent } = createComponent();
    // Load the settings component so the real editAndSave runs.
    // 70.0.0's editAndSave calls ensureLoaded() first and throws on an unloaded component.
    // The spy calls through to the real implementation, which invokes the editor callback.
    await pluginSettingsComponent.loadWithPromises();
    component.load();

    const editAndSaveSpy = vi.spyOn(pluginSettingsComponent, 'editAndSave');

    const NEW_LIMIT = 42;
    window.Error.stackTraceLimit = NEW_LIMIT;

    // EditAndSave should be called because the new limit differs from settings
    expect(editAndSaveSpy).toHaveBeenCalled();

    component.unload();
  });

  it('should not save settings when stackTraceLimit matches current setting', () => {
    const LIMIT = 100;
    const { component, pluginSettingsComponent } = createComponent({ stackTraceLimit: LIMIT });
    component.load();

    const editAndSaveSpy = vi.spyOn(pluginSettingsComponent, 'editAndSave').mockResolvedValue(undefined);

    window.Error.stackTraceLimit = LIMIT;

    expect(editAndSaveSpy).not.toHaveBeenCalled();

    component.unload();
  });

  it('should handle child error class whose base class is not yet patched', () => {
    const { component } = createComponent();

    // Create a custom error class that extends from a non-standard base
    class CustomBase extends Error {}
    class CustomChild extends CustomBase {}

    const windowWithErrors = ensureGenericObject(window);
    windowWithErrors['CustomChild'] = CustomChild;

    component.load();

    // CustomChild's base (CustomBase) is not in the originalPrototypeToPatchedClassMap
    // Because CustomBase itself is not a direct child of Error — it IS a child of Error
    // But the iteration processes children of Error. CustomBase will be patched first,
    // Then CustomChild's base prototype resolves to PatchedCustomBase.
    // This exercises the patchErrorClasses iteration.
    expect(window.Error).not.toBe(savedError);

    component.unload();

    delete windowWithErrors['CustomChild'];
  });

  it('should wrap setTimeout with string handler', () => {
    const { component } = createComponent();
    component.load();

    return new Promise<void>((resolve) => {
      window.setTimeout(castTo<() => void>('void 0'), 0);
      window.setTimeout(() => {
        resolve();
      }, 0);
    }).then(() => {
      component.unload();
    });
  });

  it('should remove previous wrapped handler when re-registering same listener', () => {
    const { component } = createComponent();
    component.load();

    const listener = vi.fn();
    const target = new EventTarget();

    // Register the same listener twice — the second registration should
    // Remove the previous wrapped handler via afterPatchAddEventListener
    target.addEventListener('test', listener);
    target.addEventListener('test', listener);

    target.dispatchEvent(new Event('test'));
    expect(listener).toHaveBeenCalledOnce();

    target.removeEventListener('test', listener);
    component.unload();
  });

  it('should use Infinity for stackTraceLimit when setting value is 0', () => {
    const { component } = createComponent({ stackTraceLimit: 0 });
    component.load();

    // When stackTraceLimit is 0 (falsy), the code uses Infinity
    // This is set in patchBaseErrorClass: window.Error.stackTraceLimit = settings.stackTraceLimit || Infinity
    expect(component.OriginalError.stackTraceLimit).toBe(Infinity);

    component.unload();
  });
});
