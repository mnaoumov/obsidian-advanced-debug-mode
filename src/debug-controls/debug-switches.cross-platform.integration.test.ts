import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface DebugSwitchDefinitionLike {
  readonly description: string;
  readonly id: string;
  readonly isEnabledByDefault: boolean;
  readonly name: string;
}

interface PluginData {
  readonly debugSwitches?: unknown;
}

interface TypescriptLibStateSlot {
  readonly values: Record<string, undefined | ValueWrapperLike<unknown>>;
}

interface ValueWrapperLike<T> {
  readonly value: T;
}

// The registry lives in `@mnaoumov/typescript-lib`'s shared state, which every plugin's bundled copy of the library reads.
// The closures are serialized into the renderer, so they cannot import the library: they reach the state through the
// global slot instead, exactly as another plugin's copy of the library does.
describe('Debug switches', () => {
  it('should list a switch another plugin registers after the plugin loaded', async () => {
    const result = await evalInObsidian({
      async callback({ app }): Promise<string[]> {
        const slot = Reflect.get(window, Symbol.for('@mnaoumov/typescript-lib/state')) as TypescriptLibStateSlot | undefined;
        const definitions = slot?.values['debugSwitchDefinitions'] as undefined | ValueWrapperLike<Map<string, DebugSwitchDefinitionLike>>;
        if (!definitions) {
          throw new Error('The debug switch registry is missing');
        }

        const id = 'integration-test-plugin:late-switch';
        definitions.value.set(id, {
          description: 'Registered by another plugin after Advanced Debug Mode loaded.',
          id,
          isEnabledByDefault: false,
          name: 'Integration test late switch'
        });

        try {
          app.setting.open();
          app.setting.openTabById('advanced-debug-mode');
          await sleep(500);
          return Array.from(app.setting.activeTab?.containerEl.querySelectorAll('.setting-item-name') ?? [], (el) => el.textContent);
        } finally {
          app.setting.close();
          definitions.value.delete(id);
        }

        async function sleep(milliseconds: number): Promise<void> {
          await new Promise((resolve) => {
            window.setTimeout(resolve, milliseconds);
          });
        }
      }
    });

    expect(result).toContain('Integration test late switch');
    expect(result).toContain('Terminate operations on timeout');
  });

  it('should keep a switch changed in the settings tab across a plugin reload', async () => {
    interface ReloadResult {
      readonly isEnabledAfterReload: boolean | undefined;
      readonly isEnabledAfterToggle: boolean | undefined;
      readonly savedValues: unknown;
    }

    const result = await evalInObsidian({
      async callback({ app }): Promise<ReloadResult> {
        const pluginId = 'advanced-debug-mode';

        try {
          app.setting.open();
          app.setting.openTabById(pluginId);
          await sleep(500);
          const rows = [...app.setting.activeTab?.containerEl.querySelectorAll('.setting-item') ?? []];
          const row = rows.find((el) => el.querySelector('.setting-item-name')?.textContent === 'Terminate operations on timeout');
          const toggleEl = row?.querySelector<HTMLElement>('.checkbox-container');
          if (!toggleEl) {
            throw new Error('The terminate-on-timeout row has no toggle');
          }
          toggleEl.click();
          const isEnabledAfterToggle = getTerminateOnTimeoutValue();
          app.setting.close();

          // The value is saved by an async listener, so wait for it to reach the file.
          let savedValues: unknown;
          for (let attempt = 0; attempt < 50; attempt++) {
            const data = await app.plugins.getPlugin(pluginId)?.loadData() as PluginData | undefined;
            savedValues = data?.debugSwitches;
            if (savedValues && Object.keys(savedValues).length > 0) {
              break;
            }
            await sleep(100);
          }

          await app.plugins.disablePlugin(pluginId);
          await app.plugins.enablePlugin(pluginId);

          return {
            isEnabledAfterReload: getTerminateOnTimeoutValue(),
            isEnabledAfterToggle,
            savedValues
          };
        } finally {
          const plugin = app.plugins.getPlugin(pluginId);
          if (plugin) {
            await plugin.saveData({});
          }
          await app.plugins.disablePlugin(pluginId);
          await app.plugins.enablePlugin(pluginId);
        }

        function getTerminateOnTimeoutValue(): boolean | undefined {
          const slot = Reflect.get(window, Symbol.for('@mnaoumov/typescript-lib/state')) as TypescriptLibStateSlot | undefined;
          // The switch keeps the state key it had before the registry existed.
          return (slot?.values['isTerminationOnTimeoutEnabled'] as undefined | ValueWrapperLike<boolean>)?.value;
        }

        async function sleep(milliseconds: number): Promise<void> {
          await new Promise((resolve) => {
            window.setTimeout(resolve, milliseconds);
          });
        }
      }
    });

    expect(result).toEqual({
      isEnabledAfterReload: false,
      isEnabledAfterToggle: false,
      savedValues: { 'typescript-lib:terminate-on-timeout': false }
    });
  });
});
