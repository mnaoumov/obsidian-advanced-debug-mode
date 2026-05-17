import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

// eslint-disable-next-line import-x/no-rename-default -- Need for test.
import MainExport from './main.ts';
import { Plugin } from './plugin.ts';

vi.mock('eruda', () => ({
  default: {
    init: vi.fn()
  }
}));

describe('main', () => {
  it('should export Plugin as default export', () => {
    expect(MainExport).toBe(Plugin);
  });
});
