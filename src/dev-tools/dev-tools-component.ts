import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import eruda from 'eruda';
import { Platform } from 'obsidian';

export class DevToolsComponent extends ComponentEx {
  private erudaButton: HTMLDivElement | undefined;

  public constructor() {
    super();
  }

  public override onload(): void {
    // Eruda's console replaces every `console.*` method with a wrapper of its own, so while it exists DevTools links
    // each message, whoever logged it, to this plugin. A phone has no other console, and eruda only shows what is logged
    // after it starts, so there it starts with the plugin. On desktop it starts the first time its button is asked for.
    if (Platform.isMobileApp) {
      this.initEruda();
    }
  }

  public toggleDevToolsButton(): void {
    if (!this._loaded) {
      return;
    }

    const erudaButton = this.erudaButton ?? this.initEruda();
    erudaButton.toggle(!erudaButton.isShown());
  }

  private initEruda(): HTMLDivElement {
    const erudaDiv = document.body.createDiv();
    eruda.init({
      container: erudaDiv
    });

    const erudaButton = ensureNonNullable(erudaDiv.shadowRoot?.find('.eruda-entry-btn') as HTMLDivElement | undefined);
    erudaButton.hide();
    this.erudaButton = erudaButton;

    this.register(() => {
      eruda.destroy();
      erudaDiv.remove();
      this.erudaButton = undefined;
    });
    this.registerDomEvent(erudaDiv, 'focusin', this.onFocusIn.bind(this));
    return erudaButton;
  }

  private onFocusIn($event: FocusEvent): void {
    $event.stopPropagation();
  }
}
