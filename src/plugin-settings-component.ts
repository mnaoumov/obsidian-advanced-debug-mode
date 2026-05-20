import type { DataHandler } from 'obsidian-dev-utils/obsidian/data-handler';

import { PluginSettingsComponentBase } from 'obsidian-dev-utils/obsidian/components/plugin-settings-component';

import { PluginSettings } from './plugin-settings.ts';

export class PluginSettingsComponent extends PluginSettingsComponentBase<PluginSettings> {
  public constructor(dataHandler: DataHandler) {
    super({
      dataHandler,
      pluginSettingsClass: PluginSettings
    });
  }
}
