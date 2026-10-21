import { OpenDemoVaultCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-demo-vault-command-handler';
import { OpenSettingsCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/open-settings-command-handler';
import { PluginSettingsTabComponent } from '@mnaoumov/obsidian-lib/components/plugin-settings-tab-component';
import { PluginDataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import { PluginBase } from '@mnaoumov/obsidian-lib/plugin/plugin';
import { PluginEventSourceImpl } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import { PluginRibbonIconRegistrar } from '@mnaoumov/obsidian-lib/ribbon-icon-registrar';
import { PluginViewRegistrar } from '@mnaoumov/obsidian-lib/view-registrar';
import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import { getDebugController } from '@mnaoumov/typescript-lib/debug';
import { FileSystemAdapter } from 'obsidian';

import { AbortSharedOperationCommandHandler } from './command-handlers/abort-shared-operation-command.ts';
import { OpenPluginDebugMessagesViewCommandHandler } from './command-handlers/open-plugin-debug-messages-view-command.ts';
import { ToggleDevToolsButtonCommandHandler } from './command-handlers/toggle-dev-tools-button-command.ts';
import { TogglePluginDebugMessagesCommandHandler } from './command-handlers/toggle-plugin-debug-messages-command.ts';
import { DebugMode } from './debug-mode.ts';
import { DebugSwitchesComponent } from './debug-switches-component.ts';
import { DevToolsComponent } from './dev-tools-component.ts';
import { EmulateMobileMode } from './emulate-mobile-mode.ts';
import { ErrorStackTraceLimitComponent } from './error-stack-trace-limit-component.ts';
import { LongRunningTasksComponent } from './long-running-tasks-component.ts';
import { LongStackTracesComponent } from './long-stack-traces/long-stack-traces-component.ts';
import {
  openPluginDebugMessagesView,
  PLUGIN_DEBUG_MESSAGES_VIEW_TYPE,
  PluginDebugMessagesView
} from './plugin-debug-messages-view.ts';
import { PluginDebugMessages } from './plugin-debug-messages.ts';
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

    this.addChild(
      new DebugSwitchesComponent({
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginSettingsComponent
      })
    );

    const debugController = getDebugController();
    const pluginDebugMessages = new PluginDebugMessages({
      app: this.app,
      debugController
    });

    new PluginViewRegistrar(this).registerView({
      type: PLUGIN_DEBUG_MESSAGES_VIEW_TYPE,
      viewCreator: (leaf) => new PluginDebugMessagesView({ leaf, pluginDebugMessages })
    });
    new PluginRibbonIconRegistrar(this).addRibbonIcon({
      callback: () => {
        invokeAsyncSafely(() => openPluginDebugMessagesView(this.app));
      },
      icon: 'bug',
      title: 'Open plugin debug messages'
    });

    const pluginSettingsTab = new PluginSettingsTab({
      debugController,
      debugMode: new DebugMode(this.app),
      emulateMobileMode: new EmulateMobileMode(this.app),
      openPluginDebugMessagesView: (): Promise<void> => openPluginDebugMessagesView(this.app),
      plugin: this,
      pluginDebugMessages,
      pluginNoticeComponent: this.pluginNoticeComponent,
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
      new AbortSharedOperationCommandHandler(this.pluginNoticeComponent),
      new TogglePluginDebugMessagesCommandHandler({
        app: this.app,
        pluginDebugMessages,
        pluginNoticeComponent: this.pluginNoticeComponent
      }),
      new OpenPluginDebugMessagesViewCommandHandler(this.app),
      new OpenDemoVaultCommandHandler({
        app: this.app,
        pluginId: this.manifest.id,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginVersion: this.manifest.version
      })
    ]);

    // LongRunningTasksComponent patches `queue` and `thingsHappening`, which only the desktop
    // FileSystemAdapter has, so it is added only where that adapter is the real one. While the component
    // was constructed and then dropped the unchecked cast never mattered; now that it is actually added
    // and loaded, letting it patch Android's CapacitorAdapter leaves the vault broken and Obsidian never
    // reaches layout-ready — the plugin does not finish loading at all.
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
