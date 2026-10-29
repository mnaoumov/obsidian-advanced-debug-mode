import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettings } from './plugin-settings.ts';

function createListeningPluginEventSource(): PluginEventSource {
  return strictProxy<PluginEventSource>({
    off: vi.fn(),
    offref: vi.fn(),
    on: vi.fn(() => castTo<ReturnType<PluginEventSource['on']>>({})),
    once: vi.fn(() => castTo<ReturnType<PluginEventSource['on']>>({}))
  });
}

function createPluginEventSource(): PluginEventSource {
  return strictProxy<PluginEventSource>({});
}

async function loadStackTraceLimit(savedValue: unknown): Promise<number> {
  const component = new PluginSettingsComponent({
    dataHandler: {
      loadData: vi.fn().mockResolvedValue({ stackTraceLimit: savedValue }),
      saveData: vi.fn().mockResolvedValue(undefined)
    },
    pluginEventSource: createListeningPluginEventSource()
  });
  await component.loadWithPromises();
  return component.settings.stackTraceLimit;
}

describe('PluginSettingsComponent', () => {
  it('should create default settings as PluginSettings instance', () => {
    const dataHandler: DataHandler = {
      loadData: vi.fn().mockResolvedValue(null),
      saveData: vi.fn().mockResolvedValue(undefined)
    };
    const component = new PluginSettingsComponent({
      dataHandler,
      pluginEventSource: createPluginEventSource()
    });
    const defaultSettings = component.defaultSettings;
    expect(defaultSettings).toEqual(new PluginSettings());
  });

  it('should have correct default setting values', () => {
    const dataHandler: DataHandler = {
      loadData: vi.fn().mockResolvedValue(null),
      saveData: vi.fn().mockResolvedValue(undefined)
    };
    const component = new PluginSettingsComponent({
      dataHandler,
      pluginEventSource: createPluginEventSource()
    });
    const settings = component.defaultSettings;
    expect(settings.shouldIncludeAsyncLongStackTraces).toBe(false);
    expect(settings.shouldIncludeInternalStackFrames).toBe(false);
    expect(settings.shouldIncludeLongStackTraces).toBe(true);
    expect(settings.shouldIncludeTimedOutTasksDetails).toBe(true);
    expect(settings.shouldTimeoutLongRunningTasks).toBe(true);
    expect(settings.stackTraceLimit).toBe(100);
  });

  it('should keep a saved stack trace limit of 0 or more', async () => {
    const SAVED_LIMIT = 250;
    expect(await loadStackTraceLimit(SAVED_LIMIT)).toBe(SAVED_LIMIT);
    expect(await loadStackTraceLimit(0)).toBe(0);
  });

  it('should repair a negative saved stack trace limit to the default', async () => {
    const DRIFTED_LIMIT = -33_482;
    expect(await loadStackTraceLimit(DRIFTED_LIMIT)).toBe(new PluginSettings().stackTraceLimit);
  });

  it('should rewrite a negative stored stack trace limit to the default in data.json', async () => {
    const DRIFTED_LIMIT = -37_862;
    const saveData = vi.fn().mockResolvedValue(undefined);
    const component = new PluginSettingsComponent({
      dataHandler: {
        loadData: vi.fn().mockResolvedValue({ stackTraceLimit: DRIFTED_LIMIT }),
        saveData
      },
      pluginEventSource: createListeningPluginEventSource()
    });
    await component.loadWithPromises();
    const defaultLimit = new PluginSettings().stackTraceLimit;
    expect(component.settings.stackTraceLimit).toBe(defaultLimit);
    expect(saveData).toHaveBeenCalledTimes(1);
    expect(saveData).toHaveBeenCalledWith(expect.objectContaining({ stackTraceLimit: defaultLimit }));
  });

  it('should not rewrite data.json for a valid stored stack trace limit', async () => {
    const SAVED_LIMIT = 250;
    // A complete record, as this version writes it, so only a repair could make the loaded record differ from it.
    const firstSaveData = vi.fn().mockResolvedValue(undefined);
    const firstComponent = new PluginSettingsComponent({
      dataHandler: {
        loadData: vi.fn().mockResolvedValue({ stackTraceLimit: SAVED_LIMIT }),
        saveData: firstSaveData
      },
      pluginEventSource: createListeningPluginEventSource()
    });
    await firstComponent.loadWithPromises();
    const storedRecord: unknown = firstSaveData.mock.lastCall?.[0];

    const saveData = vi.fn().mockResolvedValue(undefined);
    const component = new PluginSettingsComponent({
      dataHandler: {
        loadData: vi.fn().mockResolvedValue(storedRecord),
        saveData
      },
      pluginEventSource: createListeningPluginEventSource()
    });
    await component.loadWithPromises();
    expect(component.settings.stackTraceLimit).toBe(SAVED_LIMIT);
    expect(saveData).not.toHaveBeenCalled();
  });

  it('should reject a negative stack trace limit typed into the settings tab', async () => {
    const component = new PluginSettingsComponent({
      dataHandler: {
        loadData: vi.fn().mockResolvedValue(null),
        saveData: vi.fn().mockResolvedValue(undefined)
      },
      pluginEventSource: createListeningPluginEventSource()
    });
    await component.loadWithPromises();
    expect(await component.setProperty('stackTraceLimit', -1)).toBe('The stack trace limit must be a whole number, 0 or greater');
    expect(component.settings.stackTraceLimit).toBe(new PluginSettings().stackTraceLimit);
  });

  it('should repair a fractional saved stack trace limit to the default', async () => {
    const FRACTIONAL_LIMIT = 12.5;
    expect(await loadStackTraceLimit(FRACTIONAL_LIMIT)).toBe(new PluginSettings().stackTraceLimit);
  });

  it('should reject a negative or fractional delay and accept a whole one', async () => {
    const component = new PluginSettingsComponent({
      dataHandler: {
        loadData: vi.fn().mockResolvedValue(null),
        saveData: vi.fn().mockResolvedValue(undefined)
      },
      pluginEventSource: createListeningPluginEventSource()
    });
    await component.loadWithPromises();
    const DELAY_MESSAGE = 'The delay must be a whole number of milliseconds, 0 or greater';
    const FRACTIONAL_DELAY = 1.5;
    const WHOLE_DELAY = 500;
    for (
      const propertyName of [
        'defaultPluginLoadDelayInMilliseconds',
        'layoutLoadDelayInMilliseconds',
        'metadataCacheInitializeDelayInMilliseconds',
        'pluginLoadDelayJitterInMilliseconds'
      ] as const
    ) {
      expect(await component.setProperty(propertyName, -1)).toBe(DELAY_MESSAGE);
      expect(await component.setProperty(propertyName, FRACTIONAL_DELAY)).toBe(DELAY_MESSAGE);
      expect(await component.setProperty(propertyName, WHOLE_DELAY)).toBe('');
    }
    expect(await component.setProperty('pluginLoadDelaysInMilliseconds', { 'plugin-a': -1 })).toBe(DELAY_MESSAGE);
    expect(await component.setProperty('pluginLoadDelaysInMilliseconds', { 'plugin-a': WHOLE_DELAY })).toBe('');
  });
});
