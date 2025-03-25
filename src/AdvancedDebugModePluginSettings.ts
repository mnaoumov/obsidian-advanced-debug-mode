import { PluginSettingsBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsBase';

export class AdvancedDebugModePluginSettings extends PluginSettingsBase {
  public shouldShowInternalStackFrames = false;

  public constructor(data: unknown) {
    super();
    this.init(data);
  }
}
