import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type {
  App,
  Plugin,
  PluginManifest
} from 'obsidian';
import type { Mock } from 'vitest';

import { noopAsync } from '@mnaoumov/typescript-lib/function';
import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';
import {
  PluginLoadDelayMode,
  PluginLoadDelayPosition
} from '../settings/plugin-settings.ts';
import { PluginLoadDelaysComponent } from './plugin-load-delays-component.ts';

const OWN_ID = 'advanced-debug-mode';
const DELAY_MS = 1000;

interface Context {
  readonly app: TestApp;
  readonly component: PluginLoadDelaysComponent;
  readonly loadedPlugin: Plugin;
  readonly originalLoadPlugin: Mock<(id: string) => Promise<Plugin>>;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly showNotice: Mock<PluginNoticeComponent['showNotice']>;
}

interface CreateContextOptions {
  readonly enabledPluginIds?: string[];
  readonly isLayoutReady?: boolean;
  readonly loadedPluginIds?: string[];
  readonly settings?: Record<string, unknown>;
}

interface TestApp {
  readonly commands: TestCommands;
  readonly metadataCache: TestMetadataCache;
  readonly plugins: TestPlugins;
  readonly workspace: TestWorkspace;
}

interface TestCommands {
  readonly executeCommandById: Mock<(id: string) => boolean>;
}

interface TestMetadataCache {
  readonly initialize: Mock<() => Promise<void>>;
}

interface TestPlugins {
  readonly enabledPlugins: Set<string>;
  readonly loadPlugin: (id: string) => Promise<Plugin>;
  readonly manifests: Record<string, PluginManifest>;
  readonly plugins: Record<string, Plugin>;
  readonly saveConfig: Mock<() => Promise<void>>;
}

interface TestWorkspace {
  readonly layoutReady: boolean;
  readonly loadLayout: Mock<() => Promise<void>>;
}

async function createContext(options: CreateContextOptions = {}): Promise<Context> {
  const loadedPlugin = castTo<Plugin>({ id: 'loaded' });
  const originalLoadPlugin = vi.fn(async (_id: string) => {
    await noopAsync();
    return loadedPlugin;
  });
  const app: TestApp = {
    commands: { executeCommandById: vi.fn(() => true) },
    metadataCache: { initialize: vi.fn(noopAsync) },
    plugins: {
      enabledPlugins: new Set(options.enabledPluginIds ?? [OWN_ID]),
      loadPlugin: originalLoadPlugin,
      manifests: {
        [OWN_ID]: createManifest(OWN_ID, 'Advanced Debug Mode'),
        'plugin-a': createManifest('plugin-a', 'Alpha')
      },
      plugins: Object.fromEntries((options.loadedPluginIds ?? [OWN_ID]).map((id) => [id, castTo<Plugin>({ id })])),
      saveConfig: vi.fn(noopAsync)
    },
    workspace: { layoutReady: options.isLayoutReady ?? false, loadLayout: vi.fn(noopAsync) }
  };

  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler: {
      loadData: vi.fn().mockResolvedValue(options.settings ?? null),
      saveData: vi.fn().mockResolvedValue(undefined)
    },
    pluginEventSource: strictProxy<PluginEventSource>({
      offref: vi.fn(),
      on: vi.fn().mockReturnValue({})
    })
  });
  await pluginSettingsComponent.loadWithPromises();

  const showNotice = vi.fn<PluginNoticeComponent['showNotice']>();
  const component = new PluginLoadDelaysComponent({
    app: castTo<App>(app),
    pluginId: OWN_ID,
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNotice }),
    pluginSettingsComponent,
    random: (): number => 0
  });
  component.load();

  return { app, component, loadedPlugin, originalLoadPlugin, pluginSettingsComponent, showNotice };
}

function createManifest(id: string, name: string): PluginManifest {
  return { author: 'test', description: '', id, minAppVersion: '0.0.0', name, version: '1.0.0' };
}

function getNoticeText(showNotice: Context['showNotice'], index = 0): string {
  const message = showNotice.mock.calls[index]?.[0];
  return typeof message === 'string' ? message : message?.textContent ?? '';
}

