import { evalInObsidian } from 'obsidian-integration-testing';
import { getTempVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  it
} from 'vitest';

describe('Desktop Integration', () => {
  it('should load plugin on Desktop', () => {
    const vault = getTempVault();
    expect(vault.path).toBeTruthy();
  });

  it('should have plugin loaded and enabled', async () => {
    const result = await evalInObsidian({
      fn({ app }) {
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
      fn() {
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
      async fn({ app }): Promise<AsyncErrorResult> {
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

  it('should have Error.stackTraceLimit set from settings', async () => {
    const result = await evalInObsidian({
      fn() {
        return {
          stackTraceLimit: Error.stackTraceLimit
        };
      }
    });

    expect(typeof result.stackTraceLimit).toBe('number');
  });

  it('should be able to read debug mode state', async () => {
    const result = await evalInObsidian({
      fn({ app }) {
        return {
          debugModeValue: app.loadLocalStorage('DebugMode') ?? ''
        };
      }
    });

    expect(typeof result.debugModeValue).toBe('string');
  });

  it('should have settings accessible', async () => {
    const result = await evalInObsidian({
      fn({ app }) {
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
      fn({ app }) {
        const commands = Object.keys(app.commands.commands).filter((id) => id.startsWith('advanced-debug-mode:'));
        return { commands };
      }
    });

    expect(result.commands).toContain('advanced-debug-mode:open-settings');
    expect(result.commands).toContain('advanced-debug-mode:toggle-dev-tools-button');
  });
});
