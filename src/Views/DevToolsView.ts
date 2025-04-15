import eruda from 'eruda';
import { ItemView } from 'obsidian';

export class DevToolsView extends ItemView {
  public static VIEW_TYPE = 'advanced-debug-mode-dev-tools';

  public override getDisplayText(): string {
    return 'Dev tools';
  }

  public override getIcon(): string {
    return 'lucide-bug';
  }

  public override getViewType(): string {
    return DevToolsView.VIEW_TYPE;
  }

  public override async onClose(): Promise<void> {
    await super.onClose();

    eruda.destroy();
  }

  public override async onOpen(): Promise<void> {
    await super.onOpen();

    eruda.init({
      container: this.contentEl
    });

    eruda.show();
  }
}
