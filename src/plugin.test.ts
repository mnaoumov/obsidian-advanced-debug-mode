import type { PluginManifest } from 'obsidian';

import {
  App,
  FileSystemAdapter
} from 'obsidian';
import {
  noop,
  noopAsync
} from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { ensureGenericObject } from 'obsidian-dev-utils/type-guards';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

vi.mock('eruda', () => ({
  default: {
    init: vi.fn()
  }
}));

const addedChildren: unknown[] = [];

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin', () => ({
  PluginBase: class MockPluginBase {
    public app: unknown;
    public manifest: unknown;

    public constructor(app: unknown, manifest: unknown) {
      this.app = app;
      this.manifest = manifest;
    }

    public addChild<T>(child: T): T {
      addedChildren.push(child);
      return child;
    }

    public onload(): Promise<void> {
      this.onloadImpl();
      return noopAsync();
    }

    protected onloadImpl(): void {
      noop();
    }
  }
}));

vi.mock('obsidian-dev-utils/debug', () => ({
  getDebugController: vi.fn(() => ({}))
}));

vi.mock('obsidian-dev-utils/obsidian/active-file-provider', () => ({
  AppActiveFileProvider: class MockAppActiveFileProvider {
    public constructor(public readonly _app: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/command-handlers/command-handler-component', () => ({
  CommandHandlerComponent: class MockCommandHandlerComponent {
    public constructor(public readonly _params: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/command-handlers/open-settings-command-handler', () => ({
  OpenSettingsCommandHandler: class MockOpenSettingsCommandHandler {
    public constructor(public readonly _params: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/command-registrar', () => ({
  PluginCommandRegistrar: class MockPluginCommandRegistrar {
    public constructor(public readonly _plugin: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/components/menu-event-registrar-component', () => ({
  MenuEventRegistrarComponent: class MockMenuEventRegistrarComponent {
    public constructor(public readonly _app: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', () => ({
  PluginSettingsTabComponent: class MockPluginSettingsTabComponent {
    public constructor(public readonly _params: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/data-handler', () => ({
  PluginDataHandler: class MockPluginDataHandler {
    public constructor(public readonly _plugin: unknown) {}
  }
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin-event-source', () => ({
  PluginEventSourceImpl: class MockPluginEventSourceImpl {
    public constructor(public readonly _plugin: unknown) {}
  }
}));

vi.mock('./command-handlers/toggle-dev-tools-button-command.ts', () => ({
  ToggleDevToolsButtonCommandHandler: class MockToggleDevToolsButtonCommandHandler {
    public constructor(public readonly _devToolsComponent: unknown) {}
  }
}));

vi.mock('./debug-mode.ts', () => ({
  DebugMode: class MockDebugMode {
    public constructor(public readonly _app: unknown) {}
  }
}));

vi.mock('./dev-tools-component.ts', () => ({
  DevToolsComponent: class MockDevToolsComponent {
    public constructor(public readonly _params?: unknown) {}
  }
}));

vi.mock('./emulate-mobile-mode.ts', () => ({
  EmulateMobileMode: class MockEmulateMobileMode {
    public constructor(public readonly _app: unknown) {}
  }
}));

vi.mock('./error-stack-trace-limit-component.ts', () => ({
  ErrorStackTraceLimitComponent: class MockErrorStackTraceLimitComponent {
    public constructor(public readonly _params?: unknown) {}
  }
}));

vi.mock('./long-running-tasks-component.ts', () => ({
  LongRunningTasksComponent: class MockLongRunningTasksComponent {
    public constructor(public readonly _params: unknown) {}
  }
}));

vi.mock('./long-stack-traces/long-stack-traces-component.ts', () => ({
  LongStackTracesComponent: class MockLongStackTracesComponent {
    public constructor(public readonly _params: unknown) {}
  }
}));

vi.mock('./plugin-settings-component.ts', () => ({
  PluginSettingsComponent: class MockPluginSettingsComponent {
    public constructor(public readonly _params: unknown) {}
  }
}));

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: class MockPluginSettingsTab {
    public constructor(public readonly _params: unknown) {}
  }
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

describe('Plugin', () => {
  it('should export Plugin class', () => {
    expect(Plugin).toBeDefined();
    expect(typeof Plugin).toBe('function');
  });

  it('should construct with app and manifest', () => {
    const app = new App();

    const FileSystemAdapterConstructor = castTo<new (basePath: string) => FileSystemAdapter>(FileSystemAdapter);
    const adapter = new FileSystemAdapterConstructor('');
    adapter.promise = noopAsync();
    adapter.killLastAction = vi.fn();
    adapter.thingsHappening = vi.fn();
    adapter.queue = vi.fn();

    app.vault.adapter = adapter;
    ensureGenericObject(app)['obsidianDevUtilsState'] = {};

    // eslint-disable-next-line @typescript-eslint/dot-notation, @typescript-eslint/no-deprecated -- Test setup: window.app is deprecated but required for plugin initialization.
    ensureGenericObject(window)['app'] = app;

    const manifest = {
      author: 'test',
      description: 'Test plugin',
      id: 'advanced-debug-mode',
      minAppVersion: '0.0.0',
      name: 'Advanced Debug Mode',
      version: '1.0.0'
    };

    expect(() => {
      new Plugin(app, manifest);
    }).not.toThrow();

    interface WindowWithApp {
      app: App;
    }

    delete (window as Partial<WindowWithApp>).app;
  });
});

describe('Plugin.onload', () => {
  beforeEach(() => {
    addedChildren.length = 0;
    vi.clearAllMocks();
  });

  it('should add all child components on load', async () => {
    const plugin = createPlugin();
    await plugin.onload();
    const EXPECTED_CHILD_COUNT = 7;
    expect(addedChildren).toHaveLength(EXPECTED_CHILD_COUNT);
  });

  function createPlugin(): Plugin {
    const app = castTo<App>({
      vault: {
        adapter: {}
      }
    });
    const manifest = castTo<PluginManifest>({
      id: 'advanced-debug-mode',
      name: 'Advanced Debug Mode'
    });
    return new Plugin(app, manifest);
  }
});
