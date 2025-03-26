import type { FileSystemAdapter } from 'obsidian';

import {
  Component,
  debounce,
  Platform
} from 'obsidian';

import type { AdvancedDebugModePlugin } from '../AdvancedDebugModePlugin.ts';

import { registerPatch } from '../MonkeyAround.ts';

const THINGS_HAPPENING_DEBOUNCE_TIMEOUT_IN_MS = 60_000;

export class LongRunningTasksComponent extends Component {
  public constructor(private plugin: AdvancedDebugModePlugin) {
    super();
  }

  public override onload(): void {
    if (!this.isEnabled()) {
      return;
    }

    const fileSystemAdapter = this.plugin.app.vault.adapter as FileSystemAdapter;

    registerPatch(this, fileSystemAdapter, {
      thingsHappening: () => {
        return debounce(this.notifyNoTimeout.bind(this), THINGS_HAPPENING_DEBOUNCE_TIMEOUT_IN_MS);
      }
    });
  }

  private isEnabled(): boolean {
    return !this.plugin.settings.shouldTimeoutLongRunningTasks && Platform.isDesktop;
  }

  private notifyNoTimeout(): void {
    console.warn(
      'Obsidian default behavior to timeout long running tasks after 60 seconds is currently disabled by the "Advanced Debug Mode" plugin. You can enable it back in the settings.'
    );
  }
}
