import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';
import type { CommandHandlerComponent } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler-component';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';

import { Component } from 'obsidian';
import {
  noop,
  noopAsync
} from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { OpenDemoVaultCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
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

vi.mock('obsidian-dev-utils/obsidian/components/plugin-settings-tab-component', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  PluginSettingsTabComponent: vi.fn(function pluginSettingsTabComponentStub() {
    return new Component();
  })
}));

// --- Collaborator dev-utils components NOT added as children: bare constructor spies. ---

vi.mock('obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler', () => ({
  OpenDemoVaultCommandHandler: vi.fn()
}));

vi.mock('obsidian-dev-utils/obsidian/command-handlers/open-settings-command-handler', () => ({
  OpenSettingsCommandHandler: vi.fn()
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
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  LongRunningTasksComponent: vi.fn(function longRunningTasksComponentStub() {
    return new Component();
  })
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
    // A ComponentEx, not a plain Component: onloadImpl awaits its `loadWithPromises`.
    return new ComponentEx();
  })
}));

vi.mock('./plugin-settings-tab.ts', () => ({
  PluginSettingsTab: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

interface PluginInternals {
  _commandHandlerComponent: CommandHandlerComponent;
  _pluginNoticeComponent: PluginNoticeComponent;
  onloadImpl(): Promise<void>;
}

interface VaultWithAdapter {
  adapter: unknown;
}

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
  app = App.createConfigured__().asOriginalType__();
});

describe('Plugin', () => {
  it('should wire up all child components on load', async () => {
    const plugin = new Plugin(app, manifest);
    const internals = castTo<PluginInternals>(plugin);
    const registerCommandHandlers = vi.fn<CommandHandlerComponent['registerCommandHandlers']>();
    // The base PluginBase.onload seeds and pre-wires commandHandlerComponent before onloadImpl; seed it here so onloadImpl can register the plugin's command handlers on it.
    internals._commandHandlerComponent = strictProxy<CommandHandlerComponent>({ registerCommandHandlers });
    // The base PluginBase.onload also seeds pluginNoticeComponent before onloadImpl; seed it here so the OpenDemoVaultCommandHandler can read it via the non-null getter.
    internals._pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});
    const addChildSpy = vi.spyOn(plugin, 'addChild');

    // Awaited because registerCommandHandlers is async since obsidian-dev-utils 90.0.0.
    // So onloadImpl suspends on it, and the components wired after it are not constructed yet.
    await internals.onloadImpl();

    expect(plugin).toBeInstanceOf(Plugin);
    expect(PluginSettingsComponent).toHaveBeenCalledOnce();
    expect(PluginSettingsTabComponent).toHaveBeenCalledOnce();
    expect(PluginSettingsTab).toHaveBeenCalledOnce();
    expect(DevToolsComponent).toHaveBeenCalledOnce();
    expect(registerCommandHandlers).toHaveBeenCalledOnce();
    // Since obsidian-dev-utils 89.0.0 the handlers are built lazily by a factory, so build them here.
    registerCommandHandlers.mock.calls[0]?.[0]();
    expect(OpenDemoVaultCommandHandler).toHaveBeenCalledOnce();
    expect(LongRunningTasksComponent).toHaveBeenCalledOnce();
    // Constructing it is not enough: it was constructed but never added for a while, so its FileSystemAdapter patches never loaded. Compared by identity, as every component stub is structurally an empty Component.
    expect(addChildSpy.mock.calls.map(([child]) => child)).toContain(vi.mocked(LongRunningTasksComponent).mock.results[0]?.value);
    expect(ErrorStackTraceLimitComponent).toHaveBeenCalledOnce();
    expect(LongStackTracesComponent).toHaveBeenCalledOnce();
  });

  it('should not wire the long-running-tasks component when the vault has no desktop adapter', async () => {
    // On mobile the adapter is a CapacitorAdapter, which has none of the `queue`/`thingsHappening`
    // Methods that component patches. Loading it there leaves the vault broken and Obsidian never
    // Reaches layout-ready, so the plugin does not finish loading at all.
    castTo<VaultWithAdapter>(app.vault).adapter = { getName: (): string => 'capacitor' };

    const plugin = new Plugin(app, manifest);
    const internals = castTo<PluginInternals>(plugin);
    internals._commandHandlerComponent = strictProxy<CommandHandlerComponent>({ registerCommandHandlers: vi.fn<CommandHandlerComponent['registerCommandHandlers']>() });
    internals._pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});

    await internals.onloadImpl();

    expect(LongRunningTasksComponent).not.toHaveBeenCalled();
    // The rest of the plugin still loads.
    expect(ErrorStackTraceLimitComponent).toHaveBeenCalledOnce();
    expect(LongStackTracesComponent).toHaveBeenCalledOnce();
  });

  it('should await the settings load before wiring the components that read the settings', async () => {
    const plugin = new Plugin(app, manifest);
    const internals = castTo<PluginInternals>(plugin);
    internals._commandHandlerComponent = strictProxy<CommandHandlerComponent>({ registerCommandHandlers: vi.fn<CommandHandlerComponent['registerCommandHandlers']>() });
    internals._pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});

    // Hold the settings load open: since obsidian-dev-utils 90 a child loads as it is added, so without the await the components below would be wired from the default settings while this load is still in flight.
    const pluginSettingsComponent = new ComponentEx();
    let resolveSettingsLoad: () => void = noop;
    const settingsLoadPromise = new Promise<void>((resolve) => {
      resolveSettingsLoad = resolve;
    });
    vi.spyOn(pluginSettingsComponent, 'loadWithPromises').mockReturnValue(settingsLoadPromise);
    // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns this instance.
    vi.mocked(PluginSettingsComponent).mockImplementation(function pluginSettingsComponentStub() {
      return castTo<PluginSettingsComponent>(pluginSettingsComponent);
    });

    const onloadImplPromise = internals.onloadImpl();
    await noopAsync();

    expect(LongStackTracesComponent).not.toHaveBeenCalled();

    resolveSettingsLoad();
    await onloadImplPromise;

    expect(LongStackTracesComponent).toHaveBeenCalledOnce();
  });
});
