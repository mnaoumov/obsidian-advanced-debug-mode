import { CommandInvocationBase } from 'obsidian-dev-utils/obsidian/Commands/CommandBase';
import { NonEditorCommandBase } from 'obsidian-dev-utils/obsidian/Commands/NonEditorCommandBase';

import type { DevToolsComponent } from '../Components/DevToolsComponent.ts';
import type { Plugin } from '../Plugin.ts';

class ToggleDevToolsButtonCommandInvocation extends CommandInvocationBase<Plugin> {
  public constructor(plugin: Plugin, private readonly devToolsComponent: DevToolsComponent) {
    super(plugin);
  }

  public override async execute(): Promise<void> {
    this.devToolsComponent.toggleDevToolsButton();
  }
}

export class ToggleDevToolsButtonCommand extends NonEditorCommandBase<Plugin> {
  public constructor(plugin: Plugin, private readonly devToolsComponent: DevToolsComponent) {
    super({
      icon: 'keyboard-toggle',
      id: 'toggle-dev-tools-button',
      name: 'Toggle dev tools button',
      plugin
    });
  }

  protected override createCommandInvocation(): CommandInvocationBase {
    return new ToggleDevToolsButtonCommandInvocation(this.plugin, this.devToolsComponent);
  }
}
