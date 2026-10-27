import { registerAsyncEvent } from '@mnaoumov/obsidian-lib/components/async-events-component';
import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import { FileSystemAdapter } from 'obsidian';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

import { FileSystemAdapterQueuePatchComponent } from './file-system-adapter-queue-patch-component.ts';
import { FileSystemAdapterThingsHappeningPatchComponent } from './file-system-adapter-things-happening-patch-component.ts';

export type RejectFunction = (error: Error) => void;

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
        if (isInitialLoad) {
          return;
        }

        this.unload();
        this.load();
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
