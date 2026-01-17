import eruda from 'eruda';
import {
  Component,
  Platform
} from 'obsidian';
import { throwExpression } from 'obsidian-dev-utils/Error';

import type { Plugin } from '../Plugin.ts';

import { ToggleDevToolsButtonCommand } from '../Commands/ToggleDevToolsButtonCommand.ts';

export class DevToolsComponent extends Component {
  private erudaButton?: HTMLDivElement;

  public constructor(private readonly plugin: Plugin) {
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

    this.erudaButton = erudaDiv.shadowRoot?.find('.eruda-entry-btn') as HTMLDivElement | undefined ?? throwExpression(new Error('Eruda button not found'));
    this.erudaButton.hide();

    new ToggleDevToolsButtonCommand(this.plugin, this).register();

    this.register(() => {
      erudaDiv.remove();
    });
    this.registerDomEvent(erudaDiv, 'focusin', this.onFocusIn.bind(this));
  }

  public toggleDevToolsButton(): void {
    this.erudaButton?.toggle(!this.erudaButton.isShown());
  }

  private isEnabled(): boolean {
    return Platform.isMobile;
  }

  private onFocusIn(evt: FocusEvent): void {
    evt.stopPropagation();
  }
}
