// The console method that logs an error thrown by a queued file-system adapter operation, if any.
export enum FailedQueuedOperationLogLevel {
  Debug = 'Debug',
  Error = 'Error',
  Off = 'Off',
  Warning = 'Warning'
}

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
  public failedQueuedOperationLogLevel = FailedQueuedOperationLogLevel.Off;
  public layoutLoadDelayInMilliseconds = 0;
  // eslint-disable-next-line no-magic-numbers -- Magic numbers are OK in settings.
  public memoryCriticalThresholdInPercent = 90;
  // Where the memory trail and the heap snapshots go. Empty means a folder under the system temp folder, which keeps a
  // multi-gigabyte snapshot out of the vault and out of whatever syncs it.
  public memoryDiagnosticsFolder = '';
  // eslint-disable-next-line no-magic-numbers -- Magic numbers are OK in settings.
  public memorySampleIntervalInSeconds = 10;
  // eslint-disable-next-line no-magic-numbers -- Magic numbers are OK in settings.
  public memoryTrailMaxSizeInMegabytes = 10;
  // eslint-disable-next-line no-magic-numbers -- Magic numbers are OK in settings.
  public memoryWarningThresholdInPercent = 70;
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
  public shouldMonitorMemory = false;
  public shouldTimeoutLongRunningTasks = true;
  public shouldWriteHeapSnapshotOnCritical = false;
  public shouldWriteMemoryTrail = true;
  // eslint-disable-next-line no-magic-numbers -- Magic numbers are OK in settings.
  public stackTraceLimit = 100;
}
