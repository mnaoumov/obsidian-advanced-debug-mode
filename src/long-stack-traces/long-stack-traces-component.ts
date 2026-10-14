import {
  App,
  Platform
} from 'obsidian';
import { registerAsyncEvent } from 'obsidian-dev-utils/obsidian/components/async-events-component';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';

interface LongStackTracesComponentConstructorParams {
  readonly app: App;
  readonly pluginId: string;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

export class LongStackTracesComponent extends ComponentEx {
  private readonly app: App;
  private readonly pluginId: string;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: LongStackTracesComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginId = params.pluginId;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override async onloadAsync(): Promise<void> {
    if (Platform.isDesktop) {
      // The Node.js built-ins are loaded here, behind the desktop guard, and handed down, so that no module reaches them through a static import.
      const [desktopModule, asyncHooks, processModule] = await Promise.all([
        import('./desktop-long-stack-traces-component.ts'),
        /* eslint-disable import-x/no-nodejs-modules -- Guarded by Platform.isDesktop, which this rule cannot see; obsidianmd/no-nodejs-modules does. */
        import('node:async_hooks'),
        import('node:process')
        /* eslint-enable import-x/no-nodejs-modules -- Back on after the two desktop-guarded imports. */
      ]);
      const longStackTracesComponentDesktop = new desktopModule.LongStackTracesDesktopComponent({
        app: this.app,
        asyncHooks,
        nodeProcess: processModule.default,
        pluginId: this.pluginId,
        pluginSettingsComponent: this.pluginSettingsComponent
      });
      this.addChild(longStackTracesComponentDesktop);
    }

    registerAsyncEvent(
      this,
      this.pluginSettingsComponent.on('loadSettings', async (_loadedState, isInitialLoad) => {
        if (isInitialLoad) {
          return;
        }

        this.unload();
        await this.loadWithPromises();
      })
    );

    registerAsyncEvent(
      this,
      this.pluginSettingsComponent.on('saveSettings', async () => {
        this.unload();
        await this.loadWithPromises();
      })
    );
  }
}
