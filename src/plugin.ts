import type {
  App,
  FileSystemAdapter,
  PluginManifest
} from 'obsidian';

import { AppActiveFileProvider } from 'obsidian-dev-utils/obsidian/active-file-provider';
import { CommandHandlerComponent } from 'obsidian-dev-utils/obsidian/command-handlers/command-handler-component';
import { OpenSettingsCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/open-settings-command-handler';
import { PluginCommandRegistrar } from 'obsidian-dev-utils/obsidian/command-registrar';
import { PluginDataHandler } from 'obsidian-dev-utils/obsidian/data-handler';
import { AppMenuEventRegistrar } from 'obsidian-dev-utils/obsidian/menu-event-registrar';
import { PluginSettingsTabComponent } from 'obsidian-dev-utils/obsidian/plugin/components/plugin-settings-tab-component';
import { PluginBase } from 'obsidian-dev-utils/obsidian/plugin/plugin';

import { ToggleDevToolsButtonCommandHandler } from './command-handlers/toggle-dev-tools-button-command.ts';
import { DevToolsComponent } from './components/dev-tools-component.ts';
import { DebugMode } from './debug-mode.ts';
import { EmulateMobileMode } from './emulate-mobile-mode.ts';
import { ErrorStackTraceLimitComponent } from './error-stack-trace-limit-component.ts';
import { LongRunningTasksComponent } from './long-running-tasks-component.ts';
import { LongStackTracesComponent } from './long-stack-traces/long-stack-traces-component.ts';
import { PluginSettingsComponent } from './plugin-settings-component.ts';
import { PluginSettingsTab } from './plugin-settings-tab.ts';

export class Plugin extends PluginBase {
  public constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);

    const pluginSettingsComponent = this.addChild(new PluginSettingsComponent(new PluginDataHandler(this)));
    const pluginSettingsTab = new PluginSettingsTab({
      debugMode: new DebugMode(app),
      emulateMobileMode: new EmulateMobileMode(app),
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

    this.addChild(
      new CommandHandlerComponent({
        activeFileProvider: new AppActiveFileProvider(app),
        commandHandlers: [
          new OpenSettingsCommandHandler(pluginSettingsTab),
          new ToggleDevToolsButtonCommandHandler(devToolsComponent)
        ],
        commandRegistrar: new PluginCommandRegistrar(this),
        menuEventRegistrar: new AppMenuEventRegistrar(app, this),
        pluginName: manifest.name
      })
    );

    new LongRunningTasksComponent({
      fileSystemAdapter: this.app.vault.adapter as FileSystemAdapter,
      pluginSettingsComponent
    });

    this.addChild(new ErrorStackTraceLimitComponent());

    this.addChild(
      new LongStackTracesComponent({
        pluginSettingsComponent
      })
    );
  }
}
