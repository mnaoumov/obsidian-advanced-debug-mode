import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';

import {
  getDebugSwitch,
  registerDebugSwitch,
  setDebugSwitch
} from '@mnaoumov/typescript-lib/debug-switches';
import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';
import { DebugSwitchesComponent } from './debug-switches-component.ts';

const ON_BY_DEFAULT_ID = 'advanced-debug-mode-test:on-by-default';
const OFF_BY_DEFAULT_ID = 'advanced-debug-mode-test:off-by-default';
const LATE_ID = 'advanced-debug-mode-test:late';

interface Context {
  readonly component: DebugSwitchesComponent;
  readonly dataHandler: DataHandler;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly reloadSettings: (data: unknown) => Promise<void>;
}

async function createContext(data: unknown): Promise<Context> {
  let storedData = data;
  const dataHandler: DataHandler = {
    loadData: vi.fn(async () => {
      await noopAsync();
      return storedData;
    }),
    saveData: vi.fn(async (newData: unknown) => {
      await noopAsync();
      storedData = newData;
    })
  };
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler,
    pluginEventSource: strictProxy<PluginEventSource>({
      offref: vi.fn(),
      on: vi.fn().mockReturnValue({})
    })
  });
  await pluginSettingsComponent.loadWithPromises();

  const pluginNoticeComponent = strictProxy<PluginNoticeComponent>({
    showNotice: vi.fn()
  });
  const component = new DebugSwitchesComponent({ pluginNoticeComponent, pluginSettingsComponent });
  component.load();

  return {
    component,
    dataHandler,
    pluginNoticeComponent,
    pluginSettingsComponent,
    async reloadSettings(newData: unknown): Promise<void> {
      storedData = newData;
      await pluginSettingsComponent.loadFromFile(false);
    }
  };
}

