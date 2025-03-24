import { convertAsyncToSync } from 'obsidian-dev-utils/Async';
import type { AdvancedDebugModePlugin } from '../AdvancedDebugModePlugin.ts';
import { DevTools } from '../DevTools.ts';
import { DevToolsView } from './DevToolsView.ts';
class DevToolsImpl extends DevTools {
  public override registerDevTools(plugin: AdvancedDebugModePlugin): void {
    super.registerDevTools(plugin);

    plugin.registerView(DevToolsView.VIEW_TYPE, (leaf) => {
      return new DevToolsView(leaf);
    });

    plugin.addCommand({
      callback: convertAsyncToSync(this.openDevTools.bind(this)),
      id: 'open-dev-tools',
      name: 'Open Dev Tools'
    });
  }

  private async openDevTools(): Promise<void> {
    await this.plugin.app.workspace.ensureSideLeaf(DevToolsView.VIEW_TYPE, 'right');
  }
}

export const devTools = new DevToolsImpl();
