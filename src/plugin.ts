import type { FileSystemAdapter } from 'obsidian';

import { getDebugController } from 'obsidian-dev-utils/debug';
import { AppActiveFileProvider } from 'obsidian-dev-utils/obsidian/active-file-provider';
import { CommandHandlerComponent } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler-component';
import { OpenSettingsCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-settings-command-handler';
import { PluginCommandRegistrar } from 'obsidian-dev-utils/obsidian/command-registrar';
import { MenuEventRegistrarComponent } from 'obsidian-dev-utils/obsidian/components/menu-event-registrar-component';
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
  public override onloadImpl(): void {
    const pluginSettingsComponent = this.addChild(
      new PluginSettingsComponent({
        dataHandler: new PluginDataHandler(this),
        pluginEventSource: new PluginEventSourceImpl(this)
      })
    );
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

    const menuEventRegistrar = this.addChild(new MenuEventRegistrarComponent(this.app));
    this.addChild(
      new CommandHandlerComponent({
        activeFileProvider: new AppActiveFileProvider(this.app),
        commandHandlers: [
          new OpenSettingsCommandHandler({
            app: this.app,
            settingTab: pluginSettingsTab
          }),
          new ToggleDevToolsButtonCommandHandler(devToolsComponent)
        ],
        commandRegistrar: new PluginCommandRegistrar(this),
        menuEventRegistrar,
        pluginName: this.manifest.name
      })
    );

    new LongRunningTasksComponent({
      fileSystemAdapter: this.app.vault.adapter as FileSystemAdapter,
      pluginSettingsComponent
    });

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
