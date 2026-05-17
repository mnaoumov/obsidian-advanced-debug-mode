import type { App } from 'obsidian';

import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { EmulateMobileMode } from './emulate-mobile-mode.ts';

function createMockApp(overrides: Partial<App> = {}): App {
  // eslint-disable-next-line no-restricted-syntax -- Test mock requires double assertion.
  return overrides as unknown as App;
}

describe('EmulateMobileMode', () => {
  it('should return true when body has emulate-mobile class', () => {
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need root document.
    document.body.addClass('emulate-mobile');
    const app = createMockApp();
    const mode = new EmulateMobileMode(app);
    expect(mode.isEmulateMobileMode()).toBe(true);
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need root document.
    document.body.removeClass('emulate-mobile');
  });

  it('should return false when body does not have emulate-mobile class', () => {
    // eslint-disable-next-line obsidianmd/prefer-active-doc -- Need root document.
    document.body.removeClass('emulate-mobile');
    const app = createMockApp();
    const mode = new EmulateMobileMode(app);
    expect(mode.isEmulateMobileMode()).toBe(false);
  });

  it('should call app.emulateMobile when toggling', () => {
    const app = createMockApp({
      emulateMobile: vi.fn()
    });
    const mode = new EmulateMobileMode(app);
    mode.toggleEmulateMobileMode(true);
    expect(app.emulateMobile).toHaveBeenCalledWith(true);
  });

  it('should call app.emulateMobile with false when disabling', () => {
    const app = createMockApp({
      emulateMobile: vi.fn()
    });
    const mode = new EmulateMobileMode(app);
    mode.toggleEmulateMobileMode(false);
    expect(app.emulateMobile).toHaveBeenCalledWith(false);
  });
});
