import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';

import {
  App,
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

import { PluginSettingsComponent } from '../plugin-settings-component.ts';
import { LongStackTracesComponent } from './long-stack-traces-component.ts';

function createDataHandler(): DataHandler {
  return {
    loadData: vi.fn().mockResolvedValue(null),
    saveData: vi.fn().mockResolvedValue(undefined)
  };
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
    const pluginSettingsComponent = new PluginSettingsComponent(createDataHandler());
    const app = new App();

    expect(() => {
      new LongStackTracesComponent({
        app,
        pluginId: 'test-plugin',
        pluginSettingsComponent
      });
    }).not.toThrow();
  });

  // Note: LongStackTracesComponent extends AsyncComponentBase which uses
  // `_loaded` / `_children` internal properties. The obsidian-test-mocks
  // Component mock uses `loaded__` / `children__` with strict proxy,
  // Making load() incompatible in unit tests. Load testing is deferred to
  // Integration tests where the real Obsidian runtime is available.
});
