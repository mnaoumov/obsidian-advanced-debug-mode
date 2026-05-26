import eruda from 'eruda';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';
import { ensureNonNullable } from 'obsidian-dev-utils/type-guards';

export class DevToolsComponent extends ComponentEx {
  private erudaButton?: HTMLDivElement;

  public constructor() {
    super();
  }

  public override onload(): void {
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need root document.
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

  private onFocusIn(evt: FocusEvent): void {
    evt.stopPropagation();
  }
}
