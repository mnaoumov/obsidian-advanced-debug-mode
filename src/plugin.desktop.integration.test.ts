// Merges the `ProvidedContext` augmentation, without which `inject('obsidianTransport')` below is a TS2345. The subpath is types-only, so it is a reference rather than an import.
/// <reference types="obsidian-integration-testing/vitest/typings" />
import { get } from 'node:http';
import { evalInObsidian } from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  describe,
  expect,
  inject,
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

  it('should leave console methods native until the dev tools button is asked for, and restore them on unload', async () => {
    interface ConsoleMethodsResult {
      readonly isNativeAfterLoad: boolean;
      readonly isNativeAfterToggle: boolean;
      readonly isNativeAfterUnload: boolean;
    }

    const result = await evalInObsidian({
      async callback({ app }): Promise<ConsoleMethodsResult> {
        const pluginId = 'advanced-debug-mode';

        // Eruda's console wraps every `console.*` method, and DevTools then links each message to this plugin. On desktop
        // it must not exist until its button is asked for, and unloading the plugin must put the native methods back.
        function isConsoleNative(): boolean {
          return ['debug', 'log', 'warn', 'error'].every((methodName) => Function.prototype.toString.call(Reflect.get(console, methodName)).includes('[native code]'));
        }

        const isNativeAfterLoad = isConsoleNative();
        app.commands.executeCommandById(`${pluginId}:toggle-dev-tools-button`);
        const isNativeAfterToggle = isConsoleNative();
        app.commands.executeCommandById(`${pluginId}:toggle-dev-tools-button`);
        await app.plugins.disablePlugin(pluginId);
        const isNativeAfterUnload = isConsoleNative();
        await app.plugins.enablePlugin(pluginId);
        return { isNativeAfterLoad, isNativeAfterToggle, isNativeAfterUnload };
      }
    });

    expect(result).toEqual({ isNativeAfterLoad: true, isNativeAfterToggle: false, isNativeAfterUnload: true });
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

  it('should keep AggregateError errors and message with long stack traces on', async () => {
    const result = await evalInObsidian({
      callback() {
        const error = new AggregateError([new Error('first child'), new TypeError('second child')], 'aggregate message');
        return {
          childMessages: Array.isArray(error.errors) ? error.errors.map((child: unknown) => (child as Error).message) : null,
          isAggregateError: error instanceof AggregateError,
          // A native `AggregateError` inherits from the native `Error`; the patched one inherits from the native `AggregateError`.
          isPatched: Object.getPrototypeOf(AggregateError) !== Error,
          message: error.message,
          stackHeader: error.stack?.split('\n', 1)[0]
        };
      }
    });

    expect(result).toEqual({
      childMessages: ['first child', 'second child'],
      isAggregateError: true,
      isPatched: true,
      message: 'aggregate message',
      stackHeader: 'AggregateError: aggregate message'
    });
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

    // The probe `depd` (and so `Local REST API`) relies on: a formatter that returns the CallSite array.
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

  it('should keep DevTools Console autocomplete working with async long stack traces on', async () => {
    interface CdpRemoteObject {
      readonly description?: string;
      readonly subtype?: string;
    }

    interface CdpResponse {
      readonly id: number;
      readonly result?: CdpEvaluateResult;
    }

    interface CdpEvaluateResult {
      readonly result: CdpRemoteObject;
    }

    interface CdpTarget {
      readonly type: string;
      readonly webSocketDebuggerUrl: string;
    }

    const transport = inject('obsidianTransport');
    if (transport?.type !== 'obsidian-cdp' || transport.port === undefined) {
      throw new Error('The desktop project must run on the CDP transport');
    }

    await setAsyncLongStackTraces(true);
    try {
      // DevTools' own completion request. REPL mode wraps the expression in an async function, so it runs every promise hook,
      // and `throwOnSideEffect` aborts the evaluation with an `EvalError` the moment one of them writes anything.
      const result = await sendCdpCommand(transport.port, 'Runtime.evaluate', {
        expression: 'app',
        generatePreview: false,
        includeCommandLineAPI: true,
        objectGroup: 'completion',
        replMode: true,
        returnByValue: false,
        silent: true,
        throwOnSideEffect: true,
        timeout: 500
      });
      expect(result.result?.result.subtype, result.result?.result.description).not.toBe('error');
    } finally {
      await setAsyncLongStackTraces(false);
    }

    async function sendCdpCommand(port: number, method: string, params: Record<string, unknown>): Promise<CdpResponse> {
      const targets = await readJson<CdpTarget[]>(`http://127.0.0.1:${String(port)}/json`);
      const page = targets.find((target) => target.type === 'page');
      if (!page) {
        throw new Error('No page target to evaluate in');
      }

      const webSocket = new WebSocket(page.webSocketDebuggerUrl);
      try {
        await new Promise((resolve, reject) => {
          webSocket.addEventListener('open', resolve, { once: true });
          webSocket.addEventListener('error', reject, { once: true });
        });
        return await new Promise<CdpResponse>((resolve) => {
          webSocket.addEventListener('message', (event) => {
            const response = JSON.parse(String(event.data)) as CdpResponse;
            if (response.id === 1) {
              resolve(response);
            }
          });
          webSocket.send(JSON.stringify({ id: 1, method, params }));
        });
      } finally {
        webSocket.close();
      }
    }

    async function readJson<T>(url: string): Promise<T> {
      // This half runs in Node, outside Obsidian, so it uses `node:http` rather than Obsidian's `requestUrl`.
      return await new Promise<T>((resolve, reject) => {
        get(url, (incomingMessage) => {
          const chunks: Buffer[] = [];
          incomingMessage.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });
          incomingMessage.on('end', () => {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T);
          });
          incomingMessage.on('error', reject);
        }).on('error', reject);
      });
    }
    async function setAsyncLongStackTraces(isEnabled: boolean): Promise<void> {
      await evalInObsidian({
        async callback({ app, shouldIncludeAsyncLongStackTraces }) {
          const pluginId = 'advanced-debug-mode';
          const plugin = app.plugins.getPlugin(pluginId);
          if (plugin) {
            await plugin.saveData({ shouldIncludeAsyncLongStackTraces });
          }
          await app.plugins.disablePlugin(pluginId);
          await app.plugins.enablePlugin(pluginId);
        },
        input: { shouldIncludeAsyncLongStackTraces: isEnabled }
      });
    }
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
    expect(result.commands).toContain('advanced-debug-mode:toggle-plugin-debug-messages');
  });
});
