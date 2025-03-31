import { PluginSettingsBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsBase';

export class AdvancedDebugModePluginSettings extends PluginSettingsBase {
  public shouldIncludeAsyncLongStackTraces = false;
  public shouldIncludeInternalStackFrames = false;
  public shouldIncludeLongStackTraces = true;
  public shouldIncludeTimedOutTasksDetails = true;
  public shouldTimeoutLongRunningTasks = true;
  // eslint-disable-next-line no-magic-numbers
  public stackTraceLimit = 100;

  public constructor(data: unknown) {
    super();
    this.init(data);
  }
}
