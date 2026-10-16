import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';
import eruda from 'eruda';

export class DevToolsComponent extends ComponentEx {
  private erudaButton?: HTMLDivElement;

  public constructor() {
    super();
  }

  public override onload(): void {
    const erudaDiv = document.body.createDiv();
    eruda.init({
      container: erudaDiv
    });

    this.erudaButton = ensureNonNullable(erudaDiv.shadowRoot?.find('.eruda-entry-btn') as HTMLDivElement | undefined);
    this.erudaButton.hide();

    this.register(() => {
      erudaDiv.remove();
    });
    this.registerDomEvent(erudaDiv, 'focusin', this.onFocusIn.bind(this));
  }

  public toggleDevToolsButton(): void {
    this.erudaButton?.toggle(!this.erudaButton.isShown());
  }

  private onFocusIn($event: FocusEvent): void {
    $event.stopPropagation();
  }
}
