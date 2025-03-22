import type { PluginSettingTab } from 'obsidian';

import { EmptySettings } from 'obsidian-dev-utils/obsidian/Plugin/EmptySettings';
import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import { registerLongStackTraces } from './LongStackTraces.ts';

export class AdvancedDebugModePlugin extends PluginBase {
  protected override createPluginSettings(): EmptySettings {
    return new EmptySettings();
  }

  protected override createPluginSettingsTab(): null | PluginSettingTab {
    return null;
  }

  protected override onLayoutReady(): void {
    const state = this.isDebugMode() ? 'enabled' : 'disabled';
    const command = this.isDebugMode() ? 'Disable debug Mode' : 'Enable debug mode';
    this.showNotice(`Obsidian Debug Mode is ${state}. You can change it using command "${command}"`);
  }

  protected override onloadComplete(): void {
    registerLongStackTraces(this);

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
