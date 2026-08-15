/**
 * @file
 *
 * Produces the mobile screenshots the community-store listing needs (T461-P21),
 * driving Obsidian Mobile on a real Android emulator and writing
 * `images/screenshots/screenshot-mobile-N.png`.
 *
 * The mobile set is deliberately NOT the desktop set. Long stack traces are
 * desktop-only — `LongStackTracesComponent` loads its implementation behind
 * `Platform.isDesktop` — so a phone frame captioned "the whole chain" would be
 * advertising something the reader's phone will never do. An early run proved it
 * the hard way: the same throw that keeps six frames on desktop keeps one here.
 *
 * What a phone DOES gain is the thing it has none of: dev tools. Obsidian Mobile
 * ships no console, no elements panel and no way to evaluate an expression
 * against the running app. This plugin adds all three, in-page, and that is what
 * these five frames show — every one of them a panel that would not otherwise
 * exist on the device.
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  captureObsidianScreenshot,
  evalInObsidian,
  labelScreenshot,
  readPngDimensions
} from 'obsidian-integration-testing';
import { getTemporaryVault } from 'obsidian-integration-testing/vitest-global-setup-plugin';
import {
  beforeAll,
  describe,
  expect,
  it
} from 'vitest';

/**
 * `App`, reduced to the font-size applier that `obsidian-typings` does not
 * declare. Setting `baseFontSize` alone changes nothing on screen.
 */
interface FontSizeApp {
  updateFontSize(this: void): void;
}

/**
 * `App`, reduced to the inline-title toggle that `obsidian-typings` does not
 * declare. Setting the config alone changes nothing on screen.
 */
interface InlineTitleApp {
  updateInlineTitleDisplay(this: void): void;
}

const WIDTH_IN_PIXELS = 900;
const HEIGHT_IN_PIXELS = 1600;

const PLUGIN_ID = 'advanced-debug-mode';

/**
 * Base font size for the mobile shots. A stack frame is a long line, and at
 * Obsidian's own 16px the console wraps every one of them on a 450dp screen.
 */
const MOBILE_FONT_SIZE_IN_PIXELS = 11;

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

beforeAll(async () => {
  const vault = getTemporaryVault();

  vault.populate({
    'Debugging notes.md': '# Debugging notes\n\nSomething is wrong, and the phone has no console.\n'
  });
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, fontSizeInPixels, lib: { waitUntil }, notePath }) {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 20_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      app.changeTheme('obsidian');

      await waitUntil({
        message: 'the staged note to appear in the vault',
        predicate: () => Boolean(app.vault.getFileByPath(notePath)),
        timeoutInMilliseconds: SETTLE_TIMEOUT_IN_MILLISECONDS
      });

      const file = app.vault.getFileByPath(notePath);
      if (file) {
        await app.workspace.getLeaf(false).openFile(file);
      }

      app.vault.setConfig('baseFontSize', fontSizeInPixels);
      const fontApp: unknown = app;
      (fontApp as FontSizeApp).updateFontSize();

      app.vault.setConfig('showInlineTitle', false);
      (fontApp as InlineTitleApp).updateInlineTitleDisplay();

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { fontSizeInPixels: MOBILE_FONT_SIZE_IN_PIXELS, notePath: 'Debugging notes.md' },
    vaultPath: vaultPath()
  });
});

describe('mobile store screenshots', () => {
  it('1 - a real error, with its stack', async () => {
    await openConsole();
    const trace = await logErrorToConsole('somethingWentWrong');
    expect(trace).toContain('somethingWentWrong');
    await shoot(1, 'A console on a phone, and the error in it');
  });

  it('2 - evaluate against the running app', async () => {
    const result = await evaluateInConsole('app.vault.getMarkdownFiles().length');
    expect(result).toMatch(/\d/);
    await shoot(2, 'Ask the running app a question, right here');
  });

  it('3 - the panels a phone never had', async () => {
    const tabNames = await openConsoleTab('elements');
    expect(tabNames.join(' ').toLowerCase()).toContain('elements');
    await shoot(3, 'Elements, network and resources — on a phone');
  });

  it('4 - what it puts on the palette', async () => {
    const commandNames = await openCommandPalette('Advanced Debug Mode');
    expect(commandNames.join('\n')).toContain('Toggle dev tools button');
    await shoot(4, 'Turn it on from the command palette');
  });
});

