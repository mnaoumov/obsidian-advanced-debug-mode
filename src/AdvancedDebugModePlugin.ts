import type { PluginSettingTab } from 'obsidian';

import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import { AdvancedDebugModePluginSettings } from './AdvancedDebugModePluginSettings.ts';
import { AdvancedDebugModePluginSettingsTab } from './AdvancedDebugModePluginSettingsTab.ts';
import { getPlatformDependencies } from './PlatformDependencies.ts';

export class AdvancedDebugModePlugin extends PluginBase<AdvancedDebugModePluginSettings> {
  protected override createPluginSettings(data: unknown): AdvancedDebugModePluginSettings {
    return new AdvancedDebugModePluginSettings(data);
  }

  protected override createPluginSettingsTab(): null | PluginSettingTab {
    return new AdvancedDebugModePluginSettingsTab(this);
  }

  protected override onLayoutReady(): void {
    const state = this.isDebugMode() ? 'enabled' : 'disabled';
    const command = this.isDebugMode() ? 'Disable debug Mode' : 'Enable debug mode';
    this.showNotice(`Obsidian Debug Mode is ${state}. You can change it using command "${command}"`);
  }

  protected override async onloadComplete(): Promise<void> {
    const platformDependencies = await getPlatformDependencies();
    platformDependencies.longStackTracesHandler.registerLongStackTraces(this);
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

  private isDebugMode(): boolean {
    return this.app.loadLocalStorage('DebugMode') === '1';
  }

  private toggleDebugModeWithCheck(isEnabled: boolean, checking: boolean): boolean {
    if (!checking) {
      this.app.debugMode(isEnabled);
    }
    return this.isDebugMode() !== isEnabled;
  }
}
