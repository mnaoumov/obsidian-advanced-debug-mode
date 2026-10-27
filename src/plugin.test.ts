import type { CommandHandlerComponent } from '@mnaoumov/obsidian-lib/command-handlers/command-handler-component';
import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import { OpenDemoVaultCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-demo-vault-command-handler';
import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import { PluginSettingsTabComponent } from '@mnaoumov/obsidian-lib/components/plugin-settings-tab-component';
import {
  noop,
  noopAsync
} from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { Component } from 'obsidian';
import {
  App,
  WorkspaceLeaf
} from 'obsidian-test-mocks/obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { DebugSwitchesComponent } from './debug-controls/debug-switches-component.ts';
import { DevToolsComponent } from './dev-tools/dev-tools-component.ts';
import { ErrorStackTraceLimitComponent } from './long-stack-traces/error-stack-trace-limit-component.ts';
import { LongStackTracesComponent } from './long-stack-traces/long-stack-traces-component.ts';
import { AbortSharedOperationCommandHandler } from './operations/abort-shared-operation-command.ts';
import { LongRunningTasksComponent } from './operations/long-running-tasks-component.ts';
import { OpenPluginDebugMessagesViewCommandHandler } from './plugin-debug-messages/open-plugin-debug-messages-view-command.ts';
import {
  openPluginDebugMessagesView,
  PLUGIN_DEBUG_MESSAGES_VIEW_TYPE,
  PluginDebugMessagesView
} from './plugin-debug-messages/plugin-debug-messages-view.ts';
import { PluginDebugMessages } from './plugin-debug-messages/plugin-debug-messages.ts';
import { TogglePluginDebugMessagesCommandHandler } from './plugin-debug-messages/toggle-plugin-debug-messages-command.ts';
import { PluginSettingsComponent } from './settings/plugin-settings-component.ts';
import { PluginSettingsTab } from './settings/plugin-settings-tab.ts';

// --- Collaborator obsidian-lib components added as children: stub as constructor spies that return a real Component so the real addChild lifecycle can load them while capturing constructor args. ---

vi.mock('@mnaoumov/obsidian-lib/data-handler', () => ({
  PluginDataHandler: vi.fn()
}));

vi.mock('@mnaoumov/obsidian-lib/components/plugin-settings-tab-component', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  PluginSettingsTabComponent: vi.fn(function pluginSettingsTabComponentStub() {
    return new Component();
  })
}));

// --- Collaborator obsidian-lib components NOT added as children: bare constructor spies. ---

vi.mock('@mnaoumov/obsidian-lib/command-handlers/open-demo-vault-command-handler', () => ({
  OpenDemoVaultCommandHandler: vi.fn()
}));

vi.mock('@mnaoumov/obsidian-lib/command-handlers/open-settings-command-handler', () => ({
  OpenSettingsCommandHandler: vi.fn()
}));

vi.mock('@mnaoumov/obsidian-lib/plugin/plugin-event-source', () => ({
  PluginEventSourceImpl: vi.fn()
}));

// --- The plugin's OWN sibling modules. ---

vi.mock('./operations/abort-shared-operation-command.ts', () => ({
  AbortSharedOperationCommandHandler: vi.fn()
}));

vi.mock('./plugin-debug-messages/open-plugin-debug-messages-view-command.ts', () => ({
  OpenPluginDebugMessagesViewCommandHandler: vi.fn()
}));

vi.mock('./dev-tools/toggle-dev-tools-button-command.ts', () => ({
  ToggleDevToolsButtonCommandHandler: vi.fn()
}));

vi.mock('./plugin-debug-messages/toggle-plugin-debug-messages-command.ts', () => ({
  TogglePluginDebugMessagesCommandHandler: vi.fn()
}));

vi.mock('./debug-controls/debug-mode.ts', () => ({
  DebugMode: vi.fn()
}));

