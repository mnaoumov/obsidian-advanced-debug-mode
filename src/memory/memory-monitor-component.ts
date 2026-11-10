import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';

import { registerAsyncEvent } from '@mnaoumov/obsidian-lib/components/async-events-component';
import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import {
  App,
  Platform
} from 'obsidian';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';
import type {
  DesktopMemoryMonitorComponent,
  MemoryMonitorSessionState
} from './desktop-memory-monitor-component.ts';

import { MemoryHistoryModal } from './memory-history-modal.ts';

interface MemoryMonitorComponentConstructorParams {
  readonly addStatusBarItem: () => HTMLElement;
  readonly app: App;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

const DIAGNOSTICS_FOLDER_NAME = 'obsidian-advanced-debug-mode';

export class MemoryMonitorComponent extends ComponentEx {
  private readonly addStatusBarItem: () => HTMLElement;
  private readonly app: App;
  private desktopComponent: DesktopMemoryMonitorComponent | null = null;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  // Kept on the facade, which is the same instance across the reloads a settings change triggers.
  private readonly sessionState: MemoryMonitorSessionState = { hasWrittenCriticalSnapshot: false };

  public constructor(params: MemoryMonitorComponentConstructorParams) {
    super();
    this.addStatusBarItem = params.addStatusBarItem;
    this.app = params.app;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  // `null` on mobile, where the renderer has no Node.js, and before the desktop part has loaded.
  public getDesktopComponent(): DesktopMemoryMonitorComponent | null {
    return this.desktopComponent;
  }

  public override async onloadAsync(): Promise<void> {
    if (Platform.isDesktop) {
      const desktopModule = await import('./desktop-memory-monitor-component.ts');
      // The Node.js built-ins are loaded here, behind the desktop guard, and handed down, so that no module reaches them through a static import.
      // They take `require()`, not `import()`: esbuild leaves a dynamic `import()` of an external module native, and the renderer cannot resolve a `node:` URL.
      /* eslint-disable import-x/no-nodejs-modules, @typescript-eslint/no-require-imports -- Guarded by Platform.isDesktop, which import-x cannot see and obsidianmd/no-nodejs-modules does; `require()` is the form that loads in the bundle. */
      const fs = require('node:fs') as typeof import('node:fs');
      const os = require('node:os') as typeof import('node:os');
      const path = require('node:path') as typeof import('node:path');
      const nodeProcess = require('node:process') as NodeJS.Process;
      const v8 = require('node:v8') as typeof import('node:v8');
      /* eslint-enable import-x/no-nodejs-modules, @typescript-eslint/no-require-imports -- Back on after the desktop-guarded loads. */
      const desktopComponent = new desktopModule.DesktopMemoryMonitorComponent({
        addStatusBarItem: this.addStatusBarItem,
        app: this.app,
        defaultDiagnosticsFolder: path.join(os.tmpdir(), DIAGNOSTICS_FOLDER_NAME, toSafeFolderName(this.app.vault.getName())),
        fs,
        getResidentSetSizeInBytes: (): number => nodeProcess.memoryUsage.rss(),
        now: (): number => Date.now(),
        onStatusBarClick: (): void => {
          this.openHistory();
        },
        path,
        pluginNoticeComponent: this.pluginNoticeComponent,
        pluginSettingsComponent: this.pluginSettingsComponent,
        sessionState: this.sessionState,
        v8
      });
      this.addChild(desktopComponent);
      this.desktopComponent = desktopComponent;
      this.register(() => {
        this.desktopComponent = null;
      });
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

  public openHistory(): void {
    if (!this.desktopComponent) {
      return;
    }

    new MemoryHistoryModal({ app: this.app, desktopComponent: this.desktopComponent }).open();
  }
}

function toSafeFolderName(name: string): string {
  return name.replaceAll(/[<>:"/\\|?*]/g, '_') || 'vault';
}
