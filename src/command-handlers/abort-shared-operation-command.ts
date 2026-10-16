import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';

import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import { abortSharedOperation } from '../abort-shared-operation.ts';

export class AbortSharedOperationCommandHandler extends GlobalCommandHandler {
  public constructor(private readonly pluginNoticeComponent: PluginNoticeComponent) {
    super({
      // `ban` rather than a more literal `octagon-x`/`circle-stop`: it is the one cancel glyph that has kept
      // its name across every lucide version, so it renders whichever one the running Obsidian bundles.
      icon: 'ban',
      id: 'abort-shared-operation',
      name: 'Abort the running operation'
    });
  }

  protected override execute(): void {
    abortSharedOperation(this.pluginNoticeComponent);
  }
}