vi.mock('./dev-tools/dev-tools-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  DevToolsComponent: vi.fn(function devToolsComponentStub() {
    return new Component();
  })
}));

vi.mock('./debug-controls/emulate-mobile-mode.ts', () => ({
  EmulateMobileMode: vi.fn()
}));

vi.mock('./debug-controls/debug-switches-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  DebugSwitchesComponent: vi.fn(function debugSwitchesComponentStub() {
    return new Component();
  })
}));

vi.mock('./long-stack-traces/error-stack-trace-limit-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  ErrorStackTraceLimitComponent: vi.fn(function errorStackTraceLimitComponentStub() {
    return new Component();
  })
}));

vi.mock('./operations/long-running-tasks-component.ts', () => ({
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

vi.mock('./plugin-debug-messages/plugin-debug-messages-view.ts', async (importOriginal) => ({
  ...await importOriginal<typeof import('./plugin-debug-messages/plugin-debug-messages-view.ts')>(),
  openPluginDebugMessagesView: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('./plugin-debug-messages/plugin-debug-messages.ts', () => ({
  PluginDebugMessages: vi.fn()
}));

vi.mock('./settings/plugin-settings-component.ts', () => ({
  // eslint-disable-next-line prefer-arrow-callback -- a vi.fn constructor stub must be a function (not an arrow) so `new` works and returns a loadable Component.
  PluginSettingsComponent: vi.fn(function pluginSettingsComponentStub() {
    // A ComponentEx, not a plain Component: onloadImpl awaits its `loadWithPromises`.
    return new ComponentEx();
  })
}));

vi.mock('./settings/plugin-settings-tab.ts', () => ({
  PluginSettingsTab: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { Plugin } from './plugin.ts';

// Seeded THROUGH the base accessors: the components live in a bag behind
// them, so writing the old `_`-prefixed backing field no longer feeds the getter, which throws when unset.
interface PluginInternals {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Tests seed the base component before calling onloadImpl directly.
  commandHandlerComponent: CommandHandlerComponent;
  readonly onloadImpl: () => Promise<void>;
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Tests seed the notice component before calling onloadImpl directly.
  pluginNoticeComponent: PluginNoticeComponent;
}

interface VaultWithAdapter {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Tests replace the vault adapter to exercise desktop-specific initialization.
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
    internals.commandHandlerComponent = strictProxy<CommandHandlerComponent>({ registerCommandHandlers });
    // The base PluginBase.onload also seeds pluginNoticeComponent before onloadImpl; seed it here so the OpenDemoVaultCommandHandler can read it via the non-null getter.
    internals.pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});
    const addChildSpy = vi.spyOn(plugin, 'addChild');
    const registerViewSpy = vi.spyOn(plugin, 'registerView').mockImplementation(noop);
    const addRibbonIconSpy = vi.spyOn(plugin, 'addRibbonIcon');

    // Awaited because registerCommandHandlers is async.
    // So onloadImpl suspends on it, and the components wired after it are not constructed yet.
    await internals.onloadImpl();

    expect(plugin).toBeInstanceOf(Plugin);
    expect(PluginSettingsComponent).toHaveBeenCalledOnce();
    expect(PluginSettingsTabComponent).toHaveBeenCalledOnce();
    expect(PluginSettingsTab).toHaveBeenCalledOnce();
    expect(DevToolsComponent).toHaveBeenCalledOnce();
    expect(registerCommandHandlers).toHaveBeenCalledOnce();
    // The handlers are built lazily by a factory, so build them here.
    registerCommandHandlers.mock.calls[0]?.[0]();
    expect(OpenDemoVaultCommandHandler).toHaveBeenCalledOnce();
    // The abort command is the only hotkey-bindable way to reach the shared abort controller, so its
    // registration is the thing that makes the feature exist at all.
    expect(AbortSharedOperationCommandHandler).toHaveBeenCalledOnce();
    // The command and the settings rows share one instance, so both read and write the same namespaces.
    expect(PluginDebugMessages).toHaveBeenCalledOnce();
    expect(TogglePluginDebugMessagesCommandHandler).toHaveBeenCalledWith(expect.objectContaining({
      pluginDebugMessages: vi.mocked(PluginDebugMessages).mock.instances[0]
    }));
    expect(PluginSettingsTab).toHaveBeenCalledWith(expect.objectContaining({
      pluginDebugMessages: vi.mocked(PluginDebugMessages).mock.instances[0]
    }));
    expect(OpenPluginDebugMessagesViewCommandHandler).toHaveBeenCalledWith(app);
    // The view, its ribbon icon and the settings row all reach the same view type.
    expect(registerViewSpy).toHaveBeenCalledWith(PLUGIN_DEBUG_MESSAGES_VIEW_TYPE, expect.any(Function));
    const view = registerViewSpy.mock.calls[0]?.[1](WorkspaceLeaf.create2__(App.createConfigured__()).asOriginalType3__());
    expect(view).toBeInstanceOf(PluginDebugMessagesView);
    expect(addRibbonIconSpy).toHaveBeenCalledWith('bug', 'Open plugin debug messages', expect.any(Function));
    addRibbonIconSpy.mock.calls[0]?.[2](new MouseEvent('click'));
    await vi.mocked(PluginSettingsTab).mock.calls[0]?.[0].openPluginDebugMessagesView();
    await waitForAllAsyncOperations();
    expect(openPluginDebugMessagesView).toHaveBeenCalledTimes(2);
    expect(openPluginDebugMessagesView).toHaveBeenCalledWith(app);
    expect(LongRunningTasksComponent).toHaveBeenCalledOnce();
    // Constructing it is not enough: it was constructed but never added for a while, so its FileSystemAdapter patches never loaded. Compared by identity, as every component stub is structurally an empty Component.
    expect(addChildSpy.mock.calls.map(([child]) => child)).toContain(vi.mocked(LongRunningTasksComponent).mock.results[0]?.value);
    expect(ErrorStackTraceLimitComponent).toHaveBeenCalledOnce();
    expect(LongStackTracesComponent).toHaveBeenCalledOnce();
    expect(addChildSpy.mock.calls.map(([child]) => child)).toContain(vi.mocked(DebugSwitchesComponent).mock.results[0]?.value);
  });

  it('should not wire the long-running-tasks component when the vault has no desktop adapter', async () => {
    // On mobile the adapter is a CapacitorAdapter, which has none of the `queue`/`thingsHappening`
    // methods that component patches. Loading it there leaves the vault broken and Obsidian never
    // reaches layout-ready, so the plugin does not finish loading at all.
    castTo<VaultWithAdapter>(app.vault).adapter = { getName: (): string => 'capacitor' };

    const plugin = new Plugin(app, manifest);
    const internals = castTo<PluginInternals>(plugin);
    internals.commandHandlerComponent = strictProxy<CommandHandlerComponent>({ registerCommandHandlers: vi.fn<CommandHandlerComponent['registerCommandHandlers']>() });
    internals.pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});

    await internals.onloadImpl();

    expect(LongRunningTasksComponent).not.toHaveBeenCalled();
    // The rest of the plugin still loads.
    expect(ErrorStackTraceLimitComponent).toHaveBeenCalledOnce();
    expect(LongStackTracesComponent).toHaveBeenCalledOnce();
  });

  it('should await the settings load before wiring the components that read the settings', async () => {
    const plugin = new Plugin(app, manifest);
    const internals = castTo<PluginInternals>(plugin);
    internals.commandHandlerComponent = strictProxy<CommandHandlerComponent>({ registerCommandHandlers: vi.fn<CommandHandlerComponent['registerCommandHandlers']>() });
    internals.pluginNoticeComponent = strictProxy<PluginNoticeComponent>({});

    // Hold the settings load open: a child loads as it is added, so without the await the components below would be wired from the default settings while this load is still in flight.
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
