import type { PluginSettingTab } from 'obsidian';

import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import { AdvancedDebugModePluginSettings } from './AdvancedDebugModePluginSettings.ts';
import { AdvancedDebugModePluginSettingsTab } from './AdvancedDebugModePluginSettingsTab.ts';
import { LongStackTracesHandler } from './LongStackTracesHandler.ts';
import { getPlatformDependencies } from './PlatformDependencies.ts';

export class AdvancedDebugModePlugin extends PluginBase<AdvancedDebugModePluginSettings> {
  private longStackTracesHandler!: LongStackTracesHandler;

  public isDebugMode(): boolean {
    return this.app.loadLocalStorage('DebugMode') === '1';
  }

  public reloadLongStackTracesHandler(): void {
    this.longStackTracesHandler.unload();
    this.longStackTracesHandler.load();
  }

  public toggleDebugModeWithCheck(isEnabled: boolean, checking: boolean): boolean {
    if (!checking) {
      this.app.debugMode(isEnabled);
    }
    return this.isDebugMode() !== isEnabled;
  }

  protected override createPluginSettings(data: unknown): AdvancedDebugModePluginSettings {
    return new AdvancedDebugModePluginSettings(data);
  }

  protected override createPluginSettingsTab(): null | PluginSettingTab {
    return new AdvancedDebugModePluginSettingsTab(this);
  }

  protected override async onloadComplete(): Promise<void> {
    const platformDependencies = await getPlatformDependencies();
    this.longStackTracesHandler = new platformDependencies.LongStackTracesHandlerClass(this);
    this.addChild(this.longStackTracesHandler);
    platformDependencies.devTools.registerDevTools(this);

    this.addCommand({
      checkCallback: (checking) => this.toggleDebugModeWithCheck(true, checking),
      id: 'enable-debug-mode',
      name: 'Enable debug mode (this will reload the app)'
    });

    this.addCommand({
      checkCallback: (checking) => this.toggleDebugModeWithCheck(false, checking),
      id: 'disable-debug-mode',
      name: 'Disable debug mode (this will reload the app)'
    });
  }
}
