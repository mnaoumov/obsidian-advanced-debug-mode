import type { ExtractPluginSettingsWrapper } from 'obsidian-dev-utils/obsidian/Plugin/PluginTypesBase';
import type { ReadonlyDeep } from 'type-fest';

import { PluginBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginBase';

import type { PluginTypes } from './PluginTypes.ts';

import { DevToolsComponent } from './Components/DevToolsComponent.ts';
import { LongRunningTasksComponent } from './Components/LongRunningTasksComponent.ts';
import { LongStackTracesComponent } from './Components/LongStackTracesComponent.ts';
import { getPlatformDependencies } from './PlatformDependencies.ts';
import { PluginSettingsManager } from './PluginSettingsManager.ts';
import { PluginSettingsTab } from './PluginSettingsTab.ts';

export class Plugin extends PluginBase<PluginTypes> {
  private longRunningTasksComponent?: LongRunningTasksComponent;

  private longStackTracesComponent?: LongStackTracesComponent;
  public isDebugMode(): boolean {
    return this.app.loadLocalStorage('DebugMode') === '1';
  }

  public toggleDebugMode(isEnabled: boolean): void {
    this.app.debugMode(isEnabled);
  }

  protected override createSettingsManager(): PluginSettingsManager {
    return new PluginSettingsManager(this);
  }

  protected override createSettingsTab(): null | PluginSettingsTab {
    return new PluginSettingsTab(this);
  }

  protected override async onloadImpl(): Promise<void> {
    await super.onloadImpl();
    const originalStackTraceLimit = Error.stackTraceLimit;
    this.register(() => {
      Error.stackTraceLimit = originalStackTraceLimit;
    });

    const platformDependencies = await getPlatformDependencies();
    this.longStackTracesComponent = new platformDependencies.LongStackTracesComponentConstructor(this);
    this.addChild(this.longStackTracesComponent);
    this.longRunningTasksComponent = new LongRunningTasksComponent(this);
    this.addChild(this.longRunningTasksComponent);
    this.addChild(new DevToolsComponent(this));
  }

  protected override async onLoadSettings(
    loadedSettings: ReadonlyDeep<ExtractPluginSettingsWrapper<PluginTypes>>,
    isInitialLoad: boolean
  ): Promise<void> {
    await super.onLoadSettings(loadedSettings, isInitialLoad);
    if (!isInitialLoad) {
      this.reloadComponents();
    }
  }

  protected override async onSaveSettings(
    newSettings: ReadonlyDeep<ExtractPluginSettingsWrapper<PluginTypes>>,
    oldSettings: ReadonlyDeep<ExtractPluginSettingsWrapper<PluginTypes>>,
    context: unknown
  ): Promise<void> {
    await super.onSaveSettings(newSettings, oldSettings, context);
    this.reloadComponents();
  }

  private reloadComponents(): void {
    this.longRunningTasksComponent?.unload();
    this.longRunningTasksComponent?.load();
    this.longStackTracesComponent?.unload();
    this.longStackTracesComponent?.load();
  }
}
