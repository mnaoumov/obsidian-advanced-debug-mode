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

interface ToggleResult {
  readonly itemTexts: string[];
  readonly namespacesAfterFirstPick: string[];
  readonly namespacesAfterSecondPick: string[];
  readonly namespacesBeforeFirstPick: string[];
}

// The unit tests drive the picker through a mocked `selectItem`. Only a real Obsidian proves the command is registered,
// that its fuzzy picker lists the installed plugins with their state, and that choosing one changes the same
// `window.DEBUG` every plugin's `debug` loggers read.
describe('Toggle debug messages for a plugin', () => {
  it('should turn the chosen plugin\'s namespaces on, then off again', async () => {
    const result = await evalInObsidian({
      async callback({ app, lib }): Promise<ToggleResult> {
        const PLUGIN_ID = 'advanced-debug-mode';
        const PROMPT_INPUT_SELECTOR = '.prompt .prompt-input';
        const originalNamespaces = window.DEBUG.get();

        async function pick(): Promise<string[]> {
          app.commands.executeCommandById(`${PLUGIN_ID}:toggle-plugin-debug-messages`);
          await lib.waitUntil({
            message: 'the plugin picker to open',
            predicate: () => document.querySelector(PROMPT_INPUT_SELECTOR) !== null
          });
          const inputEl = document.querySelector<HTMLInputElement>(PROMPT_INPUT_SELECTOR);
          if (!inputEl) {
            throw new Error('The plugin picker has no input.');
          }

          inputEl.focus();
          inputEl.value = `(${PLUGIN_ID})`;
          inputEl.dispatchEvent(new Event('input'));
          await lib.waitUntil({
            message: 'the picker to narrow to one plugin',
            predicate: () => document.querySelectorAll('.prompt .suggestion-item').length === 1
          });
          const itemTexts = [...document.querySelectorAll('.prompt .suggestion-item')].map((el) => el.textContent);
          await lib.pressKey({ key: 'Enter' });
          await lib.waitUntil({
            message: 'the plugin picker to close',
            predicate: () => document.querySelector(PROMPT_INPUT_SELECTOR) === null
          });
          return itemTexts;
        }

        try {
          // Other suites leave library namespaces such as `typescript-lib` on, so only this plugin's own are cleared.
          window.DEBUG.set(originalNamespaces.filter((namespace) => !namespace.replace(/^-/, '').startsWith(PLUGIN_ID)));
          const namespacesBeforeFirstPick = window.DEBUG.get();
          const itemTexts = await pick();
          const namespacesAfterFirstPick = window.DEBUG.get();
          await pick();
          const namespacesAfterSecondPick = window.DEBUG.get();
          return { itemTexts, namespacesAfterFirstPick, namespacesAfterSecondPick, namespacesBeforeFirstPick };
        } finally {
          window.DEBUG.set(originalNamespaces);
        }
      }
    });

    expect(result.itemTexts).toEqual(['Off: Advanced Debug Mode (advanced-debug-mode)']);
    expect(result.namespacesAfterFirstPick).toEqual([...result.namespacesBeforeFirstPick, 'advanced-debug-mode', 'advanced-debug-mode:*']);
    expect(result.namespacesAfterSecondPick).toEqual(result.namespacesBeforeFirstPick);
  });
});
