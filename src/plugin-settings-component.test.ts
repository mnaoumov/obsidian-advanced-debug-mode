import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettings } from './plugin-settings.ts';

function createPluginEventSource(): PluginEventSource {
  return strictProxy<PluginEventSource>({});
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
});
