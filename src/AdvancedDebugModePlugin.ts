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

  public toggleDebugMode(isEnabled: boolean): void {
    this.app.debugMode(isEnabled);
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
  }
}
