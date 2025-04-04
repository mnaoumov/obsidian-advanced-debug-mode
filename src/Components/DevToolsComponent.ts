import {
  Component,
  Platform
} from 'obsidian';
import { convertAsyncToSync } from 'obsidian-dev-utils/Async';

import type { Plugin } from '../Plugin.ts';

import { DevToolsView } from '../Views/DevToolsView.ts';

export class DevToolsComponent extends Component {
  public constructor(private plugin: Plugin) {
    super();
  }

  public override onload(): void {
    if (!this.isEnabled()) {
      return;
    }

    this.plugin.registerView(DevToolsView.VIEW_TYPE, (leaf) => {
      return new DevToolsView(leaf);
    });

    this.plugin.addCommand({
      callback: convertAsyncToSync(this.openDevTools.bind(this)),
      id: 'open-dev-tools',
      name: 'Open Dev Tools'
    });
  }

  private isEnabled(): boolean {
    return Platform.isMobile;
  }

  private async openDevTools(): Promise<void> {
    await this.plugin.app.workspace.ensureSideLeaf(DevToolsView.VIEW_TYPE, 'right');
  }
}