describe('DebugSwitchesComponent', () => {
  // The shared library state is reset before each test, so the switches are registered per test.
  beforeEach(() => {
    registerDebugSwitch({
      description: 'On by default.',
      id: ON_BY_DEFAULT_ID,
      isEnabledByDefault: true,
      name: 'On by default'
    });
    registerDebugSwitch({
      description: 'Off by default.',
      id: OFF_BY_DEFAULT_ID,
      isEnabledByDefault: false,
      name: 'Off by default'
    });
  });

  it('should leave every switch at its default and show no notice when nothing is stored', async () => {
    const { component, pluginNoticeComponent } = await createContext(null);

    expect(getDebugSwitch(ON_BY_DEFAULT_ID)?.isEnabled()).toBe(true);
    expect(getDebugSwitch(OFF_BY_DEFAULT_ID)?.isEnabled()).toBe(false);
    expect(pluginNoticeComponent.showNotice).not.toHaveBeenCalled();

    component.unload();
  });

  it('should apply the stored values on load and name them in a notice', async () => {
    const { component, pluginNoticeComponent } = await createContext({
      debugSwitches: {
        [LATE_ID]: true,
        [ON_BY_DEFAULT_ID]: false
      }
    });

    expect(getDebugSwitch(ON_BY_DEFAULT_ID)?.isEnabled()).toBe(false);
    expect(pluginNoticeComponent.showNotice).toHaveBeenCalledWith(
      `Debug switches not at their default: ${LATE_ID} (on), On by default (off).`
    );

    // A switch registered after the load takes the stored value.
    const lateSwitch = registerDebugSwitch({
      description: 'Registered late.',
      id: LATE_ID,
      isEnabledByDefault: false,
      name: 'Late'
    });
    expect(lateSwitch.isEnabled()).toBe(true);

    component.unload();
  });

  it('should skip a stored value that is not a boolean', async () => {
    const { component } = await createContext({
      debugSwitches: {
        [OFF_BY_DEFAULT_ID]: 'yes'
      }
    });

    expect(getDebugSwitch(OFF_BY_DEFAULT_ID)?.isEnabled()).toBe(false);

    component.unload();
  });

  it('should store a change made outside the plugin, and drop it once the switch is back at its default', async () => {
    const { component, dataHandler, pluginSettingsComponent } = await createContext(null);

    setDebugSwitch(OFF_BY_DEFAULT_ID, true);
    await waitForAllAsyncOperations();
    expect(pluginSettingsComponent.settings.debugSwitches).toEqual({ [OFF_BY_DEFAULT_ID]: true });
    expect(dataHandler.saveData).toHaveBeenLastCalledWith(expect.objectContaining({ debugSwitches: { [OFF_BY_DEFAULT_ID]: true } }));

    setDebugSwitch(OFF_BY_DEFAULT_ID, false);
    await waitForAllAsyncOperations();
    expect(pluginSettingsComponent.settings.debugSwitches).toEqual({});

    component.unload();
  });

  it('should store a change to a switch that is not registered', async () => {
    const UNREGISTERED_ID = 'advanced-debug-mode-test:unregistered';
    const { component, pluginSettingsComponent } = await createContext(null);

    setDebugSwitch(UNREGISTERED_ID, true);
    await waitForAllAsyncOperations();
    expect(pluginSettingsComponent.settings.debugSwitches).toEqual({ [UNREGISTERED_ID]: true });

    component.unload();
  });

  it('should re-apply the values when the settings file is reloaded, resetting a switch whose entry is gone', async () => {
    const { component, reloadSettings } = await createContext({
      debugSwitches: {
        [ON_BY_DEFAULT_ID]: false
      }
    });

    await reloadSettings({
      debugSwitches: {
        [OFF_BY_DEFAULT_ID]: true
      }
    });

    expect(getDebugSwitch(ON_BY_DEFAULT_ID)?.isEnabled()).toBe(true);
    expect(getDebugSwitch(OFF_BY_DEFAULT_ID)?.isEnabled()).toBe(true);

    component.unload();
  });

  it('should apply what a settings edit from elsewhere changed', async () => {
    const { component, pluginSettingsComponent } = await createContext({
      debugSwitches: {
        [ON_BY_DEFAULT_ID]: false
      }
    });

    // As a script does through `configureCommunityPlugin`.
    await pluginSettingsComponent.editAndSave((settings) => {
      settings.debugSwitches = { [LATE_ID]: castTo<boolean>('yes'), [OFF_BY_DEFAULT_ID]: true };
    });
    await waitForAllAsyncOperations();

    expect(getDebugSwitch(OFF_BY_DEFAULT_ID)?.isEnabled()).toBe(true);
    expect(getDebugSwitch(ON_BY_DEFAULT_ID)?.isEnabled()).toBe(true);

    // An edit that leaves the switches alone changes nothing.
    await pluginSettingsComponent.editAndSave((settings) => {
      settings.stackTraceLimit = 50;
    });
    expect(getDebugSwitch(OFF_BY_DEFAULT_ID)?.isEnabled()).toBe(true);

    component.unload();
  });

  it('should not name a stored entry that holds the default value', async () => {
    const { component, pluginNoticeComponent } = await createContext({
      debugSwitches: {
        [ON_BY_DEFAULT_ID]: true
      }
    });

    expect(pluginNoticeComponent.showNotice).not.toHaveBeenCalled();

    component.unload();
  });

  it('should put the switches back to their defaults on unload, keeping the stored values', async () => {
    const UNREGISTERED_ID = 'advanced-debug-mode-test:unregistered-on-unload';
    const { component, pluginSettingsComponent } = await createContext({
      debugSwitches: {
        [OFF_BY_DEFAULT_ID]: true,
        [UNREGISTERED_ID]: true
      }
    });

    component.unload();
    await waitForAllAsyncOperations();

    expect(getDebugSwitch(OFF_BY_DEFAULT_ID)?.isEnabled()).toBe(false);
    expect(pluginSettingsComponent.settings.debugSwitches).toEqual({
      [OFF_BY_DEFAULT_ID]: true,
      [UNREGISTERED_ID]: true
    });
  });
});
