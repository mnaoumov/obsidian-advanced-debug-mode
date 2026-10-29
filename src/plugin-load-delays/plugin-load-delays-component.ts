import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type {
  App,
  Plugin
} from 'obsidian';

import { registerAsyncEvent } from '@mnaoumov/obsidian-lib/components/async-events-component';
import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { appendCodeBlock } from '@mnaoumov/obsidian-lib/html-element';
import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { PluginLoadDelayPosition } from '../settings/plugin-settings.ts';
import {
  delay,
  getPluginLoadDelayInMilliseconds
} from './plugin-load-delays.ts';

interface AppliedDelay {
  readonly delayInMilliseconds: number;
  readonly isPlugin: boolean;
  readonly name: string;
}

interface PluginLoadDelaysComponentConstructorParams {
  readonly app: App;
  readonly pluginId: string;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly random?: () => number;
}

interface PluginLoadDelaysComponentLoadPluginParams {
  readonly fallback: () => Promise<Plugin>;
  readonly pluginId: string;
}

/**
 * Inserts the configured delays into the loading of other plugins, and at startup into the metadata cache's first
 * resolve and the layout load, to show how plugins behave on a slow machine.
 *
 * Obsidian loads the enabled plugins one at a time, in the order of `community-plugins.json`, awaiting each `onload`,
 * and only then loads the vault, the metadata cache and the layout. Every step is called through its instance, so the
 * patches installed here cover every plugin that loads after this one. That is why, while the delays are on, this
 * plugin keeps itself first in that order, and at startup names any plugin that still got there before it.
 */
export class PluginLoadDelaysComponent extends MonkeyAroundComponent {
  private readonly app: App;
  private readonly pluginId: string;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly random: () => number;
  private readonly startupDelays: AppliedDelay[] = [];

  public constructor(params: PluginLoadDelaysComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginId = params.pluginId;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.random = params.random ?? Math.random;
  }

  public override onload(): void {
    const isStartup = !this.app.workspace.layoutReady;

    if (this.pluginSettingsComponent.settings.shouldDelayPluginLoading) {
      this.ensureLoadsFirst();
      if (isStartup) {
        this.reportPluginsLoadedEarlier();
      }
    }

    this.registerMethodPatch({
      $object: this.app.plugins,
      methodName: 'loadPlugin',
      patchHandler: ({ fallback, originalArguments: [pluginId] }) => this.loadPlugin({ fallback, pluginId })
    });

    if (isStartup) {
      this.registerMethodPatch({
        $object: this.app.metadataCache,
        methodName: 'initialize',
        patchHandler: async ({ fallback }) => {
          await this.delayStartupStep('metadata cache', this.pluginSettingsComponent.settings.metadataCacheInitializeDelayInMilliseconds);
          await fallback();
        }
      });
      this.registerMethodPatch({
        $object: this.app.workspace,
        methodName: 'loadLayout',
        patchHandler: async ({ fallback }) => {
          await this.delayStartupStep('layout', this.pluginSettingsComponent.settings.layoutLoadDelayInMilliseconds);
          await fallback();
          this.reportStartupDelays();
        }
      });
    }

    registerAsyncEvent(
      this,
      this.pluginSettingsComponent.on('saveSettings', (newState, oldState) => {
        if (!newState.effectiveValues.shouldDelayPluginLoading || oldState.effectiveValues.shouldDelayPluginLoading) {
          return;
        }

        this.ensureLoadsFirst();
        this.showNoticeWithReload((f) => {
          f.appendText('Plugin load delays are on. They apply to the plugins loaded from now on. Reload Obsidian to delay the startup as well.');
        });
      })
    );
  }

  private async delayStartupStep(name: string, delayInMilliseconds: number): Promise<void> {
    const { settings } = this.pluginSettingsComponent;
    if (!settings.shouldDelayPluginLoading || delayInMilliseconds <= 0) {
      return;
    }

    await delay(settings.pluginLoadDelayMode, delayInMilliseconds);
    this.startupDelays.push({ delayInMilliseconds, isPlugin: false, name });
  }

  private ensureLoadsFirst(): void {
    const { enabledPlugins } = this.app.plugins;
    if (enabledPlugins.values().next().value === this.pluginId) {
      return;
    }

    // `enabledPlugins` is a `Set`, so its order is insertion order: rebuild it with this plugin first. When the user has
    // just enabled this plugin, Obsidian adds its id only after `onload`, so the id is added here, and Obsidian's own
    // add is then a no-op that keeps it first.
    const otherPluginIds = [...enabledPlugins].filter((pluginId) => pluginId !== this.pluginId);
    enabledPlugins.clear();
    enabledPlugins.add(this.pluginId);
    for (const pluginId of otherPluginIds) {
      enabledPlugins.add(pluginId);
    }
    invokeAsyncSafely(() => this.app.plugins.saveConfig());
  }

