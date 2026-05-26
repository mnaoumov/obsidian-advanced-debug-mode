import type { App } from 'obsidian';
import type { PartialDeep } from 'type-fest';

import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { DebugMode } from './debug-mode.ts';

function createMockApp(overrides: PartialDeep<App> = {}): App {
  return strictProxy<App>(overrides);
}

describe('DebugMode', () => {
  it('should return true when debug mode is enabled', () => {
    const app = createMockApp({
      loadLocalStorage: vi.fn().mockReturnValue('1')
    });
    const debugMode = new DebugMode(app);
    expect(debugMode.isDebugMode()).toBe(true);
    expect(app.loadLocalStorage).toHaveBeenCalledWith('DebugMode');
  });

  it('should return false when debug mode is disabled', () => {
    const app = createMockApp({
      loadLocalStorage: vi.fn().mockReturnValue(null)
    });
    const debugMode = new DebugMode(app);
    expect(debugMode.isDebugMode()).toBe(false);
  });

  it('should return false when debug mode value is not 1', () => {
    const app = createMockApp({
      loadLocalStorage: vi.fn().mockReturnValue('0')
    });
    const debugMode = new DebugMode(app);
    expect(debugMode.isDebugMode()).toBe(false);
  });

  it('should call app.debugMode when toggling debug mode', () => {
    const app = createMockApp({
      debugMode: vi.fn()
    });
    const debugMode = new DebugMode(app);
    debugMode.toggleDebugMode(true);
    expect(app.debugMode).toHaveBeenCalledWith(true);
  });

  it('should call app.debugMode with false when disabling', () => {
    const app = createMockApp({
      debugMode: vi.fn()
    });
    const debugMode = new DebugMode(app);
    debugMode.toggleDebugMode(false);
    expect(app.debugMode).toHaveBeenCalledWith(false);
  });
});
