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
      const desktopModule = await import('./desktop-long-stack-traces-component.ts');
      // The Node.js built-ins are loaded here, behind the desktop guard, and handed down, so that no module reaches them through a static import.
      // They take `require()`, not `import()`: esbuild leaves a dynamic `import()` of an external module native, and the renderer cannot resolve a `node:` URL.
      /* eslint-disable import-x/no-nodejs-modules, @typescript-eslint/no-require-imports -- Guarded by Platform.isDesktop, which import-x cannot see and obsidianmd/no-nodejs-modules does; `require()` is the form that loads in the bundle. */
      const nodeProcess = require('node:process') as NodeJS.Process;
      const v8 = require('node:v8') as typeof import('node:v8');
      /* eslint-enable import-x/no-nodejs-modules, @typescript-eslint/no-require-imports -- Back on after the two desktop-guarded loads. */
      const longStackTracesComponentDesktop = new desktopModule.LongStackTracesDesktopComponent({
        app: this.app,
        nodeProcess,
        pluginId: this.pluginId,
        pluginSettingsComponent: this.pluginSettingsComponent,
        promiseHooks: v8.promiseHooks
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
