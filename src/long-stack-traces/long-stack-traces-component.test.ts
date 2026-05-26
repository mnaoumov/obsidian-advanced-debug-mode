import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import type { PluginEventSource } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import {
  App,
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
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'isDesktop', { configurable: true, value: savedIsDesktop });
  });

  it('should construct without errors', () => {
    const pluginSettingsComponent = new PluginSettingsComponent({
      dataHandler: createDataHandler(),
      pluginEventSource: createPluginEventSource()
    });
    const app = new App();

    expect(() => {
      new LongStackTracesComponent({
        app,
        pluginId: 'test-plugin',
        pluginSettingsComponent
      });
    }).not.toThrow();
  });

  // Note: LongStackTracesComponent extends ComponentEx which uses
  // `_loaded` / `_children` internal properties. The obsidian-test-mocks
  // Component mock uses `loaded__` / `children__` with strict proxy,
  // Making load() incompatible in unit tests. Load testing is deferred to
  // Integration tests where the real Obsidian runtime is available.
});
