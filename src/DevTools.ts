import type { AdvancedDebugModePlugin } from './AdvancedDebugModePlugin.ts';

export class DevTools {
  protected plugin!: AdvancedDebugModePlugin;

  public registerDevTools(plugin: AdvancedDebugModePlugin): void {
    this.plugin = plugin;
  }
}
