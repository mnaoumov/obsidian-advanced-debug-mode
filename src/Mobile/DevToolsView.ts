import { ItemView } from 'obsidian';

import eruda from 'eruda';

export class DevToolsView extends ItemView {

  public static VIEW_TYPE = 'advanced-debug-mode-dev-tools';

  public override getViewType(): string {
    return DevToolsView.VIEW_TYPE;
  }

  public override getDisplayText(): string {
    return 'Dev Tools';
  }

  public override async onClose(): Promise<void> {
    eruda.destroy();
  }

  public override getIcon(): string {
    return 'lucide-bug';
  }

  public override async onOpen(): Promise<void> {
    super.onOpen();

    eruda.init({
      container: this.contentEl
    });

    eruda.show();
  }
}
