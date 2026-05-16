import type { App } from 'obsidian';

export class EmulateMobileMode {
  public constructor(private readonly app: App) {}

  public isEmulateMobileMode(): boolean {
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need root document.
    return document.body.hasClass('emulate-mobile');
  }

  public toggleEmulateMobileMode(isEnabled: boolean): void {
    this.app.emulateMobile(isEnabled);
  }
}
