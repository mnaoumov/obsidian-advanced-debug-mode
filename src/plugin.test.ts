import {
  App,
  FileSystemAdapter
} from 'obsidian';
import { noopAsync } from 'obsidian-dev-utils/function';
import { castTo } from 'obsidian-dev-utils/object-utils';
import { ensureGenericObject } from 'obsidian-dev-utils/type-guards';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { Plugin } from './plugin.ts';

vi.mock('eruda', () => ({
  default: {
    init: vi.fn()
  }
}));

describe('Plugin', () => {
  it('should export Plugin class', () => {
    expect(Plugin).toBeDefined();
    expect(typeof Plugin).toBe('function');
  });

  it('should construct with app and manifest', () => {
    const app = new App();

    const FileSystemAdapterConstructor = castTo<new (basePath: string) => FileSystemAdapter>(FileSystemAdapter);
    const adapter = new FileSystemAdapterConstructor('');
    adapter.promise = noopAsync();
    adapter.killLastAction = vi.fn();
    adapter.thingsHappening = vi.fn();
    adapter.queue = vi.fn();

    ensureGenericObject(app).vault = { adapter };
    ensureGenericObject(app).obsidianDevUtilsState = {};
    // eslint-disable-next-line @typescript-eslint/dot-notation, @typescript-eslint/no-deprecated -- Test setup: window.app is deprecated but required for plugin initialization.
    ensureGenericObject(window)['app'] = app;

    const manifest = {
      author: 'test',
      description: 'Test plugin',
      id: 'advanced-debug-mode',
      minAppVersion: '0.0.0',
      name: 'Advanced Debug Mode',
      version: '1.0.0'
    };

    expect(() => {
      new Plugin(app, manifest);
    }).not.toThrow();

    // eslint-disable-next-line @typescript-eslint/dot-notation, @typescript-eslint/no-deprecated -- Test teardown: cleaning up window.app.
    ensureGenericObject(window)['app'] = undefined;
  });
});
