import type { PluginSettingTab } from 'obsidian';

import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import { AdvancedDebugModePluginSettings } from './AdvancedDebugModePluginSettings.ts';
import { AdvancedDebugModePluginSettingsTab } from './AdvancedDebugModePluginSettingsTab.ts';
import { DevToolsComponent } from './Components/DevToolsComponent.ts';
import { LongRunningTasksComponent } from './Components/LongRunningTasksComponent.ts';
import { LongStackTracesComponent } from './Components/LongStackTracesComponent.ts';
import { getPlatformDependencies } from './PlatformDependencies.ts';

export class AdvancedDebugModePlugin extends PluginBase<AdvancedDebugModePluginSettings> {
  private longRunningTasksComponent!: LongRunningTasksComponent;
  private longStackTracesComponent!: LongStackTracesComponent;

  public isDebugMode(): boolean {
    return this.app.loadLocalStorage('DebugMode') === '1';
  }

  public reloadLongRunningTasksComponent(): void {
    this.longRunningTasksComponent.unload();
    this.longRunningTasksComponent.load();
  }

  public reloadLongStackTracesHandler(): void {
    this.longStackTracesComponent.unload();
    this.longStackTracesComponent.load();
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
    this.longStackTracesComponent = new platformDependencies.LongStackTracesComponentConstructor(this);
    this.addChild(this.longStackTracesComponent);
    this.addChild(new LongRunningTasksComponent(this));
    this.addChild(new DevToolsComponent(this));
  }
}
