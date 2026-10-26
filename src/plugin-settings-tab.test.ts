import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { DebugController } from '@mnaoumov/typescript-lib/debug-controller';
import type {
  ButtonComponent,
  PluginManifest,
  SettingDefinitionGroup,
  SettingGroup
} from 'obsidian';
import type { Mock } from 'vitest';

import { SettingEx } from '@mnaoumov/obsidian-lib/setting-ex';
import { getSharedAbortController } from '@mnaoumov/typescript-lib/abort-controller';
import {
  runWithTimeout,
  sleep
} from '@mnaoumov/typescript-lib/async';
import {
  getDebugSwitch,
  getTerminateOnTimeoutDebugSwitch,
  registerDebugSwitch,
  setDebugSwitch
} from '@mnaoumov/typescript-lib/debug-switches';
import { SilentError } from '@mnaoumov/typescript-lib/error';
import { noop } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  App,
  Plugin,
  Setting,
  TextAreaComponent,
  ToggleComponent
} from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { DebugMode } from './debug-mode.ts';
import type { EmulateMobileMode } from './emulate-mobile-mode.ts';

import { PluginDebugMessages } from './plugin-debug-messages.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

/**
 * The mock `ButtonComponent`'s test-only click trigger. `onClick` REGISTERS a handler; only
 * `simulateClick__` fires the one that was registered.
 */
interface ClickableButtonComponent {
  simulateClick__: () => void;
}

interface CreatePluginSettingsTabOverrides {
  readonly debugControllerOverrides?: Partial<DebugController>;
  readonly debugModeOverrides?: Partial<DebugMode>;
  readonly emulateMobileModeOverrides?: Partial<EmulateMobileMode>;
  readonly pluginManifests?: Record<string, PluginManifest>;
}

interface CreatePluginSettingsTabResult {
  readonly openPluginDebugMessagesView: Mock<() => Promise<void>>;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly tab: PluginSettingsTab;
}

interface DescribedRow {
  desc: DocumentFragment;
}

interface DisabledPredicateRow {
  disabled: () => boolean;
}

/**
 * Builds a debug controller that keeps its namespaces in memory, as window.DEBUG does.
 *
 * @param initialNamespaces - The namespaces it starts with.
 * @returns The controller.
 */
function createInMemoryDebugController(initialNamespaces: string[] = []): DebugController {
  let namespaces = initialNamespaces;
  return {
    disable: vi.fn(),
    enable: vi.fn(),
    get: vi.fn(() => [...namespaces]),
    set: vi.fn((value: string | string[]) => {
      namespaces = typeof value === 'string' ? value.split(',') : [...value];
    })
  };
}

/**
 * Builds a plugin manifest.
 *
 * @param id - The plugin id.
 * @param name - The plugin name.
 * @returns The manifest.
 */
function createManifest(id: string, name: string): PluginManifest {
  return { author: 'test', description: '', id, minAppVersion: '0.0.0', name, version: '1.0.0' };
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

  const pluginNoticeComponent = strictProxy<PluginNoticeComponent>({
    showNotice: vi.fn()
  });

  const pluginDebugMessages = new PluginDebugMessages({
    app: strictProxy<App>({ plugins: castTo<App['plugins']>({ manifests: overrides?.pluginManifests ?? {} }) }),
    debugController
  });

  const openPluginDebugMessagesView = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

  const tab = new PluginSettingsTab({
    debugController,
    debugMode,
    emulateMobileMode,
    openPluginDebugMessagesView,
    plugin,
    pluginDebugMessages,
    pluginNoticeComponent,
    pluginSettingsComponent
  });

  return { openPluginDebugMessagesView, pluginNoticeComponent, pluginSettingsComponent, tab };
}

/**
 * Finds the declared "Debug switches" group.
 *
 * @param tab - The settings tab.
 * @returns The group.
 */
function getDebugSwitchesGroup(tab: PluginSettingsTab): Required<Pick<SettingDefinitionGroup, 'heading' | 'items'>> {
  return getGroup(tab, 'Debug switches');
}

