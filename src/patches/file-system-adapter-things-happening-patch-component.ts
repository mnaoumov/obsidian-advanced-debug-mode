import {
  debounce,
  FileSystemAdapter
} from 'obsidian';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';

const THINGS_HAPPENING_DEBOUNCE_TIMEOUT_IN_MS = 60_000;

interface FileSystemAdapterThingsHappeningPatchComponentConstructorParams {
  readonly fileSystemAdapter: FileSystemAdapter;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class FileSystemAdapterThingsHappeningPatchComponent extends MonkeyAroundComponent {
  private readonly fileSystemAdapter: FileSystemAdapter;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: FileSystemAdapterThingsHappeningPatchComponentConstructorParams) {
    super();
    this.fileSystemAdapter = params.fileSystemAdapter;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    if (this.pluginSettingsComponent.settings.shouldTimeoutLongRunningTasks) {
      return;
    }

    this.registerFunctionPatch({
      obj: this.fileSystemAdapter,
      functionName: 'thingsHappening',
      patchHandler: () => {
        return debounce(this.notifyNoTimeout.bind(this), THINGS_HAPPENING_DEBOUNCE_TIMEOUT_IN_MS);
      }
    });
  }

  private notifyNoTimeout(): void {
    console.warn(
      'Obsidian default behavior to timeout long running tasks after 60 seconds is currently disabled by the "Advanced Debug Mode" plugin. You can enable it back in the settings.'
    );
  }
}
