import {
  App,
  FileSystemAdapter
} from 'obsidian';
import { noopAsync } from 'obsidian-dev-utils/function';
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

    // eslint-disable-next-line no-restricted-syntax -- Test mock requires double assertion for FileSystemAdapter.
    const FileSystemAdapterConstructor = FileSystemAdapter as unknown as new (basePath: string) => FileSystemAdapter;
    const adapter = new FileSystemAdapterConstructor('');
    adapter.promise = noopAsync();
    adapter.killLastAction = vi.fn();
    adapter.thingsHappening = vi.fn();
    adapter.queue = vi.fn();

    (app as unknown as Record<string, unknown>)['vault'] = { adapter };
    (app as unknown as Record<string, unknown>)['obsidianDevUtilsState'] = {};
    (window as unknown as Record<string, unknown>)['app'] = app;

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

    (window as unknown as Record<string, unknown>)['app'] = undefined;
  });
});
