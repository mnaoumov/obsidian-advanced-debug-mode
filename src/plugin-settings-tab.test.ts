import type { DebugController } from 'obsidian-dev-utils/debug-controller';
import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import {
  App,
  Plugin,
  Setting,
  TextAreaComponent,
  ToggleComponent
} from 'obsidian';
import { waitForAllAsyncOperations } from 'obsidian-dev-utils/async';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import { ensureGenericObject } from 'obsidian-dev-utils/type-guards';
import {
  beforeAll,
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
  const proto = ensureGenericObject(ToggleComponent.prototype);
  if (!('setPlaceholderValue' in proto)) {
    proto['setPlaceholderValue'] = undefined;
  }
});

interface CreatePluginSettingsTabOverrides {
  readonly debugControllerOverrides?: Partial<DebugController>;
  readonly debugModeOverrides?: Partial<DebugMode>;
  readonly emulateMobileModeOverrides?: Partial<EmulateMobileMode>;
}

interface CreatePluginSettingsTabResult {
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly tab: PluginSettingsTab;
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
  const manifest = { author: 'test', id: 'test-plugin', minAppVersion: '0.0.0', name: 'Test Plugin', version: '1.0.0' };
  // Plugin may be abstract in typings — use it as a constructor directly since the mock is concrete.
  const PluginConstructor = castTo<new (app: App, manifest: Record<string, string>) => Plugin>(Plugin);
  const plugin = new PluginConstructor(app, manifest);

  const debugMode = strictProxy<DebugMode>({
    isDebugMode: vi.fn().mockReturnValue(false),
    toggleDebugMode: vi.fn(),
    ...overrides?.debugModeOverrides
  });

  const emulateMobileMode = strictProxy<EmulateMobileMode>({
    isEmulateMobileMode: vi.fn().mockReturnValue(false),
    toggleEmulateMobileMode: vi.fn(),
    ...overrides?.emulateMobileModeOverrides
  });

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
  it('should construct without errors', () => {
    expect(() => {
      createPluginSettingsTab();
    }).not.toThrow();
  });

  it('should render settings without errors', () => {
    const { tab } = createPluginSettingsTab();
    expect(() => {
      tab.displayLegacy();
    }).not.toThrow();
  });

  it('should create setting elements in containerEl', () => {
    const { tab } = createPluginSettingsTab();
    tab.displayLegacy();

    // Settings mock creates divs inside containerEl
    expect(tab.containerEl.children.length).toBeGreaterThan(0);
  });

  it('should display without errors when re-displayed', () => {
    const { tab } = createPluginSettingsTab();

    expect(() => {
      tab.displayLegacy();
      tab.displayLegacy();
    }).not.toThrow();
  });

  it('should re-display when shouldIncludeLongStackTraces toggle changes', async () => {
    const capturedToggles: ToggleComponent[] = [];
    const originalAddToggle = Setting.prototype.addToggle;
    const addToggleSpy = vi.spyOn(Setting.prototype, 'addToggle').mockImplementation(
      function mockAddToggle(this: Setting, cb: (toggle: ToggleComponent) => void) {
        const result = originalAddToggle.call(this, (toggle: ToggleComponent) => {
          capturedToggles.push(toggle);
          cb(toggle);
        });
        return result;
      }
    );

    const { pluginSettingsComponent, tab } = createPluginSettingsTab();
    tab.displayLegacy();

    addToggleSpy.mockRestore();

    // Mock setProperty to resolve so bind's async handler doesn't fail silently
    vi.spyOn(pluginSettingsComponent, 'setProperty').mockResolvedValue('');

    // Spy on display to detect re-display, replace with noop to prevent cascade
    const displaySpy = vi.spyOn(tab, 'displayLegacy').mockImplementation(() => {
      // No-op to prevent cascading re-display
    });

    // Toggle index 2 is "Include long stack traces"
    const LONG_STACK_TRACES_INDEX = 2;
    const toggle = capturedToggles[LONG_STACK_TRACES_INDEX];
    expect(toggle).toBeDefined();
    toggle?.onClick();

    // The onChange handler is fire-and-forget via convertAsyncToSync; drain the tracked operation.
    await waitForAllAsyncOperations();

    expect(displaySpy).toHaveBeenCalled();
  });

  it('should re-display when shouldTimeoutLongRunningTasks toggle changes', async () => {
    const capturedToggles: ToggleComponent[] = [];
    const originalAddToggle = Setting.prototype.addToggle;
    const addToggleSpy = vi.spyOn(Setting.prototype, 'addToggle').mockImplementation(
      function mockAddToggle(this: Setting, cb: (toggle: ToggleComponent) => void) {
        const result = originalAddToggle.call(this, (toggle: ToggleComponent) => {
          capturedToggles.push(toggle);
          cb(toggle);
        });
        return result;
      }
    );

    const { pluginSettingsComponent, tab } = createPluginSettingsTab();
    tab.displayLegacy();

    addToggleSpy.mockRestore();

    vi.spyOn(pluginSettingsComponent, 'setProperty').mockResolvedValue('');

    const displaySpy = vi.spyOn(tab, 'displayLegacy').mockImplementation(() => {
      // No-op to prevent cascading re-display
    });

    // Toggle index 5 is "Timeout long running tasks"
    const TIMEOUT_TOGGLE_INDEX = 5;
    const toggle = capturedToggles[TIMEOUT_TOGGLE_INDEX];
    expect(toggle).toBeDefined();
    toggle?.onClick();

    // The onChange handler is fire-and-forget via convertAsyncToSync; drain the tracked operation.
    await waitForAllAsyncOperations();

    expect(displaySpy).toHaveBeenCalled();
  });

