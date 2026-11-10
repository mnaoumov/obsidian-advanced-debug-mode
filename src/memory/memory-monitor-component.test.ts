import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';

import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  App,
  Component,
  Platform
} from 'obsidian';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';
import { MemoryMonitorComponent } from './memory-monitor-component.ts';

const MockDesktopMemoryMonitorComponent = vi.fn();
const mockOpen = vi.fn();

vi.mock('./desktop-memory-monitor-component.ts', () => ({
  DesktopMemoryMonitorComponent: MockDesktopMemoryMonitorComponent
}));

vi.mock('./memory-history-modal.ts', () => ({
  MemoryHistoryModal: class MockMemoryHistoryModal {
    public open(): void {
      mockOpen();
    }
  }
}));

interface CapturedParams {
  readonly defaultDiagnosticsFolder: string;
  readonly getResidentSetSizeInBytes: () => number;
  readonly now: () => number;
  readonly onStatusBarClick: () => void;
}

interface CreateComponentResult {
  readonly component: MemoryMonitorComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

type EventCallback = (...$arguments: unknown[]) => unknown;

function captureEventCallbacks(pluginSettingsComponent: PluginSettingsComponent): Map<string, EventCallback[]> {
  const captured = new Map<string, EventCallback[]>();
  const originalOn = (pluginSettingsComponent.on as (...$arguments: unknown[]) => unknown).bind(pluginSettingsComponent);
  (vi.spyOn(pluginSettingsComponent, 'on') as ReturnType<typeof vi.fn>).mockImplementation((name: string, callback: EventCallback, context?: unknown) => {
    const callbacks = captured.get(name) ?? [];
    callbacks.push(callback);
    captured.set(name, callbacks);
    return originalOn(name, callback, context);
  });
  return captured;
}

function createComponent(vaultName = 'My: Vault'): CreateComponentResult {
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler: { loadData: vi.fn().mockResolvedValue(null), saveData: vi.fn().mockResolvedValue(undefined) },
    pluginEventSource: strictProxy<PluginEventSource>({})
  });
  const app = new App();
  vi.spyOn(app.vault, 'getName').mockReturnValue(vaultName);
  const component = new MemoryMonitorComponent({
    addStatusBarItem: (): HTMLElement => createDiv(),
    app,
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({}),
    pluginSettingsComponent
  });
  return { component, pluginSettingsComponent };
}

describe('MemoryMonitorComponent', () => {
  let isSavedIsDesktop: boolean;

  beforeEach(() => {
    isSavedIsDesktop = Platform.isDesktop;
    MockDesktopMemoryMonitorComponent.mockClear();
    // A function declaration, not an arrow: the facade calls it with `new`.
    MockDesktopMemoryMonitorComponent.mockImplementation(mockComponent);
    mockOpen.mockClear();

    function mockComponent(): Component {
      return new Component();
    }
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: isSavedIsDesktop });
    vi.restoreAllMocks();
  });

  it('should add the desktop part on desktop, with a per-vault folder under the temp folder', async () => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: true });
    const { component } = createComponent();

    await component.loadWithPromises();

    expect(MockDesktopMemoryMonitorComponent).toHaveBeenCalledOnce();
    const params = MockDesktopMemoryMonitorComponent.mock.calls[0]?.[0] as CapturedParams;
    expect(params.defaultDiagnosticsFolder).toBe(join(tmpdir(), 'obsidian-advanced-debug-mode', 'My_ Vault'));
    expect(params.getResidentSetSizeInBytes()).toBeGreaterThan(0);
    expect(params.now()).toBeGreaterThan(0);
    expect(component.getDesktopComponent()).not.toBeNull();

    params.onStatusBarClick();
    expect(mockOpen).toHaveBeenCalledOnce();

    component.unload();
    expect(component.getDesktopComponent()).toBeNull();
  });

  it('should have no desktop part on mobile, and open no history', async () => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: false });
    const { component } = createComponent();

    await component.onloadAsync();
    component.openHistory();

    expect(MockDesktopMemoryMonitorComponent).not.toHaveBeenCalled();
    expect(component.getDesktopComponent()).toBeNull();
    expect(mockOpen).not.toHaveBeenCalled();
    component.unload();
  });

  it('should reload on a settings save and a later settings load, but not the initial one', async () => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: false });
    const { component, pluginSettingsComponent } = createComponent();
    const captured = captureEventCallbacks(pluginSettingsComponent);
    await component.onloadAsync();
    const unloadSpy = vi.spyOn(component, 'unload');
    const loadWithPromisesSpy = vi.spyOn(component, 'loadWithPromises').mockResolvedValue(undefined);

    for (const callback of captured.get('loadSettings') ?? []) {
      await callback({}, true);
    }
    expect(unloadSpy).not.toHaveBeenCalled();

    for (const callback of captured.get('loadSettings') ?? []) {
      await callback({}, false);
    }
    for (const callback of captured.get('saveSettings') ?? []) {
      await callback({}, {}, undefined);
    }
    expect(unloadSpy).toHaveBeenCalledTimes(2);
    expect(loadWithPromisesSpy).toHaveBeenCalledTimes(2);
    component.unload();
  });

  it('should make the vault name safe as a folder name', async () => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: true });
    for (const [vaultName, folderName] of [['a<b>c:d"e/f\\g|h?i*j', 'a_b_c_d_e_f_g_h_i_j'], ['', 'vault']] as const) {
      MockDesktopMemoryMonitorComponent.mockClear();
      const { component } = createComponent(vaultName);
      await component.loadWithPromises();
      const params = MockDesktopMemoryMonitorComponent.mock.calls[0]?.[0] as CapturedParams;
      expect(params.defaultDiagnosticsFolder).toBe(join(tmpdir(), 'obsidian-advanced-debug-mode', folderName));
      component.unload();
    }
  });
});
