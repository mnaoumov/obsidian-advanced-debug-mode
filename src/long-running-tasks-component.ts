import { FileSystemAdapter } from 'obsidian';
import { registerAsyncEvent } from 'obsidian-dev-utils/obsidian/components/async-events-component';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';

import type { PluginSettingsComponent } from './plugin-settings-component.ts';

import { FileSystemAdapterQueuePatchComponent } from './patches/file-system-adapter-queue-patch-component.ts';
import { FileSystemAdapterThingsHappeningPatchComponent } from './patches/file-system-adapter-things-happening-patch-component.ts';

export type RejectFn = (e: Error) => void;

interface LongRunningTasksComponentConstructorParams {
  readonly fileSystemAdapter: FileSystemAdapter;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class LongRunningTasksComponent extends ComponentEx {
  private readonly fileSystemAdapter: FileSystemAdapter;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: LongRunningTasksComponentConstructorParams) {
    super();
    this.fileSystemAdapter = params.fileSystemAdapter;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    this.addChild(
      new FileSystemAdapterThingsHappeningPatchComponent({
        fileSystemAdapter: this.fileSystemAdapter,
        pluginSettingsComponent: this.pluginSettingsComponent
      })
    );
    this.addChild(
      new FileSystemAdapterQueuePatchComponent({
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