  it('should call debugMode.toggleDebugMode when debug toggle changes', () => {
    const debugModeMock = {
      isDebugMode: vi.fn().mockReturnValue(false),
      toggleDebugMode: vi.fn()
    };

    const capturedToggles: ToggleComponent[] = [];
    const originalAddToggle = Setting.prototype.addToggle;
    const addToggleSpy = vi.spyOn(Setting.prototype, 'addToggle').mockImplementation(
      function mockAddToggle(this: Setting, cb: (toggle: ToggleComponent) => void) {
        const result = originalAddToggle.call(this, (toggle: ToggleComponent) => {
          capturedToggles.push(toggle);
          cb(toggle);
        });
        return result;
      }
    );

    const { tab } = createPluginSettingsTab({
      debugModeOverrides: debugModeMock
    });
    tab.displayLegacy();
    addToggleSpy.mockRestore();

    // Toggle index 0 is "Obsidian debug mode"
    const toggle = capturedToggles[0];
    expect(toggle).toBeDefined();
    toggle?.onClick();

    expect(debugModeMock.toggleDebugMode).toHaveBeenCalledWith(true);
  });

  it('should call emulateMobileMode.toggleEmulateMobileMode when emulate toggle changes', () => {
    const emulateMobileMock = {
      isEmulateMobileMode: vi.fn().mockReturnValue(false),
      toggleEmulateMobileMode: vi.fn()
    };

    const capturedToggles: ToggleComponent[] = [];
    const originalAddToggle = Setting.prototype.addToggle;
    const addToggleSpy = vi.spyOn(Setting.prototype, 'addToggle').mockImplementation(
      function mockAddToggle(this: Setting, cb: (toggle: ToggleComponent) => void) {
        const result = originalAddToggle.call(this, (toggle: ToggleComponent) => {
          capturedToggles.push(toggle);
          cb(toggle);
        });
        return result;
      }
    );

    const { tab } = createPluginSettingsTab({
      emulateMobileModeOverrides: emulateMobileMock
    });
    tab.displayLegacy();
    addToggleSpy.mockRestore();

    // Toggle index 1 is "Desktop: Emulate mobile mode"
    const toggle = capturedToggles[1];
    expect(toggle).toBeDefined();
    toggle?.onClick();

    expect(emulateMobileMock.toggleEmulateMobileMode).toHaveBeenCalledWith(true);
  });

  it('should call debugController.set when debug namespaces text area changes', () => {
    const debugControllerMock = {
      disable: vi.fn(),
      enable: vi.fn(),
      get: vi.fn().mockReturnValue(['namespace1']),
      set: vi.fn()
    };

    interface MockTextArea {
      onChanged(): void;
      setValue(value: string): unknown;
    }

    const capturedTextAreas: MockTextArea[] = [];
    const originalAddTextArea = Setting.prototype.addTextArea;
    const addTextAreaSpy = vi.spyOn(Setting.prototype, 'addTextArea').mockImplementation(function mockAddTextArea(this: Setting, cb) {
      const result = originalAddTextArea.call(this, (textArea: MockTextArea & TextAreaComponent) => {
        capturedTextAreas.push(textArea);
        cb(textArea);
      });
      return result;
    });

    const { tab } = createPluginSettingsTab({
      debugControllerOverrides: debugControllerMock
    });
    tab.displayLegacy();
    addTextAreaSpy.mockRestore();

    const textArea = capturedTextAreas[0];
    expect(textArea).toBeDefined();

    // Set a new value and trigger onChange
    textArea?.setValue('ns1\nns2');

    expect(debugControllerMock.set).toHaveBeenCalledWith(['ns1', 'ns2']);
  });

  it('should handle debug timeout toggle onChange enabling', () => {
    const debugControllerMock = {
      disable: vi.fn(),
      enable: vi.fn(),
      get: vi.fn().mockReturnValue([]),
      set: vi.fn()
    };

    const capturedToggles: ToggleComponent[] = [];
    const originalAddToggle = Setting.prototype.addToggle;
    const addToggleSpy = vi.spyOn(Setting.prototype, 'addToggle').mockImplementation(
      function mockAddToggle(this: Setting, cb: (toggle: ToggleComponent) => void) {
        const result = originalAddToggle.call(this, (toggle: ToggleComponent) => {
          capturedToggles.push(toggle);
          cb(toggle);
        });
        return result;
      }
    );

    const { tab } = createPluginSettingsTab({
      debugControllerOverrides: debugControllerMock
    });
    tab.displayLegacy();

    addToggleSpy.mockRestore();

    // Mock display to prevent infinite recursion
    vi.spyOn(tab, 'displayLegacy').mockImplementation(() => {
      // No-op
    });

    // Toggle index 7 is the "Dev Utils timeout" toggle
    const DEV_UTILS_TIMEOUT_INDEX = 7;
    const toggle = capturedToggles[DEV_UTILS_TIMEOUT_INDEX];
    expect(toggle).toBeDefined();

    // The toggle starts at true (setValue(!timeoutDebugger.enabled)).
    // Clicking toggles to false → else branch → debugController.enable(NAMESPACE)
    toggle?.onClick();

    expect(debugControllerMock.enable).toHaveBeenCalled();

    // Click again → value becomes true → if branch → debugController.disable(NAMESPACE)
    toggle?.onClick();

    expect(debugControllerMock.disable).toHaveBeenCalled();
  });
});
