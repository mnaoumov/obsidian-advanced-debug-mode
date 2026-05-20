import type { FileSystemAdapter } from 'obsidian';
import type { Promisable } from 'type-fest';

import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type {
  IncludeTimedOutTasksDetailsPatchComponentConstructorParams,
  RejectFn
} from '../long-running-tasks-component.ts';
import type { PluginSettingsComponent } from '../plugin-settings-component.ts';

export class IncludeTimedOutTasksDetailsPatchComponent extends MonkeyAroundComponent {
  private readonly fileSystemAdapter: FileSystemAdapter;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  public constructor(params: IncludeTimedOutTasksDetailsPatchComponentConstructorParams) {
    super();
    this.fileSystemAdapter = params.fileSystemAdapter;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    if (this.pluginSettingsComponent.settings.shouldIncludeTimedOutTasksDetails) {
      this.registerMethodPatch({
        methodName: 'queue',
        obj: this.fileSystemAdapter,
        patchHandler: ({ originalArgs: [fn] }) => {
          return this.queue(fn);
        }
      });
    }
  }

  private async makeNextPromise<T>(fn: () => Promisable<T>): Promise<T> {
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
    return await Promise.race([timeoutPromise, run()]);

    async function run(): Promise<T> {
      try {
        return await fn();
      } catch (e) {
        console.error('Failed function', {
          fn
        });
        console.error(e);
        throw e;
      } finally {
        isTimedOut = false;
      }
    }

    function rejectWithDetails(reject: RejectFn): RejectFn {
      return (error: Error): void => {
        if (!isTimedOut) {
          return;
        }

        console.error('Timed out function', {
          fn
        });
        reject(error);
      };
    }
  }

  private queue<T>(fn: () => Promisable<T>): Promise<T> {
    const nextPromise = this.makeNextPromise(fn);
    this.fileSystemAdapter.promise = nextPromise;
    return nextPromise;
  }
}
