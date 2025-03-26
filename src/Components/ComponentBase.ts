import { Component } from 'obsidian';

export class ComponentBase extends Component {
  public override onload(): void {
    super.onload();

    if (!this.isEnabled()) {
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
