import { FileSystemAdapter } from 'obsidian';
import { getDebugController } from 'obsidian-dev-utils/debug';
import { OpenDemoVaultCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-demo-vault-command-handler';
import { OpenSettingsCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-settings-command-handler';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/components/plugin-settings-tab-component';
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';
import { PluginEventSourceImpl } from 'obsidian-dev-utils/obsidian/plugin/plugin-event-source';

import { ToggleDevToolsButtonCommandHandler } from './command-handlers/toggle-dev-tools-button-command.ts';
import { DebugMode } from './debug-mode.ts';
import { DevToolsComponent } from './dev-tools-component.ts';
import { EmulateMobileMode } from './emulate-mobile-mode.ts';
import { ErrorStackTraceLimitComponent } from './error-stack-trace-limit-component.ts';
import { LongRunningTasksComponent } from './long-running-tasks-component.ts';
import { LongStackTracesComponent } from './long-stack-traces/long-stack-traces-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

export class Plugin extends PluginBase {
  protected override async onloadImpl(): Promise<void> {
    const pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler: new PluginDataHandler(this),
        pluginEventSource: new PluginEventSourceImpl(this)
      })
    );
    this.pluginSettingsComponent = pluginSettingsComponent;
    // Since obsidian-dev-utils 90 a child is loaded as it is added, so the settings' async load tail runs in parallel with the components added below instead of before them. Those components read the settings in their synchronous `onload` and only re-read them on a later `loadSettings`/`saveSettings` event, never on the initial load, so without this wait they wire themselves up from the defaults for the whole session — a stored `shouldIncludeAsyncLongStackTraces: true` would be read as its default `false`.
    await pluginSettingsComponent.loadWithPromises();

    const pluginSettingsTab = new PluginSettingsTab({
      debugController: getDebugController(),
      debugMode: new DebugMode(this.app),
      emulateMobileMode: new EmulateMobileMode(this.app),
      plugin: this,
      pluginSettingsComponent
    });
    this.addChild(
      new PluginSettingsTabComponent({
        plugin: this,
        pluginSettingsTab
      })
    );

    const devToolsComponent = this.addChild(new DevToolsComponent());

    await this.commandHandlerComponent.registerCommandHandlers(() => [
      new OpenSettingsCommandHandler({
        app: this.app,
        settingTab: pluginSettingsTab
      }),
      new ToggleDevToolsButtonCommandHandler(devToolsComponent),
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);

    // LongRunningTasksComponent patches `queue` and `thingsHappening`, which only the desktop
    // FileSystemAdapter has, so it is added only where that adapter is the real one. While the component
    // Was constructed and then dropped the unchecked cast never mattered; now that it is actually added
    // And loaded, letting it patch Android's CapacitorAdapter leaves the vault broken and Obsidian never
    // Reaches layout-ready — the plugin does not finish loading at all.
    const { adapter } = this.app.vault;
    if (adapter instanceof FileSystemAdapter) {
      this.addChild(
        new LongRunningTasksComponent({
          fileSystemAdapter: adapter,
          pluginSettingsComponent
        })
      );
    }

    this.addChild(new ErrorStackTraceLimitComponent());

    this.addChild(
      new LongStackTracesComponent({
        app: this.app,
        pluginId: this.manifest.id,
        pluginSettingsComponent
      })
    );
  }
}
