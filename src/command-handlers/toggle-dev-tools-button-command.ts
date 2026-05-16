import { GlobalCommandHandler } from 'obsidian-dev-utils/obsidian/command-handlers/global-command-handler';

import type { DevToolsComponent } from '../components/dev-tools-component.ts';

export class ToggleDevToolsButtonCommandHandler extends GlobalCommandHandler {
  public constructor(private readonly devToolsComponent: DevToolsComponent) {
    super({
      icon: 'keyboard-toggle',
      id: 'toggle-dev-tools-button',
      name: 'Toggle dev tools button'
    });
  }

  protected override execute(): void {
    this.devToolsComponent.toggleDevToolsButton();
  }
}
