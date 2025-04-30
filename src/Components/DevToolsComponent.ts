import eruda from 'eruda';
import {
  Component,
  Platform
} from 'obsidian';
import { throwExpression } from 'obsidian-dev-utils/Error';

import type { Plugin } from '../Plugin.ts';

export class DevToolsComponent extends Component {
  private erudaButton!: HTMLElement;

  public constructor(private plugin: Plugin) {
    super();
  }

  public override onload(): void {
    if (!this.isEnabled()) {
      return;
    }

    const erudaDiv = document.body.createDiv();
    eruda.init({
      container: erudaDiv
    });

    this.erudaButton = erudaDiv.shadowRoot?.find('.eruda-entry-btn') ?? throwExpression(new Error('Eruda button not found'));
    this.erudaButton.hide();

    this.plugin.addCommand({
      callback: this.toggleDevToolsButton.bind(this),
      id: 'toggle-dev-tools-button',
      name: 'Toggle dev tools button'
    });

    this.register(() => {
      erudaDiv.remove();
    });
    this.registerDomEvent(erudaDiv, 'focusin', this.onFocusIn.bind(this));
  }

  private isEnabled(): boolean {
    return Platform.isMobile;
  }

  private onFocusIn(evt: FocusEvent): void {
    evt.stopPropagation();
  }

  private toggleDevToolsButton(): void {
    this.erudaButton.toggle(!this.erudaButton.isShown());
  }
}
