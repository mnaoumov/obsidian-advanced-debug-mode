import type { FileSystemAdapter } from 'obsidian';
import type { Promisable } from 'type-fest';

import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { getDebugger } from '@mnaoumov/typescript-lib/debug';
import { noop } from '@mnaoumov/typescript-lib/function';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';
import type { RejectFunction } from './long-running-tasks-component.ts';

import { FailedQueuedOperationLogLevel } from '../settings/plugin-settings.ts';

type ConsoleLogger = (message: string, details: unknown) => void;

// The `Debug` level logs through this `debug`-library namespace, so its messages show only with the plugin's own debug
// messages turned on (`console.debug` underneath, which the console also hides unless it shows the Verbose level).
const FAILED_QUEUED_OPERATIONS_DEBUG_NAMESPACE = 'advanced-debug-mode:failed-queued-operations';

interface FileSystemAdapterQueuePatchComponentConstructorParams {
  readonly fileSystemAdapter: FileSystemAdapter;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class FileSystemAdapterQueuePatchComponent extends MonkeyAroundComponent {
  private readonly fileSystemAdapter: FileSystemAdapter;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  public constructor(params: FileSystemAdapterQueuePatchComponentConstructorParams) {
    super();
    this.fileSystemAdapter = params.fileSystemAdapter;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    const { failedQueuedOperationLogLevel, shouldIncludeTimedOutTasksDetails } = this.pluginSettingsComponent.settings;
    if (shouldIncludeTimedOutTasksDetails || failedQueuedOperationLogLevel !== FailedQueuedOperationLogLevel.Off) {
      this.registerMethodPatch({
        $object: this.fileSystemAdapter,
        methodName: 'queue',
        patchHandler: ({ originalArguments: [$function] }) => {
          return this.queue($function);
        }
      });
    }
  }

  private async makeNextPromise<T>($function: () => Promisable<T>): Promise<T> {
    const lastPromise = this.fileSystemAdapter.promise;
    try {
      await lastPromise;
    } catch {
      // Ignore
    }

    const timeoutPromise = new Promise<T>((_resolve, reject) => {
      this.fileSystemAdapter.killLastAction = rejectWithDetails(reject);
    });
    this.fileSystemAdapter.thingsHappening();
    let isTimedOut = true;
    const { failedQueuedOperationLogLevel, shouldIncludeTimedOutTasksDetails } = this.pluginSettingsComponent.settings;
    return await Promise.race([timeoutPromise, run()]);

    async function run(): Promise<T> {
      try {
        return await $function();
      } catch (error) {
        // The error still rejects the caller's promise; logging it is opt-in, because callers usually handle it.
        getFailedQueuedOperationLogger(failedQueuedOperationLogLevel)('Failed queued file-system operation', {
          error,
          function: $function
        });
        throw error;
      } finally {
        isTimedOut = false;
      }
    }

    function rejectWithDetails(reject: RejectFunction): RejectFunction {
      return (error: Error): void => {
        if (!isTimedOut) {
          return;
        }

        if (shouldIncludeTimedOutTasksDetails) {
          console.error('Timed out function', {
            function: $function
          });
        }
        reject(error);
      };
    }
  }

  private queue<T>($function: () => Promisable<T>): Promise<T> {
    const nextPromise = this.makeNextPromise($function);
    this.fileSystemAdapter.promise = nextPromise;
    return nextPromise;
  }
}

function getFailedQueuedOperationLogger(logLevel: FailedQueuedOperationLogLevel): ConsoleLogger {
  switch (logLevel) {
    case FailedQueuedOperationLogLevel.Debug: {
      return getDebugger(FAILED_QUEUED_OPERATIONS_DEBUG_NAMESPACE);
    }
    case FailedQueuedOperationLogLevel.Error: {
      return (message, details): void => {
        console.error(message, details);
      };
    }
    case FailedQueuedOperationLogLevel.Warning: {
      return (message, details): void => {
        console.warn(message, details);
      };
    }
    // `Off`, or a value from a hand-edited `data.json`.
    default: {
      return noop;
    }
  }
}
