import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('Desktop Integration', () => {
  it('should load plugin on Desktop', () => {
    const vault = getTemporaryVault();
    expect(vault.path).toBeTruthy();
  });

  it('should have plugin loaded and enabled', async () => {
    const result = await evalInObsidian({
      callback({ app }) {
        const plugin = app.plugins.getPlugin('advanced-debug-mode');
        return {
          isEnabled: !!plugin,
          isLoaded: !!plugin?._loaded
        };
      }
    });

    expect(result.isEnabled).toBe(true);
    expect(result.isLoaded).toBe(true);
  });

  it('should have patched Error class for long stack traces', async () => {
    const result = await evalInObsidian({
      callback() {
        const error = new Error('integration test');
        return {
          hasStack: !!error.stack,
          message: error.message
        };
      }
    });

    expect(result.message).toBe('integration test');
    expect(result.hasStack).toBe(true);
  });

  it('should include long stack trace separators in async errors', async () => {
    interface AsyncErrorResult {
      readonly hasLongStackTrace: boolean;
      readonly stack: string;
    }

    const result = await evalInObsidian({
      async callback({ app }): Promise<AsyncErrorResult> {
        const pluginId = 'advanced-debug-mode';

        // Enable async long stack traces the way a real user would — persist the setting and reload the plugin so it re-reads it and activates the async-hooks tracking that links stack frames across `await` boundaries.
        await reloadWithAsyncLongStackTraces(true);

        try {
          // Production-style async code: an error created after awaiting a delay.
          await sleep(10);
          const error = new Error('async error');
          return {
            hasLongStackTrace: !!error.stack?.includes('at ---'),
            stack: error.stack ?? ''
          };
        } finally {
          // Restore the default so the remaining tests run unaffected.
          await reloadWithAsyncLongStackTraces(false);
        }

        async function reloadWithAsyncLongStackTraces(shouldIncludeAsyncLongStackTraces: boolean): Promise<void> {
          const plugin = app.plugins.getPlugin(pluginId);
          if (plugin) {
            await plugin.saveData({ shouldIncludeAsyncLongStackTraces });
          }
          await app.plugins.disablePlugin(pluginId);
          await app.plugins.enablePlugin(pluginId);
        }
      }
    });

    expect(result.hasLongStackTrace).toBe(true);
  });

  it('should pass CallSite arrays from a caller-installed Error.prepareStackTrace through both stack APIs', async () => {
    interface StructuredStackProbeResult {
      readonly firstFrameHasGetFileName: boolean;
      readonly isArray: boolean;
      readonly prepareStackTraceCallCount: number;
    }

    interface StackHolder {
      stack?: unknown;
    }

    // The probe `depd` (and so Local REST API) relies on: a formatter that returns the CallSite array.
    const result = await evalInObsidian({
      callback(): Record<string, StructuredStackProbeResult> {
        const hasOwnPrepareStackTrace = Object.hasOwn(Error, 'prepareStackTrace');
        const previousPrepareStackTrace = Error.prepareStackTrace;
        let prepareStackTraceCallCount = 0;
        const results: Record<string, StructuredStackProbeResult> = {};
        try {
          Error.prepareStackTrace = (_error, callSites): NodeJS.CallSite[] => {
            prepareStackTraceCallCount++;
            return callSites;
          };

          prepareStackTraceCallCount = 0;
          results['new Error().stack'] = describeStack(new Error('structured-stack probe').stack);

          prepareStackTraceCallCount = 0;
          const target: StackHolder = {};
          Error.captureStackTrace(target);
          results['Error.captureStackTrace()'] = describeStack(target.stack);
        } finally {
          if (hasOwnPrepareStackTrace) {
            Error.prepareStackTrace = previousPrepareStackTrace;
          } else {
            Reflect.deleteProperty(Error, 'prepareStackTrace');
          }
        }
        return results;

        function describeStack(stack: unknown): StructuredStackProbeResult {
          return {
            firstFrameHasGetFileName: Array.isArray(stack) && typeof (stack[0] as Partial<NodeJS.CallSite> | undefined)?.getFileName === 'function',
            isArray: Array.isArray(stack),
            prepareStackTraceCallCount
          };
        }
      }
    });

    const expected: StructuredStackProbeResult = { firstFrameHasGetFileName: true, isArray: true, prepareStackTraceCallCount: 1 };
    expect(result).toEqual({
      'Error.captureStackTrace()': expected,
      'new Error().stack': expected
    });
  });

  it('should have Error.stackTraceLimit set from settings', async () => {
    const result = await evalInObsidian({
      callback() {
        return {
          stackTraceLimit: Error.stackTraceLimit
        };
      }
    });

    expect(typeof result.stackTraceLimit).toBe('number');
  });

  it('should be able to read debug mode state', async () => {
    const result = await evalInObsidian({
      callback({ app }) {
        return {
          debugModeValue: app.loadLocalStorage('DebugMode') ?? ''
        };
      }
    });

    expect(typeof result.debugModeValue).toBe('string');
  });

  it('should have settings accessible', async () => {
    const result = await evalInObsidian({
      callback({ app }) {
        const plugin = app.plugins.getPlugin('advanced-debug-mode');
        if (!plugin) {
          return { hasSettings: false };
        }

        return {
          hasSettings: true
        };
      }
    });

    expect(result.hasSettings).toBe(true);
  });

  it('should register commands', async () => {
    const result = await evalInObsidian({
      callback({ app }) {
        const commands = Object.keys(app.commands.commands).filter((id) => id.startsWith('advanced-debug-mode:'));
        return { commands };
      }
    });

    expect(result.commands).toContain('advanced-debug-mode:open-settings');
    expect(result.commands).toContain('advanced-debug-mode:toggle-dev-tools-button');
    expect(result.commands).toContain('advanced-debug-mode:abort-shared-operation');
  });
});
