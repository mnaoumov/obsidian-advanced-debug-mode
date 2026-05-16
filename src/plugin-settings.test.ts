import {
  describe,
  expect,
  it
} from 'vitest';

import { PluginSettings } from './plugin-settings.ts';

describe('PluginSettings', () => {
  it('should have correct default values', () => {
    const settings = new PluginSettings();
    expect(settings.shouldIncludeAsyncLongStackTraces).toBe(false);
    expect(settings.shouldIncludeInternalStackFrames).toBe(false);
    expect(settings.shouldIncludeLongStackTraces).toBe(true);
    expect(settings.shouldIncludeTimedOutTasksDetails).toBe(true);
    expect(settings.shouldTimeoutLongRunningTasks).toBe(true);
    expect(settings.stackTraceLimit).toBe(100);
  });

  it('should allow setting properties', () => {
    const settings = new PluginSettings();
    settings.shouldIncludeAsyncLongStackTraces = true;
    settings.shouldIncludeInternalStackFrames = true;
    settings.shouldIncludeLongStackTraces = false;
    settings.shouldIncludeTimedOutTasksDetails = false;
    settings.shouldTimeoutLongRunningTasks = false;
    settings.stackTraceLimit = 50;
    expect(settings.shouldIncludeAsyncLongStackTraces).toBe(true);
    expect(settings.shouldIncludeInternalStackFrames).toBe(true);
    expect(settings.shouldIncludeLongStackTraces).toBe(false);
    expect(settings.shouldIncludeTimedOutTasksDetails).toBe(false);
    expect(settings.shouldTimeoutLongRunningTasks).toBe(false);
    expect(settings.stackTraceLimit).toBe(50);
  });
});
