import { PluginSettingsBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsBase';

export class AdvancedDebugModePluginSettings extends PluginSettingsBase {
  public shouldShowAsyncLongStackTraces = false;
  public shouldShowInternalStackFrames = false;
  public shouldShowLongStackTraces = true;

  public constructor(data: unknown) {
    super();
    this.init(data);
  }
}
