import type { App } from 'obsidian';

export class DebugMode {
  public constructor(private readonly app: App) {}

  public isDebugMode(): boolean {
    return this.app.loadLocalStorage('DebugMode') === '1';
  }

  public toggleDebugMode(isEnabled: boolean): void {
    this.app.debugMode(isEnabled);
  }
}
