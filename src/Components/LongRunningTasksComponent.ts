import type { FileSystemAdapter } from 'obsidian';

import {
  debounce,
  Platform
} from 'obsidian';

import type { AdvancedDebugModePlugin } from '../AdvancedDebugModePlugin.ts';

import { registerPatch } from '../MonkeyAround.ts';
import { ComponentBase } from './ComponentBase.ts';

const THINGS_HAPPENING_DEBOUNCE_TIMEOUT_IN_MS = 60_000;

export class LongRunningTasksComponent extends ComponentBase {
  public constructor(private plugin: AdvancedDebugModePlugin) {
    super();
  }

  public override onload(): void {
    super.onload();

    const fileSystemAdapter = this.plugin.app.vault.adapter as FileSystemAdapter;

    registerPatch(this, fileSystemAdapter, {
      thingsHappening: () => {
        return debounce(this.notifyNoTimeout.bind(this), THINGS_HAPPENING_DEBOUNCE_TIMEOUT_IN_MS);
      }
    });
  }

  protected override isEnabled(): boolean {
    return !this.plugin.settings.shouldTimeoutLongRunningTasks && Platform.isDesktop;
  }

  private notifyNoTimeout(): void {
    console.warn(
      'Obsidian default behavior to timeout long running tasks after 60 seconds is currently disabled by the "Advanced Debug Mode" plugin. You can enable it back in the settings.'
    );
  }
}
