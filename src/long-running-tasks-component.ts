import {
  Component,
  FileSystemAdapter
} from 'obsidian';
import { registerAsyncEvent } from 'obsidian-dev-utils/obsidian/components/async-events-component';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { IncludeTimedOutTasksDetailsPatchComponent } from './patches/include-timed-out-tasks-details-patch-component.ts';
import { TimeoutLongRunningTasksPatchComponent } from './patches/timeout-long-running-tasks-patch-component.ts';

export interface IncludeTimedOutTasksDetailsPatchComponentConstructorParams {
  readonly fileSystemAdapter: FileSystemAdapter;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export type RejectFn = (e: Error) => void;

interface LongRunningTasksComponentConstructorParams {
  readonly fileSystemAdapter: FileSystemAdapter;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class LongRunningTasksComponent extends Component {
  private readonly fileSystemAdapter: FileSystemAdapter;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: LongRunningTasksComponentConstructorParams) {
    super();
    this.fileSystemAdapter = params.fileSystemAdapter;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    this.addChild(
      new TimeoutLongRunningTasksPatchComponent({
        fileSystemAdapter: this.fileSystemAdapter,
        pluginSettingsComponent: this.pluginSettingsComponent
      })
    );
    this.addChild(
      new IncludeTimedOutTasksDetailsPatchComponent({
        fileSystemAdapter: this.fileSystemAdapter,
        pluginSettingsComponent: this.pluginSettingsComponent
      })
    );

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
}
