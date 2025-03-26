import type { PluginSettingTab } from 'obsidian';

import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import type { PlatformDependencies } from './PlatformDependencies.ts';

import { AdvancedDebugModePluginSettings } from './AdvancedDebugModePluginSettings.ts';
import { AdvancedDebugModePluginSettingsTab } from './AdvancedDebugModePluginSettingsTab.ts';
import { LongStackTracesHandler } from './LongStackTracesHandler.ts';
import { getPlatformDependencies } from './PlatformDependencies.ts';

export class AdvancedDebugModePlugin extends PluginBase<AdvancedDebugModePluginSettings> {
  private longStackTracesHandler!: LongStackTracesHandler;
  private platformDependencies!: PlatformDependencies;

  public applyNewSettings(): void {
    this.removeChild(this.longStackTracesHandler);
    this.longStackTracesHandler = new this.platformDependencies.LongStackTracesHandlerClass(this);
    this.addChild(this.longStackTracesHandler);
  }

  public isDebugMode(): boolean {
    return this.app.loadLocalStorage('DebugMode') === '1';
  }

  public override async onExternalSettingsChange(): Promise<void> {
    await super.onExternalSettingsChange();
    this.applyNewSettings();
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
    this.platformDependencies = await getPlatformDependencies();
    this.longStackTracesHandler = new this.platformDependencies.LongStackTracesHandlerClass(this);
    this.addChild(this.longStackTracesHandler);

    this.platformDependencies.devTools.registerDevTools(this);

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
