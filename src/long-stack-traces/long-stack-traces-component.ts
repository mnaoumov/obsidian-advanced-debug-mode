import { Platform } from 'obsidian';
import { AsyncComponentBase } from 'obsidian-dev-utils/obsidian/components/async-component';
import { registerAsyncEvent } from 'obsidian-dev-utils/obsidian/components/async-events-component';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';

interface LongStackTracesComponentConstructorParams {
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class LongStackTracesComponent extends AsyncComponentBase {
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: LongStackTracesComponentConstructorParams) {
    super();
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override async onload(): Promise<void> {
    await super.onload();
    if (Platform.isDesktop) {
      // eslint-disable-next-line no-restricted-syntax -- Lazy loading.
      const longStackTracesComponentDesktop = new (await import('./long-stack-traces-component-desktop.ts')).LongStackTracesComponentDesktop();
      this.addChild(longStackTracesComponentDesktop);
    }

    registerAsyncEvent(
      this,
      this.pluginSettingsComponent.on('loadSettings', async (_loadedState, isInitialLoad) => {
        if (!isInitialLoad) {
          this.unload();
          await this.load();
        }
      })
    );

    registerAsyncEvent(
      this,
      this.pluginSettingsComponent.on('saveSettings', async () => {
        this.unload();
        await this.load();
      })
    );
  }
}
