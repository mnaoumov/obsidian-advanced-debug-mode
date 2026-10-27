import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import { ErrorStackTraceLimitComponent } from './error-stack-trace-limit-component.ts';

describe('ErrorStackTraceLimitComponent', () => {
  let originalStackTraceLimit: number;

  beforeEach(() => {
    originalStackTraceLimit = Error.stackTraceLimit;
  });

  afterEach(() => {
    Error.stackTraceLimit = originalStackTraceLimit;
  });

  it('should restore original stackTraceLimit on unload', () => {
    const CUSTOM_LIMIT = 999;
    Error.stackTraceLimit = CUSTOM_LIMIT;

    const component = new ErrorStackTraceLimitComponent();
    component.load();

    Error.stackTraceLimit = 10;
    component.unload();

    expect(Error.stackTraceLimit).toBe(CUSTOM_LIMIT);
  });

  it('should capture stackTraceLimit at load time', () => {
    const FIRST_LIMIT = 50;
    const SECOND_LIMIT = 200;
    Error.stackTraceLimit = FIRST_LIMIT;

    const component = new ErrorStackTraceLimitComponent();
    component.load();

    Error.stackTraceLimit = SECOND_LIMIT;
    component.unload();

    expect(Error.stackTraceLimit).toBe(FIRST_LIMIT);
  });
});
