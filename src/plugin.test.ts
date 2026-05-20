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
  // Note: Plugin extends PluginBase which extends AsyncComponent.
  // The obsidian-test-mocks Component mock uses `loaded__` / `children__`
  // While obsidian-dev-utils AsyncComponent accesses `_loaded` / `_children`.
  // This naming mismatch prevents load()/unload() from working in unit tests.
  // Full lifecycle testing is covered by integration tests.

  it('should export Plugin class', () => {
    expect(Plugin).toBeDefined();
    expect(typeof Plugin).toBe('function');
  });
});
