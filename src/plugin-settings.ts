export class PluginSettings {
  // The `@mnaoumov/typescript-lib` debug switches that are not at their default, keyed by switch id.
  public debugSwitches: Record<string, boolean> = {};
  public shouldIncludeAsyncLongStackTraces = false;
  public shouldIncludeInternalStackFrames = false;
  public shouldIncludeLongStackTraces = true;
  public shouldIncludeTimedOutTasksDetails = true;
  public shouldTimeoutLongRunningTasks = true;
  // eslint-disable-next-line no-magic-numbers -- Magic numbers are OK in settings.
  public stackTraceLimit = 100;
}
