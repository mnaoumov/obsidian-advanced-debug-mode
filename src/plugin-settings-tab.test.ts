// eslint-disable-next-line @eslint-community/eslint-comments/disable-enable-pair -- Entire file needs this.
/* eslint-disable no-restricted-syntax -- Test mocking requires double type assertions and inline types. */
import type { DebugController } from 'obsidian-dev-utils/debug-controller';
import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import {
  App,
  Plugin,
  ToggleComponent
} from 'obsidian';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { DebugMode } from './debug-mode.ts';
import type { EmulateMobileMode } from './emulate-mobile-mode.ts';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

// Patch ToggleComponent to have setPlaceholderValue so that
// PluginSettingsTabBase.bind() can duck-type it.
beforeAll(() => {
  const proto = ToggleComponent.prototype as unknown as Record<string, unknown>;
  if (!('setPlaceholderValue' in proto)) {
    proto['setPlaceholderValue'] = undefined;
  }
});

interface CreatePluginSettingsTabOverrides {
  debugControllerOverrides?: Partial<DebugController>;
  debugModeOverrides?: Partial<DebugMode>;
  emulateMobileModeOverrides?: Partial<EmulateMobileMode>;
}

interface CreatePluginSettingsTabResult {
  pluginSettingsComponent: PluginSettingsComponent;
  tab: PluginSettingsTab;
}

function createPluginEventSource(): PluginEventSource {
  return strictProxy<PluginEventSource>({});
}

function createPluginSettingsTab(overrides?: CreatePluginSettingsTabOverrides): CreatePluginSettingsTabResult {
  const dataHandler: DataHandler = {
    loadData: vi.fn().mockResolvedValue(null),
    saveData: vi.fn().mockResolvedValue(undefined)
  };
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler,
    pluginEventSource: createPluginEventSource()
  });

  const app = new App();
  // Initialize obsidianDevUtilsState on the app (needed by getDebugger())
  (app as unknown as Record<string, unknown>)['obsidianDevUtilsState'] = {};
  (window as unknown as Record<string, unknown>)['app'] = app;
  const manifest = { author: 'test', id: 'test-plugin', minAppVersion: '0.0.0', name: 'Test Plugin', version: '1.0.0' };
  // Plugin may be abstract in typings — use it as a constructor directly since the mock is concrete.
  const PluginConstructor = Plugin as unknown as new (app: App, manifest: Record<string, string>) => Plugin;
  const plugin = new PluginConstructor(app, manifest);

  const debugMode: DebugMode = {
    isDebugMode: vi.fn().mockReturnValue(false),
    toggleDebugMode: vi.fn(),
    ...overrides?.debugModeOverrides
  } as unknown as DebugMode;

  const emulateMobileMode: EmulateMobileMode = {
    isEmulateMobileMode: vi.fn().mockReturnValue(false),
    toggleEmulateMobileMode: vi.fn(),
    ...overrides?.emulateMobileModeOverrides
  } as unknown as EmulateMobileMode;

  const debugController: DebugController = {
    disable: vi.fn(),
    enable: vi.fn(),
    get: vi.fn().mockReturnValue([]),
    set: vi.fn(),
    ...overrides?.debugControllerOverrides
  };

  const tab = new PluginSettingsTab({
    debugController,
    debugMode,
    emulateMobileMode,
    plugin,
    pluginSettingsComponent
  });

  return { pluginSettingsComponent, tab };
}

describe('PluginSettingsTab', () => {
  let savedGlobalApp: unknown;

  beforeEach(() => {
    savedGlobalApp = (window as unknown as Record<string, unknown>)['app'];
  });

  afterEach(() => {
    (window as unknown as Record<string, unknown>)['app'] = savedGlobalApp;
  });

  it('should construct without errors', () => {
    expect(() => {
      createPluginSettingsTab();
    }).not.toThrow();
  });

  it('should render settings without errors', () => {
    const { tab } = createPluginSettingsTab();
    expect(() => {
      tab.display();
    }).not.toThrow();
  });

  it('should create setting elements in containerEl', () => {
    const { tab } = createPluginSettingsTab();
    tab.display();

    // Settings mock creates divs inside containerEl
    expect(tab.containerEl.children.length).toBeGreaterThan(0);
  });

  it('should display without errors when re-displayed', () => {
    const { tab } = createPluginSettingsTab();

    expect(() => {
      tab.display();
      tab.display();
    }).not.toThrow();
  });
});
