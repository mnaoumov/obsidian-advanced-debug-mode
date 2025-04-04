import type { PluginSettingTab } from 'obsidian';
import type { PluginSettingsManagerBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsManagerBase';

import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import type { PluginSettings } from './PluginSettings.ts';

import { DevToolsComponent } from './Components/DevToolsComponent.ts';
import { LongRunningTasksComponent } from './Components/LongRunningTasksComponent.ts';
import { LongStackTracesComponent } from './Components/LongStackTracesComponent.ts';
import { getPlatformDependencies } from './PlatformDependencies.ts';
import { PluginSettingsManager } from './PluginSettingsManager.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';

export class Plugin extends PluginBase<PluginSettings> {
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

  public updateStackTraceLimit(): void {
    Error.stackTraceLimit = this.settings.stackTraceLimit || Infinity;
  }

  protected override createPluginSettingsTab(): null | PluginSettingTab {
    return new PluginSettingsTab(this);
  }

  protected override createSettingsManager(): PluginSettingsManagerBase<PluginSettings> {
    return new PluginSettingsManager(this);
  }

  protected override async onloadComplete(): Promise<void> {
    const originalStackTraceLimit = Error.stackTraceLimit;
    this.register(() => {
      Error.stackTraceLimit = originalStackTraceLimit;
    });

    const platformDependencies = await getPlatformDependencies();
    this.longStackTracesComponent = new platformDependencies.LongStackTracesComponentConstructor(this);
    this.addChild(this.longStackTracesComponent);
    this.addChild(new LongRunningTasksComponent(this));
    this.addChild(new DevToolsComponent(this));
  }
}
