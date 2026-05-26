import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import {
  App,
  Component,
  Platform
} from 'obsidian';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from '../plugin-settings-component.ts';
import { LongStackTracesComponent } from './long-stack-traces-component.ts';

const MockLongStackTracesDesktopComponent = vi.fn();

vi.mock('./long-stack-traces-desktop-component.ts', () => ({
  LongStackTracesDesktopComponent: MockLongStackTracesDesktopComponent
}));

interface CreateComponentResult {
  component: LongStackTracesComponent;
  pluginSettingsComponent: PluginSettingsComponent;
}

type EventCallback = (...args: unknown[]) => unknown;

function captureEventCallbacks(pluginSettingsComponent: PluginSettingsComponent): Map<string, EventCallback[]> {
  const captured = new Map<string, EventCallback[]>();

  const originalOn = (pluginSettingsComponent.on as (...args: unknown[]) => unknown).bind(pluginSettingsComponent);

  (vi.spyOn(pluginSettingsComponent, 'on') as ReturnType<typeof vi.fn>).mockImplementation((name: string, callback: EventCallback, ctx?: unknown) => {
    let callbacks = captured.get(name);
    if (!callbacks) {
      callbacks = [];
      captured.set(name, callbacks);
    }
    callbacks.push(callback);
    return originalOn(name, callback, ctx);
  });

  return captured;
}

function createComponent(): CreateComponentResult {
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler: createDataHandler(),
    pluginEventSource: createPluginEventSource()
  });
  const app = new App();
  const component = new LongStackTracesComponent({
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
  return strictProxy<PluginEventSource>({});
}

describe('LongStackTracesComponent', () => {
  let savedIsDesktop: boolean;

  beforeEach(() => {
    savedIsDesktop = Platform.isDesktop;
    MockLongStackTracesDesktopComponent.mockClear();
    MockLongStackTracesDesktopComponent.mockImplementation(() => {
      return new Component();
    });
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: savedIsDesktop });
    vi.restoreAllMocks();
  });

  it('should construct without errors', () => {
    const { component } = createComponent();

    expect(component).toBeInstanceOf(Component);
  });

  it('should dynamically import and add desktop child when Platform.isDesktop is true', async () => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: true });
    const { component } = createComponent();

    await component.onloadAsync();

    expect(MockLongStackTracesDesktopComponent).toHaveBeenCalledOnce();

    component.unload();
  });

  it('should skip desktop component when Platform.isDesktop is false', async () => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: false });
    const { component } = createComponent();

    await component.onloadAsync();

    expect(MockLongStackTracesDesktopComponent.mock.calls).toHaveLength(0);

    component.unload();
  });

  it('should reload when loadSettings event fires with non-initial load', async () => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: false });
    const { component, pluginSettingsComponent } = createComponent();
    const captured = captureEventCallbacks(pluginSettingsComponent);

    await component.onloadAsync();

    const loadSettingsCallbacks = captured.get('loadSettings');
    expect(loadSettingsCallbacks).toBeDefined();

    const unloadSpy = vi.spyOn(component, 'unload');
    const loadWithPromisesSpy = vi.spyOn(component, 'loadWithPromises').mockResolvedValue(undefined);

    for (const cb of loadSettingsCallbacks ?? []) {
      await cb({}, false);
    }

    expect(unloadSpy).toHaveBeenCalledOnce();
    expect(loadWithPromisesSpy).toHaveBeenCalledOnce();

    component.unload();
  });

  it('should not reload when loadSettings event fires with initial load', async () => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: false });
    const { component, pluginSettingsComponent } = createComponent();
    const captured = captureEventCallbacks(pluginSettingsComponent);

    await component.onloadAsync();

    const unloadSpy = vi.spyOn(component, 'unload');
    const loadSettingsCallbacks = captured.get('loadSettings');
    expect(loadSettingsCallbacks).toBeDefined();

    for (const cb of loadSettingsCallbacks ?? []) {
      await cb({}, true);
    }

    expect(unloadSpy).not.toHaveBeenCalled();

    component.unload();
  });

  it('should reload when saveSettings event fires', async () => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: false });
    const { component, pluginSettingsComponent } = createComponent();
    const captured = captureEventCallbacks(pluginSettingsComponent);

    await component.onloadAsync();

    const unloadSpy = vi.spyOn(component, 'unload');
    const loadWithPromisesSpy = vi.spyOn(component, 'loadWithPromises').mockResolvedValue(undefined);

    const saveSettingsCallbacks = captured.get('saveSettings');
    expect(saveSettingsCallbacks).toBeDefined();

    for (const cb of saveSettingsCallbacks ?? []) {
      await cb({}, {}, undefined);
    }

    expect(unloadSpy).toHaveBeenCalledOnce();
    expect(loadWithPromisesSpy).toHaveBeenCalledOnce();

    component.unload();
  });
});
