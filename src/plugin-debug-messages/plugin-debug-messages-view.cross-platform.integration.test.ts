import type { DebugController } from '@mnaoumov/typescript-lib/debug-controller';

import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

declare global {
  interface Window {
    /**
     * The debug controller `@mnaoumov/typescript-lib` exposes for the DevTools console.
     */
    readonly DEBUG: DebugController;
  }
}

interface ViewResult {
  readonly isCheckedAfterConsoleDisable: boolean;
  readonly isCheckedAfterTick: boolean;
  readonly isCheckedBeforeTick: boolean;
  readonly namespacesAfterTick: string[];
  readonly namespacesBeforeTick: string[];
  readonly rowCount: number;
}

// The unit tests drive the view in jsdom. Only a real Obsidian proves the command opens it in a workspace leaf, that a
// trusted click on a row's checkbox changes the same `window.DEBUG` every plugin's `debug` loggers read, and that a
// change typed in the console reaches the open view.
describe('Plugin debug messages view', () => {
  it('should list the installed plugins, turn one on with a click, and follow a console change', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib }): Promise<ViewResult> {
        const PLUGIN_ID = 'advanced-debug-mode';
        const VIEW_TYPE = 'advanced-debug-mode-plugin-debug-messages';
        const ROW_SELECTOR = '.workspace-leaf-content[data-type="advanced-debug-mode-plugin-debug-messages"] .advanced-debug-mode-plugin-debug-messages-row';
        const originalNamespaces = window.DEBUG.get();

        function getCheckbox(): HTMLInputElement | null {
          const rows = document.querySelectorAll<HTMLElement>(ROW_SELECTOR);
          const row = [...rows].find((rowEl) => rowEl.querySelector('.advanced-debug-mode-plugin-debug-messages-id')?.textContent === PLUGIN_ID);
          return row?.querySelector('input') ?? null;
        }

        try {
          // Other suites leave library namespaces such as `typescript-lib` on, so only this plugin's own are cleared.
          window.DEBUG.set(originalNamespaces.filter((namespace) => !namespace.replace(/^-/, '').startsWith(PLUGIN_ID)));
          const namespacesBeforeTick = window.DEBUG.get();

          app.commands.executeCommandById(`${PLUGIN_ID}:open-plugin-debug-messages-view`);
          await lib.waitUntil({
            message: 'the view to list this plugin',
            predicate: () => getCheckbox() !== null
          });
          const rowCount = document.querySelectorAll(ROW_SELECTOR).length;
          const checkbox = getCheckbox();
          if (!checkbox) {
            throw new Error('The view lost its row.');
          }

          const isCheckedBeforeTick = checkbox.checked;
          await lib.clickElement({ element: checkbox });
          await lib.waitUntil({
            message: 'the click to turn the namespaces on',
            predicate: () => window.DEBUG.get().includes(PLUGIN_ID)
          });
          const namespacesAfterTick = window.DEBUG.get();
          const isCheckedAfterTick = getCheckbox()?.checked ?? false;

          window.DEBUG.set(namespacesBeforeTick);
          await lib.waitUntil({
            message: 'the view to follow the console change',
            predicate: () => getCheckbox()?.checked === false
          });
          const isCheckedAfterConsoleDisable = getCheckbox()?.checked ?? true;

          return { isCheckedAfterConsoleDisable, isCheckedAfterTick, isCheckedBeforeTick, namespacesAfterTick, namespacesBeforeTick, rowCount };
        } finally {
          window.DEBUG.set(originalNamespaces);
          app.workspace.detachLeavesOfType(VIEW_TYPE);
        }
      }
    });

    expect(result.isCheckedBeforeTick).toBe(false);
    expect(result.namespacesAfterTick).toEqual([...result.namespacesBeforeTick, 'advanced-debug-mode', 'advanced-debug-mode:*']);
    expect(result.isCheckedAfterTick).toBe(true);
    expect(result.isCheckedAfterConsoleDisable).toBe(false);
    // The library row plus at least this plugin.
    expect(result.rowCount).toBeGreaterThanOrEqual(2);
  });
});
