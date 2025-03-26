import { Component } from 'obsidian';
import { noop } from 'obsidian-dev-utils/Function';

export class ComponentBase extends Component {
  public override onload(): void {
    super.onload();

    if (!this.isEnabled()) {
      noop();
    }
  }

  public reload(): void {
    this.unload();
    this.load();
  }

  protected isEnabled(): boolean {
    return true;
  }
}
