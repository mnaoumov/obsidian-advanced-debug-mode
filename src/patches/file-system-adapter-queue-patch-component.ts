import type { FileSystemAdapter } from 'obsidian';
import type { Promisable } from 'type-fest';

import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type { RejectFunction } from '../long-running-tasks-component.ts';
import type { PluginSettingsComponent } from '../plugin-settings-component.ts';

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
    if (this.pluginSettingsComponent.settings.shouldIncludeTimedOutTasksDetails) {
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
    return await Promise.race([timeoutPromise, run()]);

    async function run(): Promise<T> {
      try {
        return await $function();
      } catch (error) {
        console.error('Failed function', {
          // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
          fn: $function
        });
        console.error(error);
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

        console.error('Timed out function', {
          // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
          fn: $function
        });
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
