export enum PluginLoadDelayMode {
  // `await sleep(ms)`: the startup waits, but timers and work that earlier plugins started keep running.
  Async = 'Async',
  // A busy-wait that blocks the renderer, so nothing else runs.
  Sync = 'Sync'
}

export enum PluginLoadDelayPosition {
  AfterOnload = 'AfterOnload',
  BeforeOnload = 'BeforeOnload'
}

export class PluginSettings {
  // The `@mnaoumov/typescript-lib` debug switches that are not at their default, keyed by switch id.
  public debugSwitches: Record<string, boolean> = {};
  public defaultPluginLoadDelayInMilliseconds = 0;
  public layoutLoadDelayInMilliseconds = 0;
  public metadataCacheInitializeDelayInMilliseconds = 0;
  public pluginLoadDelayJitterInMilliseconds = 0;
  public pluginLoadDelayMode = PluginLoadDelayMode.Async;
  public pluginLoadDelayPosition = PluginLoadDelayPosition.BeforeOnload;
  // Overrides `defaultPluginLoadDelayInMilliseconds`, keyed by plugin id.
  public pluginLoadDelaysInMilliseconds: Record<string, number> = {};
  public shouldDelayPluginLoading = false;
  public shouldIncludeAsyncLongStackTraces = false;
  public shouldIncludeInternalStackFrames = false;
  public shouldIncludeLongStackTraces = true;
  public shouldIncludeTimedOutTasksDetails = true;
  public shouldTimeoutLongRunningTasks = true;
  // eslint-disable-next-line no-magic-numbers -- Magic numbers are OK in settings.
  public stackTraceLimit = 100;
}
