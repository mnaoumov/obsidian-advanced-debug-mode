import type { Promisable } from 'type-fest';

import {
  Component,
  debounce,
  FileSystemAdapter
} from 'obsidian';
import { registerPatch } from 'obsidian-dev-utils/obsidian/MonkeyAround';

import type { Plugin } from '../Plugin.ts';

const THINGS_HAPPENING_DEBOUNCE_TIMEOUT_IN_MS = 60_000;
type QueueFn = FileSystemAdapter['queue'];
type RejectFn = (e: Error) => void;

export class LongRunningTasksComponent extends Component {
  private _fileSystemAdapter?: FileSystemAdapter;

  private get fileSystemAdapter(): FileSystemAdapter {
    if (!this._fileSystemAdapter) {
      throw new Error('fileSystemAdapter is not set');
    }
    return this._fileSystemAdapter;
  }

  public constructor(private readonly plugin: Plugin) {
    super();
  }

  public override onload(): void {
    const fileSystemAdapter = this.plugin.app.vault.adapter;

    if (!(fileSystemAdapter instanceof FileSystemAdapter)) {
      return;
    }

    this._fileSystemAdapter = fileSystemAdapter;

    if (!this.plugin.settings.shouldTimeoutLongRunningTasks) {
      registerPatch(this, fileSystemAdapter, {
        thingsHappening: () => {
          return debounce(this.notifyNoTimeout.bind(this), THINGS_HAPPENING_DEBOUNCE_TIMEOUT_IN_MS);
        }
      });
    }

    if (this.plugin.settings.shouldIncludeTimedOutTasksDetails) {
      registerPatch(this, fileSystemAdapter, {
        queue: (): QueueFn => this.queue.bind(this)
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