/**
 * Finds a declared group by its heading.
 *
 * @param tab - The settings tab.
 * @param heading - The group heading.
 * @returns The group.
 */
function getGroup(tab: PluginSettingsTab, heading: string): Required<Pick<SettingDefinitionGroup, 'heading' | 'items'>> {
  const group = tab.getSettingDefinitions().find((definition) => 'heading' in definition && definition.heading === heading);
  return castTo<Required<Pick<SettingDefinitionGroup, 'heading' | 'items'>>>(group);
}

/**
 * Evaluates a declared row's `disabled` predicate.
 *
 * @param tab - The settings tab.
 * @param name - The row name.
 * @returns Whether the row is disabled.
 */
function isRowDisabled(tab: PluginSettingsTab, name: string): boolean {
  const row = tab.getSettingDefinitions().find((definition) => 'name' in definition && definition.name === name);
  return castTo<DisabledPredicateRow>(row).disabled();
}

/**
 * Renders the rows of the "Debug switches" group and captures each row's toggle.
 *
 * @param tab - The settings tab.
 * @param group - The group to render, built from the tab's current definitions when omitted.
 * @returns The toggles, keyed by the switch name.
 */
function renderDebugSwitchToggles(
  tab: PluginSettingsTab,
  group: Required<Pick<SettingDefinitionGroup, 'heading' | 'items'>> = getDebugSwitchesGroup(tab)
): Map<string, ToggleComponent> {
  return renderGroupToggles(tab, group);
}

/**
 * Renders the rows of a group and captures each row's toggle.
 *
 * @param tab - The settings tab.
 * @param group - The group to render.
 * @returns The toggles, keyed by the row name.
 */
function renderGroupToggles(
  tab: PluginSettingsTab,
  group: Required<Pick<SettingDefinitionGroup, 'heading' | 'items'>>
): Map<string, ToggleComponent> {
  const toggles = new Map<string, ToggleComponent>();
  let currentName = '';
  const originalAddToggle = Setting.prototype.addToggle;
  const addToggleSpy = vi.spyOn(Setting.prototype, 'addToggle').mockImplementation(
    function mockAddToggle(this: Setting, callback: (toggle: ToggleComponent) => void) {
      return originalAddToggle.call(this, (toggle: ToggleComponent) => {
        toggles.set(currentName, toggle);
        callback(toggle);
      });
    }
  );

  try {
    for (const item of group.items) {
      if (!('render' in item)) {
        continue;
      }

      currentName = item.name;
      item.render(new SettingEx(tab.containerEl), castTo<SettingGroup>(null));
    }
  } finally {
    addToggleSpy.mockRestore();
  }
  return toggles;
}

/**
 * Invokes every declared row's `render` callback the way Obsidian does when the tab is opened, so the
 * bindings are still exercised now that the rows are declarative.
 *
 * @param tab - The settings tab.
 */
