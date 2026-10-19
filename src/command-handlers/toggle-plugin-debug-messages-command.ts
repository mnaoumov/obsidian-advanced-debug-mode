import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type {
  App,
  PluginManifest
} from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';
import { selectItem } from '@mnaoumov/obsidian-lib/modals/select-item';

import type { PluginDebugMessages } from '../plugin-debug-messages.ts';

interface TogglePluginDebugMessagesCommandHandlerConstructorParams {
  readonly app: App;
  readonly pluginDebugMessages: PluginDebugMessages;
  readonly pluginNoticeComponent: PluginNoticeComponent;
}

export class TogglePluginDebugMessagesCommandHandler extends GlobalCommandHandler {
  private readonly app: App;
  private readonly pluginDebugMessages: PluginDebugMessages;
  private readonly pluginNoticeComponent: PluginNoticeComponent;

  public constructor(params: TogglePluginDebugMessagesCommandHandlerConstructorParams) {
    super({
      icon: 'bug',
      id: 'toggle-plugin-debug-messages',
      name: 'Toggle debug messages for a plugin...'
    });
    this.app = params.app;
    this.pluginDebugMessages = params.pluginDebugMessages;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
  }

  protected override async execute(): Promise<void> {
    const manifest = await selectItem<PluginManifest>({
      app: this.app,
      items: this.pluginDebugMessages.getPluginManifests(),
      itemTextFunction: (item) => `${this.pluginDebugMessages.isEnabled(item.id) ? 'On' : 'Off'}: ${item.name} (${item.id})`,
      placeholder: 'Choose a plugin to turn its debug messages on or off'
    });

    if (!manifest) {
      return;
    }

    const isEnabled = !this.pluginDebugMessages.isEnabled(manifest.id);
    this.pluginDebugMessages.setEnabled(manifest.id, isEnabled);
    this.pluginNoticeComponent.showNotice(createFragment((f) => {
      f.appendText('Debug messages for ');
      f.createEl('code', { text: manifest.name });
      f.appendText(` are ${isEnabled ? 'on' : 'off'}. Some plugins pick the change up only after the app reloads.`);
    }));
  }
}
