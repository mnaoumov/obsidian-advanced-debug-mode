import { PluginSettingsBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsBase';

export class AdvancedDebugModePluginSettings extends PluginSettingsBase {
  public shouldIncludeAsyncLongStackTraces = false;
  public shouldIncludeInternalStackFrames = false;
  public shouldIncludeLongStackTraces = true;
  public shouldTimeoutLongRunningTasks = true;

  public constructor(data: unknown) {
    super();
    this.init(data);
  }
}