function renderRows(tab: PluginSettingsTab): void {
  const definitions = tab.getSettingDefinitions().flatMap((definition) => 'items' in definition ? definition.items ?? [] : [definition]);
  for (const definition of definitions) {
    if ('render' in definition) {
      definition.render(new SettingEx(tab.containerEl), castTo<SettingGroup>(null));
    }
  }
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
      renderRows(tab);
    }).not.toThrow();
  });

  it('should create setting elements in containerEl', () => {
    const { tab } = createPluginSettingsTab();
    renderRows(tab);

    // Settings mock creates divs inside containerEl
    expect(tab.containerEl.children.length).toBeGreaterThan(0);
  });

  it('should display without errors when re-displayed', () => {
    const { tab } = createPluginSettingsTab();

    expect(() => {
      renderRows(tab);
      renderRows(tab);
    }).not.toThrow();
  });

  it('should declare disabled predicates for the rows that depend on other settings', () => {
    const { tab } = createPluginSettingsTab();

    // Both defaults are `true`, so the dependent rows start enabled.
    expect(isRowDisabled(tab, 'Desktop: Include async long stack traces')).toBe(false);
    expect(isRowDisabled(tab, 'Include internal stack frames')).toBe(false);
    expect(isRowDisabled(tab, 'Desktop: Include timed out tasks details')).toBe(false);
    // The desktop-only rows read `Platform.isMobile`, which is false under jsdom.
    expect(isRowDisabled(tab, 'Desktop: Timeout long running tasks')).toBe(false);
    expect(isRowDisabled(tab, 'Desktop: Emulate mobile mode')).toBe(false);
  });

  it('should re-display when shouldIncludeLongStackTraces toggle changes', async () => {
    const capturedToggles: ToggleComponent[] = [];
    const originalAddToggle = Setting.prototype.addToggle;
    const addToggleSpy = vi.spyOn(Setting.prototype, 'addToggle').mockImplementation(
      function mockAddToggle(this: Setting, callback: (toggle: ToggleComponent) => void) {
        const result = originalAddToggle.call(this, (toggle: ToggleComponent) => {
          capturedToggles.push(toggle);
          callback(toggle);
        });
        return result;
      }
    );

    const { pluginSettingsComponent, tab } = createPluginSettingsTab();
    renderRows(tab);

    addToggleSpy.mockRestore();

    // Mock setProperty to resolve so bind's async handler doesn't fail silently
    vi.spyOn(pluginSettingsComponent, 'setProperty').mockResolvedValue('');

    // The dependent rows only read this value through their `disabled` predicates, so the tab asks
    // Obsidian to re-evaluate them in place instead of re-rendering.
    const refreshDomStateSpy = vi.fn();
    tab.refreshDomState = refreshDomStateSpy;

    // Toggle index 2 is "Include long stack traces"
    const LONG_STACK_TRACES_INDEX = 2;
    const toggle = capturedToggles[LONG_STACK_TRACES_INDEX];
    expect(toggle).toBeDefined();
    toggle?.onClick();

    // The onChange handler is fire-and-forget via convertAsyncToSync; drain the tracked operation.
    await waitForAllAsyncOperations();

    expect(refreshDomStateSpy).toHaveBeenCalled();
  });

  it('should re-display when shouldTimeoutLongRunningTasks toggle changes', async () => {
    const capturedToggles: ToggleComponent[] = [];
    const originalAddToggle = Setting.prototype.addToggle;
    const addToggleSpy = vi.spyOn(Setting.prototype, 'addToggle').mockImplementation(
      function mockAddToggle(this: Setting, callback: (toggle: ToggleComponent) => void) {
        const result = originalAddToggle.call(this, (toggle: ToggleComponent) => {
          capturedToggles.push(toggle);
          callback(toggle);
        });
        return result;
      }
    );

    const { pluginSettingsComponent, tab } = createPluginSettingsTab();
    renderRows(tab);

    addToggleSpy.mockRestore();

    vi.spyOn(pluginSettingsComponent, 'setProperty').mockResolvedValue('');

    const refreshDomStateSpy = vi.fn();
    tab.refreshDomState = refreshDomStateSpy;

    // Toggle index 5 is "Timeout long running tasks"
    const TIMEOUT_TOGGLE_INDEX = 5;
    const toggle = capturedToggles[TIMEOUT_TOGGLE_INDEX];
    expect(toggle).toBeDefined();
    toggle?.onClick();

    // The onChange handler is fire-and-forget via convertAsyncToSync; drain the tracked operation.
    await waitForAllAsyncOperations();

    expect(refreshDomStateSpy).toHaveBeenCalled();
  });

  it('should call debugMode.toggleDebugMode when debug toggle changes', () => {
    const debugModeMock = {
      isDebugMode: vi.fn().mockReturnValue(false),
      toggleDebugMode: vi.fn()
    };

    const capturedToggles: ToggleComponent[] = [];
    const originalAddToggle = Setting.prototype.addToggle;
    const addToggleSpy = vi.spyOn(Setting.prototype, 'addToggle').mockImplementation(
      function mockAddToggle(this: Setting, callback: (toggle: ToggleComponent) => void) {
        const result = originalAddToggle.call(this, (toggle: ToggleComponent) => {
          capturedToggles.push(toggle);
          callback(toggle);
        });
        return result;
      }
    );

    const { tab } = createPluginSettingsTab({
      debugModeOverrides: debugModeMock
    });
    renderRows(tab);
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
      function mockAddToggle(this: Setting, callback: (toggle: ToggleComponent) => void) {
        const result = originalAddToggle.call(this, (toggle: ToggleComponent) => {
          capturedToggles.push(toggle);
          callback(toggle);
        });
        return result;
      }
    );

    const { tab } = createPluginSettingsTab({
      emulateMobileModeOverrides: emulateMobileMock
    });
    renderRows(tab);
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
      inputEl: HTMLTextAreaElement;
      setValue: (value: string) => unknown;
    }

    const capturedTextAreas: MockTextArea[] = [];
    const originalAddTextArea = Setting.prototype.addTextArea;
    const addTextAreaSpy = vi.spyOn(Setting.prototype, 'addTextArea').mockImplementation(function mockAddTextArea(this: Setting, callback) {
      const result = originalAddTextArea.call(this, (textArea: MockTextArea & TextAreaComponent) => {
        capturedTextAreas.push(textArea);
        callback(textArea);
      });
      return result;
    });

    const { tab } = createPluginSettingsTab({
      debugControllerOverrides: debugControllerMock
    });
    renderRows(tab);
    addTextAreaSpy.mockRestore();

    const textArea = capturedTextAreas[0];
    expect(textArea).toBeDefined();

    // As in Obsidian, `setValue` alone does not fire `onChange`: the user's edit is the `input` event.
    textArea?.setValue('ns1\nns2');
    textArea?.inputEl.dispatchEvent(new Event('input'));

    expect(debugControllerMock.set).toHaveBeenCalledWith(['ns1', 'ns2']);
  });

  it('should render a row for every registered debug switch, including one registered after the tab was created', () => {
    const { tab } = createPluginSettingsTab();
    const LATE_SWITCH_ID = 'advanced-debug-mode-test:late-switch';
    expect(getDebugSwitchesGroup(tab).items.map((item) => 'name' in item ? item.name : '')).toEqual(['Terminate operations on timeout']);

    registerDebugSwitch({
      description: 'A switch registered after the tab was created.',
      id: LATE_SWITCH_ID,
      isEnabledByDefault: false,
      name: 'Late switch'
    });

    try {
      const group = getDebugSwitchesGroup(tab);
      expect(group.heading).toBe('Debug switches');
      // Sorted by id.
      expect(group.items.map((item) => 'name' in item ? item.name : '')).toEqual(['Late switch', 'Terminate operations on timeout']);

      const toggles = renderDebugSwitchToggles(tab);
      expect(toggles.get('Late switch')?.getValue()).toBe(false);
      expect(toggles.get('Terminate operations on timeout')?.getValue()).toBe(true);
      const lateRow = group.items.find((item) => 'name' in item && item.name === 'Late switch');
      const lateRowDescription = castTo<DescribedRow | undefined>(lateRow)?.desc;
      expect(lateRowDescription?.textContent).toBe(`A switch registered after the tab was created.Id: ${LATE_SWITCH_ID}, off by default.`);

      toggles.get('Late switch')?.onClick();
      expect(getDebugSwitch(LATE_SWITCH_ID)?.isEnabled()).toBe(true);
    } finally {
      setDebugSwitch(LATE_SWITCH_ID, false);
    }
  });

  it('should rebuild the rows once when a switch registered after the definitions were built', async () => {
    const { tab } = createPluginSettingsTab();
    const refreshSpy = vi.spyOn(tab, 'refresh').mockImplementation(noop);
    const group = getDebugSwitchesGroup(tab);

    // Unchanged registry: nothing to rebuild.
    renderDebugSwitchToggles(tab, group);
    await sleep({ milliseconds: 0 });
    expect(refreshSpy).not.toHaveBeenCalled();

    registerDebugSwitch({
      description: 'Registered after the definitions were built.',
      id: 'advanced-debug-mode-test:after-build',
      isEnabledByDefault: false,
      name: 'After build'
    });

    // Obsidian renders the stored definitions, which have no row for the new switch.
    renderDebugSwitchToggles(tab, group);
    renderDebugSwitchToggles(tab, group);
    expect(refreshSpy).not.toHaveBeenCalled();
    await sleep({ milliseconds: 0 });
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('should switch whether runWithTimeout terminates a timed out operation', async () => {
    const { tab } = createPluginSettingsTab();
    const capturedToggles = renderDebugSwitchToggles(tab);

    const SLOW_OPERATION_IN_MILLISECONDS = 50;
    const TIMEOUT_IN_MILLISECONDS = 10;

    function runSlowOperation(): Promise<string> {
      return runWithTimeout({
        operationFunction: async () => {
          await sleep({ milliseconds: SLOW_OPERATION_IN_MILLISECONDS });
          return 'completed';
        },
        timeoutInMilliseconds: TIMEOUT_IN_MILLISECONDS
      });
    }

    const toggle = capturedToggles.get('Terminate operations on timeout');
    expect(toggle).toBeDefined();

    try {
      // The row reads the library's app-wide switch, which is on by default.
      expect(toggle?.getValue()).toBe(true);
      await expect(runSlowOperation()).rejects.toThrow();

      toggle?.onClick();

      expect(getTerminateOnTimeoutDebugSwitch().isEnabled()).toBe(false);
      await expect(runSlowOperation()).resolves.toBe('completed');

      toggle?.onClick();

      expect(getTerminateOnTimeoutDebugSwitch().isEnabled()).toBe(true);
      await expect(runSlowOperation()).rejects.toThrow();
    } finally {
      // The switch is app-wide shared state, so leave it as every other test expects it.
      getTerminateOnTimeoutDebugSwitch().setEnabled(true);
    }
  });

  it('should abort the shared operation when the abort button is clicked', () => {
    const capturedButtons: ButtonComponent[] = [];
    const originalAddButton = Setting.prototype.addButton;
    const addButtonSpy = vi.spyOn(Setting.prototype, 'addButton').mockImplementation(
      function mockAddButton(this: Setting, callback: (button: ButtonComponent) => void) {
        const result = originalAddButton.call(this, (button: ButtonComponent) => {
          capturedButtons.push(button);
          callback(button);
        });
        return result;
      }
    );

    const { pluginNoticeComponent, tab } = createPluginSettingsTab();
    renderRows(tab);

    addButtonSpy.mockRestore();

    // The abort row is the only one that declares a button.
    const button = capturedButtons[0];
    expect(button).toBeDefined();

    // Captured BEFORE the click: `ResettableAbortController` replaces its inner controller on abort, so
    // reading the signal afterwards yields the fresh one and would never look aborted.
    const abortedSignal = getSharedAbortController().signal;
    expect(abortedSignal.aborted).toBe(false);

    castTo<ClickableButtonComponent>(button).simulateClick__();

    expect(abortedSignal.aborted).toBe(true);
    expect(abortedSignal.reason).toBeInstanceOf(SilentError);
    // The replacement signal is fresh, so the next operation does not start already cancelled.
    expect(getSharedAbortController().signal.aborted).toBe(false);
    expect(pluginNoticeComponent.showNotice).toHaveBeenCalledOnce();
  });

  describe('Plugin debug messages', () => {
    const pluginManifests = {
      'plugin-a': createManifest('plugin-a', 'Alpha'),
      'plugin-b': createManifest('plugin-b', 'Beta')
    };

    it('should render a row per installed plugin, sorted by name, that turns its namespaces on and off', () => {
      const debugController = createInMemoryDebugController(['other']);
      const { tab } = createPluginSettingsTab({ debugControllerOverrides: debugController, pluginManifests });
      renderRows(tab);

      const group = getGroup(tab, 'Plugin debug messages');
      expect(group.items.map((item) => 'name' in item ? item.name : '')).toEqual(['Plugin debug messages view', 'Alpha', 'Beta']);
      const alphaRowDescription = castTo<DescribedRow | undefined>(group.items[1])?.desc;
      expect(alphaRowDescription?.textContent).toBe('Show the debug messages of Alpha: turns on the plugin-a and plugin-a:* debug namespaces.');
      const alphaRowDescriptionEl = createDiv();
      alphaRowDescriptionEl.append(alphaRowDescription ?? '');
      expect([...alphaRowDescriptionEl.querySelectorAll(':scope .markdown-rendered.code > code')].map((codeEl) => codeEl.textContent)).toEqual([
        'Alpha',
        'plugin-a',
        'plugin-a:*'
      ]);

      const toggles = renderGroupToggles(tab, group);
      expect(toggles.get('Alpha')?.getValue()).toBe(false);

      toggles.get('Alpha')?.onClick();
      expect(debugController.get()).toEqual(['other', 'plugin-a', 'plugin-a:*']);

      toggles.get('Alpha')?.onClick();
      expect(debugController.get()).toEqual(['other']);
    });

    it('should show a toggle change in the namespaces text area and an edit of it in the toggles', () => {
      const capturedTextAreas: TextAreaComponent[] = [];
      const originalAddTextArea = Setting.prototype.addTextArea;
      const addTextAreaSpy = vi.spyOn(Setting.prototype, 'addTextArea').mockImplementation(function mockAddTextArea(this: Setting, callback) {
        return originalAddTextArea.call(this, (textArea: TextAreaComponent) => {
          capturedTextAreas.push(textArea);
          callback(textArea);
        });
      });

      const debugController = createInMemoryDebugController();
      const { tab } = createPluginSettingsTab({ debugControllerOverrides: debugController, pluginManifests });
      renderRows(tab);
      addTextAreaSpy.mockRestore();
      const toggles = renderGroupToggles(tab, getGroup(tab, 'Plugin debug messages'));
      const textArea = capturedTextAreas[0];

      toggles.get('Beta')?.onClick();
      expect(textArea?.getValue()).toBe('plugin-b\nplugin-b:*');

      vi.mocked(debugController.set).mockClear();
      textArea?.setValue('plugin-a');
      textArea?.inputEl.dispatchEvent(new Event('input'));

      expect(toggles.get('Alpha')?.getValue()).toBe(true);
      expect(toggles.get('Beta')?.getValue()).toBe(false);
      // Syncing the toggles must not write the namespaces back over what the user typed.
      expect(debugController.set).toHaveBeenCalledOnce();
      expect(debugController.get()).toEqual(['plugin-a']);
    });

    it('should open the view from the first row of the group', async () => {
      const { openPluginDebugMessagesView, tab } = createPluginSettingsTab({ pluginManifests });
      renderRows(tab);

      const button = [...tab.containerEl.querySelectorAll('button')].find((buttonEl) => buttonEl.textContent === 'Open as a view');
      button?.click();
      await sleep({ milliseconds: 0 });

      expect(openPluginDebugMessagesView).toHaveBeenCalledOnce();
    });

    it('should rebuild the rows once when a plugin is installed after the definitions were built', async () => {
      const manifests: Record<string, PluginManifest> = { ...pluginManifests };
      const { tab } = createPluginSettingsTab({ pluginManifests: manifests });
      const refreshSpy = vi.spyOn(tab, 'refresh').mockImplementation(noop);
      const group = getGroup(tab, 'Plugin debug messages');

      renderGroupToggles(tab, group);
      await sleep({ milliseconds: 0 });
      expect(refreshSpy).not.toHaveBeenCalled();

      manifests['plugin-c'] = createManifest('plugin-c', 'Gamma');
      renderGroupToggles(tab, group);
      renderGroupToggles(tab, group);
      await sleep({ milliseconds: 0 });
      expect(refreshSpy).toHaveBeenCalledOnce();
    });
  });
});