function onSettings(settings: Record<string, unknown>): Record<string, unknown> {
  return { defaultPluginLoadDelayInMilliseconds: DELAY_MS, shouldDelayPluginLoading: true, ...settings };
}

describe('PluginLoadDelaysComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should load plugins with no delay and leave the load order alone while off', async () => {
    const { app, loadedPlugin, originalLoadPlugin, showNotice } = await createContext({
      enabledPluginIds: ['plugin-a', OWN_ID],
      loadedPluginIds: ['plugin-a', OWN_ID]
    });

    expect(await app.plugins.loadPlugin('plugin-b')).toBe(loadedPlugin);
    expect(originalLoadPlugin).toHaveBeenCalledWith('plugin-b');
    expect([...app.plugins.enabledPlugins]).toEqual(['plugin-a', OWN_ID]);
    expect(app.plugins.saveConfig).not.toHaveBeenCalled();
    expect(showNotice).not.toHaveBeenCalled();
  });

  it('should move itself first and name the plugins that loaded before it at startup', async () => {
    const { app, showNotice } = await createContext({
      enabledPluginIds: ['plugin-a', 'plugin-b', OWN_ID],
      loadedPluginIds: ['plugin-a', 'plugin-b', OWN_ID],
      settings: onSettings({})
    });

    expect([...app.plugins.enabledPlugins]).toEqual([OWN_ID, 'plugin-a', 'plugin-b']);
    expect(app.plugins.saveConfig).toHaveBeenCalledOnce();
    expect(getNoticeText(showNotice)).toBe(
      'These plugins loaded before Advanced Debug Mode, so their loading was not delayed: Alpha, plugin-b. The load order is fixed now; reload Obsidian to delay them too.Reload'
    );

    const fragment = castTo<DocumentFragment>(showNotice.mock.calls[0]?.[0]);
    fragment.querySelector('button')?.click();
    await waitForAllAsyncOperations();
    expect(app.plugins.saveConfig).toHaveBeenCalledTimes(2);
    expect(app.commands.executeCommandById).toHaveBeenCalledWith('app:reload');
  });

  it('should add its own id first when the user has just enabled it', async () => {
    const { app } = await createContext({ enabledPluginIds: ['plugin-a'], settings: onSettings({}) });
    expect([...app.plugins.enabledPlugins]).toEqual([OWN_ID, 'plugin-a']);
  });

  it('should save nothing and say nothing when it already loads first', async () => {
    const { app, showNotice } = await createContext({ enabledPluginIds: [OWN_ID, 'plugin-a'], settings: onSettings({}) });
    expect(app.plugins.saveConfig).not.toHaveBeenCalled();
    expect(showNotice).not.toHaveBeenCalled();
  });

  it('should not report plugins loaded earlier when enabled after the layout is ready', async () => {
    const { app, showNotice } = await createContext({
      enabledPluginIds: ['plugin-a', OWN_ID],
      isLayoutReady: true,
      loadedPluginIds: ['plugin-a', OWN_ID],
      settings: onSettings({})
    });
    expect([...app.plugins.enabledPlugins]).toEqual([OWN_ID, 'plugin-a']);
    expect(showNotice).not.toHaveBeenCalled();
  });

  it('should wait before the plugin loads in the before-onload position', async () => {
    vi.useFakeTimers();
    const { app, originalLoadPlugin } = await createContext({ settings: onSettings({}) });

    const promise = app.plugins.loadPlugin('plugin-a');
    await vi.advanceTimersByTimeAsync(DELAY_MS - 1);
    expect(originalLoadPlugin).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(originalLoadPlugin).toHaveBeenCalledWith('plugin-a');
  });

  it('should wait after the plugin loads in the after-onload position', async () => {
    vi.useFakeTimers();
    const { app, originalLoadPlugin } = await createContext({
      settings: onSettings({ pluginLoadDelayPosition: PluginLoadDelayPosition.AfterOnload })
    });

    let isDone = false;
    const promise = app.plugins.loadPlugin('plugin-a').then(() => {
      isDone = true;
    });
    await vi.advanceTimersByTimeAsync(DELAY_MS - 1);
    expect(originalLoadPlugin).toHaveBeenCalledWith('plugin-a');
    expect(isDone).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(isDone).toBe(true);
  });

  it('should not delay itself, a loaded plugin, or a plugin given 0', async () => {
    vi.useFakeTimers();
    const { app, originalLoadPlugin } = await createContext({
      loadedPluginIds: [OWN_ID, 'plugin-loaded'],
      settings: onSettings({ pluginLoadDelaysInMilliseconds: { 'plugin-zero': 0 } })
    });

    await app.plugins.loadPlugin(OWN_ID);
    await app.plugins.loadPlugin('plugin-loaded');
    await app.plugins.loadPlugin('plugin-zero');
    expect(originalLoadPlugin).toHaveBeenCalledTimes(3);
  });

  it('should report the startup delays once the layout has loaded', async () => {
    const SHORT_DELAY_MS = 1;
    const { app, showNotice } = await createContext({
      settings: onSettings({
        defaultPluginLoadDelayInMilliseconds: SHORT_DELAY_MS,
        layoutLoadDelayInMilliseconds: SHORT_DELAY_MS,
        metadataCacheInitializeDelayInMilliseconds: SHORT_DELAY_MS,
        pluginLoadDelayMode: PluginLoadDelayMode.Sync
      })
    });

    await app.plugins.loadPlugin('plugin-a');
    await app.plugins.loadPlugin('plugin-unknown');
    await app.metadataCache.initialize();
    expect(showNotice).not.toHaveBeenCalled();
    await app.workspace.loadLayout();

    expect(getNoticeText(showNotice)).toBe(
      'Delayed the startup by 4 ms: Alpha (1 ms), plugin-unknown (1 ms), metadata cache (1 ms), layout (1 ms).'
    );
  });

  it('should report nothing at startup when nothing was delayed', async () => {
    const { app, showNotice } = await createContext();
    await app.metadataCache.initialize();
    await app.workspace.loadLayout();
    expect(showNotice).not.toHaveBeenCalled();
  });

  it('should not patch the startup steps once the layout is ready, and report each plugin delay on its own', async () => {
    const SHORT_DELAY_MS = 1;
    const { app, showNotice } = await createContext({
      isLayoutReady: true,
      settings: onSettings({ defaultPluginLoadDelayInMilliseconds: SHORT_DELAY_MS, pluginLoadDelayMode: PluginLoadDelayMode.Sync })
    });

    expect(vi.isMockFunction(app.workspace.loadLayout)).toBe(true);
    await app.plugins.loadPlugin('plugin-a');
    expect(getNoticeText(showNotice)).toBe('Delayed the loading of Alpha (1 ms).');
  });

  it('should move itself first and offer a reload when switched on', async () => {
    const { app, pluginSettingsComponent, showNotice } = await createContext({ enabledPluginIds: ['plugin-a', OWN_ID] });

    await pluginSettingsComponent.editAndSave((settings) => {
      settings.shouldDelayPluginLoading = true;
    });
    await waitForAllAsyncOperations();
    expect([...app.plugins.enabledPlugins]).toEqual([OWN_ID, 'plugin-a']);
    expect(getNoticeText(showNotice)).toBe(
      'Plugin load delays are on. They apply to the plugins loaded from now on. Reload Obsidian to delay the startup as well.Reload'
    );

    await pluginSettingsComponent.editAndSave((settings) => {
      settings.defaultPluginLoadDelayInMilliseconds = DELAY_MS;
    });
    await waitForAllAsyncOperations();
    expect(showNotice).toHaveBeenCalledOnce();
  });

  it('should put the original methods back on unload', async () => {
    const { app, component, originalLoadPlugin } = await createContext();
    expect(app.plugins.loadPlugin).not.toBe(originalLoadPlugin);
    component.unload();
    expect(app.plugins.loadPlugin).toBe(originalLoadPlugin);
  });
});