  private getPluginName(pluginId: string): string {
    return this.app.plugins.manifests[pluginId]?.name ?? pluginId;
  }

  private async loadPlugin(params: PluginLoadDelaysComponentLoadPluginParams): Promise<Plugin> {
    const { fallback, pluginId } = params;
    const { settings } = this.pluginSettingsComponent;
    // Obsidian's `loadPlugin` returns an already loaded plugin as is, so there is no load to delay.
    if (!settings.shouldDelayPluginLoading || pluginId === this.pluginId || Object.hasOwn(this.app.plugins.plugins, pluginId)) {
      return await fallback();
    }

    const delayInMilliseconds = getPluginLoadDelayInMilliseconds({ pluginId, random: this.random, settings });
    if (delayInMilliseconds <= 0) {
      return await fallback();
    }

    let plugin: Plugin;
    if (settings.pluginLoadDelayPosition === PluginLoadDelayPosition.BeforeOnload) {
      await delay(settings.pluginLoadDelayMode, delayInMilliseconds);
      plugin = await fallback();
    } else {
      plugin = await fallback();
      await delay(settings.pluginLoadDelayMode, delayInMilliseconds);
    }

    const appliedDelay = { delayInMilliseconds, isPlugin: true, name: this.getPluginName(pluginId) };
    if (this.app.workspace.layoutReady) {
      this.pluginNoticeComponent.showNotice(createFragment((f) => {
        f.appendText('Delayed the loading of ');
        appendAppliedDelays(f, [appliedDelay]);
        f.appendText('.');
      }));
    } else {
      this.startupDelays.push(appliedDelay);
    }

    return plugin;
  }

  private reportPluginsLoadedEarlier(): void {
    // Obsidian registers a plugin before calling its `onload`, so this plugin is in the list too.
    const pluginIds = Object.keys(this.app.plugins.plugins).filter((pluginId) => pluginId !== this.pluginId);
    if (pluginIds.length === 0) {
      return;
    }

    this.showNoticeWithReload((f) => {
      f.appendText('These plugins loaded before ');
      appendCodeBlock(f, this.getPluginName(this.pluginId));
      f.appendText(', so their loading was not delayed: ');
      for (const [index, pluginId] of pluginIds.entries()) {
        if (index > 0) {
          f.appendText(', ');
        }
        appendCodeBlock(f, this.getPluginName(pluginId));
      }
      f.appendText('. The load order is fixed now; reload Obsidian to delay them too.');
    });
  }

  private reportStartupDelays(): void {
    if (this.startupDelays.length === 0) {
      return;
    }

    const totalInMilliseconds = this.startupDelays.reduce((total, appliedDelay) => total + appliedDelay.delayInMilliseconds, 0);
    this.pluginNoticeComponent.showNotice(createFragment((f) => {
      f.appendText(`Delayed the startup by ${String(totalInMilliseconds)} ms: `);
      appendAppliedDelays(f, this.startupDelays);
      f.appendText('.');
    }));
    this.startupDelays.length = 0;
  }

  private showNoticeWithReload(appendMessage: (f: DocumentFragment) => void): void {
    this.pluginNoticeComponent.showNotice(createFragment((f) => {
      appendMessage(f);
      f.createEl('br');
      f.createEl('button', { text: 'Reload' }, (button) => {
        button.addEventListener('click', () => {
          invokeAsyncSafely(async () => {
            // The order fix is saved without waiting, and a reload must not overtake it.
            await this.app.plugins.saveConfig();
            this.app.commands.executeCommandById('app:reload');
          });
        });
      });
    }));
  }
}

function appendAppliedDelays(f: DocumentFragment, appliedDelays: readonly AppliedDelay[]): void {
  for (const [index, appliedDelay] of appliedDelays.entries()) {
    if (index > 0) {
      f.appendText(', ');
    }
    if (appliedDelay.isPlugin) {
      appendCodeBlock(f, appliedDelay.name);
    } else {
      f.appendText(appliedDelay.name);
    }
    f.appendText(` (${String(appliedDelay.delayInMilliseconds)} ms)`);
  }
}