/**
 * Types an expression into the console and runs it.
 *
 * @param expression - The expression to evaluate.
 * @returns The console's text afterwards.
 */
async function evaluateInConsole(expression: string): Promise<string> {
  return await evalInObsidian({
    async callback({ expression: text, lib: { waitUntil } }) {
      const RESULT_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      // Cleared first: the previous shot left an EXPANDED error entry, and the
      // Console's virtualized list drew it straight over its own toolbar in the
      // Frame — a broken-looking panel that had nothing to do with the plugin.
      clearConsole();
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      const shadowRoot = findConsoleRoot();
      // eslint-disable-next-line unicorn/prefer-scoped-selector -- The root here is a ShadowRoot, against which `:scope` matches nothing.
      const input = shadowRoot?.querySelector('.eruda-js-input textarea');
      if (!(input instanceof HTMLTextAreaElement)) {
        throw new TypeError('The console has no input.');
      }

      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      const executeButton = shadowRoot?.querySelector('.eruda-execute');
      if (!(executeButton instanceof HTMLElement)) {
        throw new TypeError('The console has no execute button.');
      }

      executeButton.click();

      await waitUntil({
        message: 'the console to show a result',
        predicate: () => readConsoleText().includes(text),
        timeoutInMilliseconds: RESULT_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return readConsoleText();

      function findConsoleRoot(): null | ShadowRoot {
        const host = [...document.body.children].find((child) => Boolean(child.shadowRoot));
        return host?.shadowRoot ?? null;
      }

      function readConsoleText(): string {
        return findConsoleRoot()?.querySelector('.eruda-tools')?.textContent ?? '';
      }

      /**
       * Clears the console by clicking its own clear button. The `console.clear()`
       * API would be the obvious way and is not available here: this repo allows
       * only `warn` and `error` console calls and bans disabling that rule.
       * Clicking the button is what a reader would do anyway.
       */
      function clearConsole(): void {
        const clearButton = findConsoleRoot()?.querySelector('.eruda-clear-console');
        if (clearButton instanceof HTMLElement) {
          clearButton.click();
        }
      }
    },
    input: { expression },
    vaultPath: vaultPath()
  });
}

/**
 * Logs a real error and opens its stack in the console.
 *
 * The stack is short here, and honestly so: keeping the frames behind an async
 * boundary is a desktop-only feature, so this frame promises only what a phone
 * actually gets — the error, and where it came from.
 *
 * @param marker - A string put in the error message so the entry can be found.
 * @returns The console's visible text afterwards.
 */
async function logErrorToConsole(marker: string): Promise<string> {
  return await evalInObsidian({
    async callback({ lib: { waitUntil }, marker: errorMarker }) {
      const TRACE_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      function findConsoleRoot(): null | ShadowRoot {
        const host = [...document.body.children].find((child) => Boolean(child.shadowRoot));
        return host?.shadowRoot ?? null;
      }

      function readConsoleText(): string {
        return findConsoleRoot()?.querySelector('.eruda-tools')?.textContent ?? '';
      }

      /**
       * Clears the console by clicking its own clear button. The `console.clear()`
       * API would be the obvious way and is not available here: this repo allows
       * only `warn` and `error` console calls and bans disabling that rule.
       * Clicking the button is what a reader would do anyway.
       */
      function clearConsole(): void {
        const clearButton = findConsoleRoot()?.querySelector('.eruda-clear-console');
        if (clearButton instanceof HTMLElement) {
          clearButton.click();
        }
      }

      clearConsole();
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      function loadTheThing(): void {
        parseTheThing();
      }

      function parseTheThing(): void {
        throw new Error(`Error from ${errorMarker}`);
      }

      try {
        loadTheThing();
      } catch (error) {
        // The STACK, as text, rather than the error object. An error object is
        // Rendered collapsed and has to be expanded to show its frames, and on a
        // Phone-sized screen the console's virtualized list then draws the
        // Expanded entry straight over its own toolbar — a frame that looks
        // Broken and says nothing about the plugin. The string is the error's
        // Own `stack`, so nothing is lost but the click.
        console.error(error instanceof Error ? error.stack : String(error));
      }

      await waitUntil({
        message: 'the error to reach the console',
        predicate: () => readConsoleText().includes(errorMarker),
        timeoutInMilliseconds: TRACE_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return readConsoleText();
    },
    input: { marker },
    vaultPath: vaultPath()
  });
}

/**
 * Opens the command palette and filters it to this plugin's commands.
 *
 * @param query - What to type into the palette.
 * @returns The names of the commands this plugin registers.
 */
async function openCommandPalette(query: string): Promise<string[]> {
  return await evalInObsidian({
    async callback({ app, lib: { waitUntil }, pluginId, query: text }) {
      const PALETTE_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1200;

      app.commands.executeCommandById('command-palette:open');

      await waitUntil({
        message: 'the command palette to open',
        predicate: () => Boolean(document.querySelector('.prompt input')),
        timeoutInMilliseconds: PALETTE_TIMEOUT_IN_MILLISECONDS
      });

      const input = document.querySelector('.prompt input');
      if (!(input instanceof HTMLInputElement)) {
        throw new TypeError('The command palette has no input.');
      }

      input.value = text;
      // The palette filters from its own input handler, so setting the value
      // Alone would leave every command in the vault on screen.
      input.dispatchEvent(new Event('input'));

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return Object.values(app.commands.commands)
        .filter((command) => command.id.startsWith(`${pluginId}:`))
        .map((command) => command.name);
    },
    input: { pluginId: PLUGIN_ID, query },
    vaultPath: vaultPath()
  });
}

/**
 * Opens the in-page console the plugin ships.
 *
 * The entry button needs POINTER events: a bare `click()` leaves it shut, because
 * the console's own button listens for `pointerdown`/`pointerup` rather than a
 * synthesized click.
 */
async function openConsole(): Promise<void> {
  await evalInObsidian({
    async callback({ app, lib: { waitUntil }, pluginId }) {
      const OPEN_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      function findConsoleRoot(): null | ShadowRoot {
        const host = [...document.body.children].find((child) => Boolean(child.shadowRoot));
        return host?.shadowRoot ?? null;
      }

      function isConsoleOpen(): boolean {
        const panel = findConsoleRoot()?.querySelector('.eruda-dev-tools');
        return (panel?.getBoundingClientRect().height ?? 0) > 0;
      }

      if (!isConsoleOpen()) {
        app.commands.executeCommandById(`${pluginId}:toggle-dev-tools-button`);
        await sleep(SETTLE_DELAY_IN_MILLISECONDS);

        const entryButton = findConsoleRoot()?.querySelector('.eruda-entry-btn');
        if (!(entryButton instanceof HTMLElement)) {
          throw new TypeError('The dev tools button never appeared.');
        }

        const rect = entryButton.getBoundingClientRect();
        const eventInit = {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          composed: true,
          pointerId: 1,
          pointerType: 'mouse'
        };
        entryButton.dispatchEvent(new PointerEvent('pointerdown', eventInit));
        entryButton.dispatchEvent(new PointerEvent('pointerup', eventInit));
        entryButton.dispatchEvent(new MouseEvent('click', eventInit));

        await waitUntil({
          message: 'the in-page console to open',
          predicate: () => isConsoleOpen(),
          timeoutInMilliseconds: OPEN_TIMEOUT_IN_MILLISECONDS
        });
      }

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { pluginId: PLUGIN_ID },
    vaultPath: vaultPath()
  });
}

/**
 * Switches the in-page console to one of its tabs.
 *
 * @param tabName - The tab to switch to, lower-cased.
 * @returns The names of every tab the console offers.
 */
async function openConsoleTab(tabName: string): Promise<string[]> {
  return await evalInObsidian({
    async callback({ tabName: wantedTab }) {
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      const host = [...document.body.children].find((child) => Boolean(child.shadowRoot));
      const shadowRoot = host?.shadowRoot;
      const tabs = [...(shadowRoot?.querySelectorAll('.luna-tab-item') ?? new Array<Element>())];

      const wanted = tabs.find((tab) => tab.textContent.trim().toLowerCase() === wantedTab);
      if (wanted instanceof HTMLElement) {
        wanted.click();
      }

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return tabs.map((tab) => tab.textContent.trim());
    },
    input: { tabName },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the device screen, captions it, and writes it as
 * `images/screenshots/screenshot-mobile-<index>.png`.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const captured = await captureObsidianScreenshot({ vaultPath: vaultPath() });

  // The AVD is 900x1600, so the device frame IS the store's size. Asserting it
  // Here is what keeps that true: run this against any other AVD and it fails
  // Loudly instead of quietly shipping an off-spec image.
  expect(readPngDimensions(captured)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  const labeled = await labelScreenshot(captured, { text: caption });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-mobile-${String(index)}.png`), labeled);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}
