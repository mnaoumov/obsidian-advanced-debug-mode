export class PluginSettings {
  public shouldIncludeAsyncLongStackTraces = false;
  public shouldIncludeInternalStackFrames = false;
  public shouldIncludeLongStackTraces = true;
  public shouldIncludeTimedOutTasksDetails = true;
  public shouldTimeoutLongRunningTasks = true;
  // eslint-disable-next-line no-magic-numbers -- Magic numbers are OK in settings.
  public stackTraceLimit = 100;
}
