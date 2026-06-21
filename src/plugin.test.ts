import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import { Component } from 'obsidian';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { CommandHandlerComponent } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler-component';
import { MenuEventRegistrarComponent } from 'obsidian-dev-utils/obsidian/components/menu-event-registrar-component';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { App } from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { DevToolsComponent } from './dev-tools-component.ts';
import { ErrorStackTraceLimitComponent } from './error-stack-trace-limit-component.ts';
import { LongRunningTasksComponent } from './long-running-tasks-component.ts';
import { LongStackTracesComponent } from './long-stack-traces/long-stack-traces-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

// --- Collaborator dev-utils components added as children: stub as constructor spies that return a real Component so the real addChild lifecycle can load them while capturing constructor args. ---

vi.mock('obsidian-dev-utils/obsidian/command-handlers/command-handler-component', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  CommandHandlerComponent: vi.fn(function commandHandlerComponentStub() {
    return new Component();
  })
}));

vi.mock('obsidian-dev-utils/obsidian/components/menu-event-registrar-component', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  MenuEventRegistrarComponent: vi.fn(function menuEventRegistrarComponentStub() {
    return new Component();
  })
}));

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  PluginSettingsTabComponent: vi.fn(function pluginSettingsTabComponentStub() {
    return new Component();
  })
}));

// --- Collaborator dev-utils components NOT added as children: bare constructor spies. ---

vi.mock('obsidian-dev-utils/obsidian/active-file-provider', () => ({
  AppActiveFileProvider: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/command-handlers/open-settings-command-handler', () => ({
  OpenSettingsCommandHandler: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/command-registrar', () => ({
  PluginCommandRegistrar: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/data-handler', () => ({
  PluginDataHandler: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/plugin/plugin-event-source', () => ({
  PluginEventSourceImpl: vi.fn()
}));

// --- The plugin's OWN sibling modules. ---

vi.mock('./command-handlers/toggle-dev-tools-button-command.ts', () => ({
  ToggleDevToolsButtonCommandHandler: vi.fn()
}));

vi.mock('./debug-mode.ts', () => ({
  DebugMode: vi.fn()
}));

vi.mock('./dev-tools-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  DevToolsComponent: vi.fn(function devToolsComponentStub() {
    return new Component();
  })
}));

vi.mock('./emulate-mobile-mode.ts', () => ({
  EmulateMobileMode: vi.fn()
}));

vi.mock('./error-stack-trace-limit-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  ErrorStackTraceLimitComponent: vi.fn(function errorStackTraceLimitComponentStub() {
    return new Component();
  })
}));

vi.mock('./long-running-tasks-component.ts', () => ({
  LongRunningTasksComponent: vi.fn()
}));

vi.mock('./long-stack-traces/long-stack-traces-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  LongStackTracesComponent: vi.fn(function longStackTracesComponentStub() {
    return new Component();
  })
}));

vi.mock('./plugin-settings-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  PluginSettingsComponent: vi.fn(function pluginSettingsComponentStub() {
    return new Component();
  })
}));

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

interface AppGlobal {
  app: AppOriginal;
}

const STRICT_PROXY_TARGET_SYMBOL = Symbol.for('strictProxyTarget');

const manifest = castTo<PluginManifest>({
  author: 'test',
  description: 'test',
  id: 'advanced-debug-mode',
  minAppVersion: '1.0.0',
  name: 'Advanced Debug Mode',
  version: '1.0.0'
});

let app: AppOriginal;

beforeEach(() => {
  vi.clearAllMocks();
  const appMock = App.createConfigured__();
  appMock.workspace.onLayoutReady = vi.fn((cb: () => void) => {
    cb();
  });
  app = appMock.asOriginalType__();

  // Seed the obsidianDevUtilsState holder on the raw target behind the strict-proxy App so the real getObsidianDevUtilsState can read/write it (the proxy throws on first access to an unassigned property).
  seedOnRawTarget(app, 'obsidianDevUtilsState', {});

  // Expose the app as the global instance so dev-utils helpers that resolve shared state without an explicit app argument read/write the same seeded holder.
  castTo<AppGlobal>(window).app = app;
});

function seedOnRawTarget(strictProxiedObject: object, key: string, value: unknown): void {
  const proxyWithTarget = castTo<Partial<Record<symbol, object>>>(strictProxiedObject);
  const rawTarget = proxyWithTarget[STRICT_PROXY_TARGET_SYMBOL] ?? strictProxiedObject;
  castTo<Record<string, unknown>>(rawTarget)[key] = value;
}

describe('Plugin', () => {
  it('should wire up all child components on load', async () => {
    const plugin = new Plugin(app, manifest);
    await plugin.onload();

    expect(plugin).toBeInstanceOf(Plugin);
    expect(PluginSettingsComponent).toHaveBeenCalledOnce();
    expect(PluginSettingsTabComponent).toHaveBeenCalledOnce();
    expect(PluginSettingsTab).toHaveBeenCalledOnce();
    expect(DevToolsComponent).toHaveBeenCalledOnce();
    expect(MenuEventRegistrarComponent).toHaveBeenCalledOnce();
    expect(CommandHandlerComponent).toHaveBeenCalledOnce();
    expect(LongRunningTasksComponent).toHaveBeenCalledOnce();
    expect(ErrorStackTraceLimitComponent).toHaveBeenCalledOnce();
    expect(LongStackTracesComponent).toHaveBeenCalledOnce();
  });
});
