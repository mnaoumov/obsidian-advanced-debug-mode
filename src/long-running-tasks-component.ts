import type { Promisable } from 'type-fest';

import {
  Component,
  debounce,
  FileSystemAdapter
} from 'obsidian';
import { registerAsyncEvent } from 'obsidian-dev-utils/obsidian/components/async-events-component';
import { registerPatch } from 'obsidian-dev-utils/obsidian/monkey-around';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

const THINGS_HAPPENING_DEBOUNCE_TIMEOUT_IN_MS = 60_000;
interface LongRunningTasksComponentConstructorParams {
  readonly fileSystemAdapter: FileSystemAdapter;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}
type QueueFn = FileSystemAdapter['queue'];

type RejectFn = (e: Error) => void;

export class LongRunningTasksComponent extends Component {
  private readonly fileSystemAdapter: FileSystemAdapter;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: LongRunningTasksComponentConstructorParams) {
    super();
    this.fileSystemAdapter = params.fileSystemAdapter;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    super.onload();
    if (!this.pluginSettingsComponent.settings.shouldTimeoutLongRunningTasks) {
      registerPatch(this, this.fileSystemAdapter, {
        thingsHappening: () => {
          return debounce(this.notifyNoTimeout.bind(this), THINGS_HAPPENING_DEBOUNCE_TIMEOUT_IN_MS);
        }
      });
    }

    if (this.pluginSettingsComponent.settings.shouldIncludeTimedOutTasksDetails) {
      registerPatch(this, this.fileSystemAdapter, {
        queue: (): QueueFn => this.queue.bind(this)
      });
    }

    registerAsyncEvent(
      this,
      this.pluginSettingsComponent.on('loadSettings', (_loadedState, isInitialLoad) => {
        if (!isInitialLoad) {
          this.unload();
          this.load();
        }
      })
    );

    registerAsyncEvent(
      this,
      this.pluginSettingsComponent.on('saveSettings', () => {
        this.unload();
        this.load();
      })
    );
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

  private notifyNoTimeout(): void {
    console.warn(
      'Obsidian default behavior to timeout long running tasks after 60 seconds is currently disabled by the "Advanced Debug Mode" plugin. You can enable it back in the settings.'
    );
  }

  private queue<T>(fn: () => Promisable<T>): Promise<T> {
    const nextPromise = this.makeNextPromise(fn);
    this.fileSystemAdapter.promise = nextPromise;
    return nextPromise;
  }
}
