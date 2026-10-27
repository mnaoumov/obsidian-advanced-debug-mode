import type { App } from 'obsidian';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import { openPluginDebugMessagesView } from './plugin-debug-messages-view.ts';

export class OpenPluginDebugMessagesViewCommandHandler extends GlobalCommandHandler {
  private readonly app: App;

  public constructor(app: App) {
    super({
      icon: 'bug',
      id: 'open-plugin-debug-messages-view',
      name: 'Open plugin debug messages'
    });
    this.app = app;
  }

  protected override async execute(): Promise<void> {
    await openPluginDebugMessagesView(this.app);
  }
}
