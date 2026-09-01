/**
 * @file
 *
 * Produces the desktop screenshots the community-store listing needs
 * (T461-P21), driving a real Obsidian and writing
 * `images/screenshots/screenshot-desktop-N.png`.
 *
 * The subject of this plugin is a STACK TRACE, which normally lives in DevTools —
 * a separate window that no capture of the Obsidian window can show. The way out
 * is the plugin's own answer to the same problem: it ships an in-page console
 * (the one it exists to give mobile), and that console renders inside the page,
 * so it photographs.
 *
 * Every trace in frame is real. The suite throws an error through a chain of
 * async boundaries — `setTimeout`, `queueMicrotask`, `requestAnimationFrame`, a
 * promise — exactly as the demo vault's own button does, and photographs what the
 * console then shows. Shot 1 is that same error with the feature OFF, so the
 * before/after is one error and one setting apart, not two different errors.
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
 * `App`, reduced to the inline-title toggle that `obsidian-typings` does not
 * declare. Setting the config alone changes nothing on screen.
 */
interface InlineTitleApp {
  updateInlineTitleDisplay(this: void): void;
}

const WIDTH_IN_PIXELS = 1200;
const HEIGHT_IN_PIXELS = 800;

const PLUGIN_ID = 'advanced-debug-mode';

/**
 * The command the last shot is about: the one that turns the dev tools on.
 * Typed into the palette verbatim, so the row the picture highlights is the row
 * the caption means.
 */
const TOGGLE_COMMAND_NAME = 'Toggle dev tools button';

/**
 * How many frames of the chain a trace has to show before the shot may claim the
 * frames were kept. The chain has six named hops; without the plugin only the
 * throwing one survives.
 */
const MINIMUM_KEPT_FRAMES = 4;

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

beforeAll(async () => {
  const vault = getTemporaryVault();

  vault.populate({
    'Debugging notes.md': '# Debugging notes\n\nWhere did that error actually come from?\n'
  });
  await vault.syncToDevice();

  await evalInObsidian({
    async callback({ app, lib: { waitUntil }, notePath }) {
      const SETTLE_TIMEOUT_IN_MILLISECONDS = 20_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1000;

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

      // The console panel is the subject in most frames, and it covers the
      // Bottom half of the window; the side docks would leave the note a sliver.
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();

      app.vault.setConfig('showInlineTitle', false);
      const inlineTitleApp: unknown = app;
      (inlineTitleApp as InlineTitleApp).updateInlineTitleDisplay();

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { notePath: 'Debugging notes.md' },
    vaultPath: vaultPath()
  });
});

describe('desktop store screenshots', () => {
  it('1 - the stack you get without it', async () => {
    await setFeatures({ isAsyncEnabled: false, isLongStackTracesEnabled: false });
    await openConsole();
    const trace = await throwThroughAsyncBoundaries('withoutPlugin');
    // The whole complaint in one assertion: the frames that scheduled the work
    // Are gone, so almost nothing of the chain is left.
    expect(countKeptFrames(trace)).toBeLessThan(MINIMUM_KEPT_FRAMES);
    await shoot(1, 'Without it: the throw, and no idea who called');
  });

  it('2 - the stack you get with it', async () => {
    await setFeatures({ isAsyncEnabled: false, isLongStackTracesEnabled: true });
    await openConsole();
    const trace = await throwThroughAsyncBoundaries('withPlugin');
    expect(countKeptFrames(trace)).toBeGreaterThanOrEqual(MINIMUM_KEPT_FRAMES);
    await shoot(2, 'With it: the whole chain, hop by hop');
  });

  it('3 - the same across await', async () => {
    await setFeatures({ isAsyncEnabled: true, isLongStackTracesEnabled: true });
    await openConsole();
    const trace = await throwThroughAwaits('acrossAwait');
    expect(trace).toContain('acrossAwait');
    await shoot(3, 'Across await too, when you opt in');
  });

  it('4 - a console inside Obsidian', async () => {
    const tabNames = await openConsoleTab('elements');
    // Not a log pane: the tabs are the ones DevTools has, which is the point of
    // Shipping it to a platform that has no DevTools at all.
    expect(tabNames.join(' ').toLowerCase()).toContain('elements');
    await shoot(4, 'Real dev tools, inside the app itself');
  });

  it('5 - the command that turns it on', async () => {
    // The console from shot 4 covers four fifths of the window, and a palette
    // Photographed through it is one clipped row of a command nobody asked about.
    // The subject here is Obsidian itself, so the console goes away first.
    await closeConsole();
    const palette = await openCommandPalette(TOGGLE_COMMAND_NAME);
    expect(palette.visible.join('\n')).toContain(TOGGLE_COMMAND_NAME);
    expect(palette.selected).toContain(TOGGLE_COMMAND_NAME);
    await shoot(5, 'Turn it on from the command palette');
  });
});

/**
 * Closes the in-page console and takes its floating button away with it.
 *
 * The panel is toggled off through the same entry button that opened it — one
 * trusted click again, for the same reason — and the button is then hidden through
 * the plugin's own command, which leaves the window in the state a reader is in
 * BEFORE they run it. That is what the palette shot is a picture of.
 */
async function closeConsole(): Promise<void> {
  await evalInObsidian({
    async callback({ app, lib: { clickElement, waitUntil }, pluginId }) {
      const CLOSE_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      function findConsoleRoot(): null | ShadowRoot {
        const host = [...document.body.children].find((child) => Boolean(child.shadowRoot));
        return host?.shadowRoot ?? null;
      }

      function findEntryButton(): HTMLElement | null {
        const entryButton = findConsoleRoot()?.querySelector('.eruda-entry-btn');
        return entryButton instanceof HTMLElement ? entryButton : null;
      }

      function isConsoleOpen(): boolean {
        const panel = findConsoleRoot()?.querySelector('.eruda-dev-tools');
        return (panel?.getBoundingClientRect().height ?? 0) > 0;
      }

      if (isConsoleOpen()) {
        const entryButton = findEntryButton();
        if (!entryButton) {
          throw new TypeError('The dev tools button is gone, so the console cannot be closed.');
        }

        // One trusted click, from which Chromium synthesizes the whole pointerdown -> pointerup -> click
        // Sequence this used to hand-build — and eruda's own handlers see `isTrusted === true`.
        await clickElement({ element: entryButton });

        await waitUntil({
          message: 'the in-page console to close',
          predicate: () => !isConsoleOpen(),
          timeoutInMilliseconds: CLOSE_TIMEOUT_IN_MILLISECONDS
        });
      }

      // The command toggles the BUTTON, not the panel, so it is only useful once
      // The panel is already shut — otherwise it would leave a console on screen
      // With no way back to it.
      if (findEntryButton()?.isShown() ?? false) {
        app.commands.executeCommandById(`${pluginId}:toggle-dev-tools-button`);
      }

      // The Elements shot leaves a DOM highlighter behind: a full-window canvas
      // Over `body` plus the info tooltip that names it, which in a frame about
      // The palette reads as a rendering fault. Closing the console does not
      // Take it with it, because it is mounted on a SECOND shadow host of its
      // Own (`.__chobitsu-hide__`) rather than inside the console's — hence the
      // Sweep over every shadow host in the document rather than a look in one
      // Of them.
      for (const host of document.querySelectorAll('*')) {
        const hostShadowRoot = host.shadowRoot;
        if (!hostShadowRoot) {
          continue;
        }

        for (const highlighter of hostShadowRoot.querySelectorAll('.luna-dom-highlighter')) {
          if (highlighter.instanceOf(HTMLElement)) {
            highlighter.hide();
          }
        }
      }

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);
    },
    input: { pluginId: PLUGIN_ID },
    vaultPath: vaultPath()
  });
}

/**
 * Counts how many hops of the thrown chain the trace still names.
 *
 * @param trace - The stack trace as the console shows it.
 * @returns How many of the chain's named frames survived.
 */
function countKeptFrames(trace: string): number {
  return HOP_NAMES.filter((name) => trace.includes(name)).length;
}

/**
 * Opens the command palette, filters it, and reads back what is ON SCREEN.
 *
 * Deliberately the rendered rows rather than `app.commands.commands`: the
 * registry answers the same whether the palette is on screen, empty, or buried
 * under the console — which is how this shot once shipped with a clipped
 * "Open settings" under a caption about turning the dev tools on.
 *
 * @param query - What to type into the palette.
 * @returns The suggestions the palette is showing, and the one it has selected.
 */
async function openCommandPalette(query: string): Promise<PaletteState> {
  return await evalInObsidian({
    async callback({ app, lib: { waitUntil }, query: text }) {
      const PALETTE_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1200;
      const RESIZE_SETTLE_DELAY_IN_MILLISECONDS = 2000;

      /**
       * The suggestions a reader would see: rendered, and with a height, so a
       * Row scrolled out of the list cannot stand in for one in frame.
       *
       * @returns Each visible suggestion's text.
       */
      function readVisibleItems(): string[] {
        return [...document.querySelectorAll('.prompt-results .suggestion-item')]
          .filter((item) => item.getBoundingClientRect().height > 0)
          .map((item) => item.textContent.trim());
      }

      /**
       * @returns The text of the highlighted suggestion, or an empty string.
       */
      function readSelectedItem(): string {
        const selected = document.querySelector('.prompt-results .suggestion-item.is-selected');
        return selected?.textContent.trim() ?? '';
      }

      await sleep(RESIZE_SETTLE_DELAY_IN_MILLISECONDS);

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

      await waitUntil({
        message: 'the palette to filter down to the typed command',
        predicate: () => readVisibleItems().some((item) => item.includes(text)),
        timeoutInMilliseconds: PALETTE_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return {
        selected: readSelectedItem(),
        visible: readVisibleItems()
      };
    },
    input: { query },
    vaultPath: vaultPath()
  });
}

/**
 * Opens the in-page console the plugin ships.
 *
 * The entry button needs real POINTER events: a bare `click()` leaves it shut,
 * because the console's own button listens for `pointerdown`/`pointerup` rather
 * than a synthesized click. A trusted click supplies the whole sequence, so
 * Chromium produces them and eruda sees `isTrusted === true`.
 */
async function openConsole(): Promise<void> {
  await evalInObsidian({
    async callback({ app, lib: { clickElement, waitUntil }, pluginId }) {
      const OPEN_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;
      const RESIZE_SETTLE_DELAY_IN_MILLISECONDS = 2000;

      await sleep(RESIZE_SETTLE_DELAY_IN_MILLISECONDS);

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

        // One trusted click, from which Chromium synthesizes the whole pointerdown -> pointerup -> click
        // Sequence this used to hand-build — and eruda's own handlers see `isTrusted === true`.
        await clickElement({ element: entryButton });

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
      const RESIZE_SETTLE_DELAY_IN_MILLISECONDS = 2000;

      await sleep(RESIZE_SETTLE_DELAY_IN_MILLISECONDS);

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
 * Turns the two stack-trace features on or off.
 *
 * Written to the settings FILE and followed by a plugin reload: the settings
 * component hands out a copy, and the patches that keep the frames are installed
 * at load time.
 *
 * @param params - Which features to enable.
 */
async function setFeatures(params: SetFeaturesParams): Promise<void> {
  await evalInObsidian({
    async callback({ app, isAsyncEnabled, isLongStackTracesEnabled, lib: { waitUntil }, pluginId }) {
      const RELOAD_TIMEOUT_IN_MILLISECONDS = 20_000;
      const DATA_PATH = `.obsidian/plugins/${pluginId}/data.json`;

      let settings: Record<string, unknown>;
      try {
        settings = JSON.parse(await app.vault.adapter.read(DATA_PATH)) as Record<string, unknown>;
      } catch {
        settings = {};
      }

      settings['shouldIncludeLongStackTraces'] = isLongStackTracesEnabled;
      settings['shouldIncludeAsyncLongStackTraces'] = isAsyncEnabled;
      await app.vault.adapter.write(DATA_PATH, JSON.stringify(settings, null, 2));

      await app.plugins.disablePlugin(pluginId);
      await app.plugins.enablePlugin(pluginId);

      await waitUntil({
        message: 'the plugin to register its commands again',
        predicate: () => Object.hasOwn(app.commands.commands, `${pluginId}:toggle-dev-tools-button`),
        timeoutInMilliseconds: RELOAD_TIMEOUT_IN_MILLISECONDS
      });
    },
    input: {
      isAsyncEnabled: params.isAsyncEnabled,
      isLongStackTracesEnabled: params.isLongStackTracesEnabled,
      pluginId: PLUGIN_ID
    },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the window, captions it, and writes it as
 * `images/screenshots/screenshot-desktop-<index>.png`.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const bytes = await captureObsidianScreenshot({
    heightInPixels: HEIGHT_IN_PIXELS,
    vaultPath: vaultPath(),
    widthInPixels: WIDTH_IN_PIXELS
  });

  const labeled = await labelScreenshot(bytes, { text: caption });

  expect(readPngDimensions(labeled)).toStrictEqual({
    heightInPixels: HEIGHT_IN_PIXELS,
    widthInPixels: WIDTH_IN_PIXELS
  });

  mkdirSync(IMAGES_DIRECTORY, { recursive: true });
  writeFileSync(join(IMAGES_DIRECTORY, `screenshot-desktop-${String(index)}.png`), labeled);
}

/**
 * Throws an error through a chain of async boundaries and returns what the
 * console then shows.
 *
 * The same shape as the demo vault's own button: each hop schedules the next
 * through a different mechanism, and every one of them is a place the engine
 * normally drops the frames behind it.
 *
 * @param marker - A string put in the error message so the trace can be found.
 * @returns The console's text after the error lands.
 */
async function throwThroughAsyncBoundaries(marker: string): Promise<string> {
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

      /**
       * The console renders an error COLLAPSED — one line, with the frames in the
       * DOM but not on screen. A shot captioned "the whole chain" has to open it,
       * and the text read back afterwards is the VISIBLE text, so the assertion
       * describes the picture rather than the document.
       */
      function expandErrorEntry(text: string): void {
        // eslint-disable-next-line unicorn/prefer-scoped-selector -- The root here is a ShadowRoot, against which `:scope` matches nothing.
        const entries = [...(findConsoleRoot()?.querySelectorAll('.luna-console-logs > *') ?? new Array<Element>())];
        for (const entry of entries) {
          if (entry.textContent.includes(text) && entry.instanceOf(HTMLElement)) {
            entry.click();
          }
        }
      }

      function readVisibleTraceText(): string {
        // eslint-disable-next-line unicorn/prefer-scoped-selector -- The root here is a ShadowRoot, against which `:scope` matches nothing.
        const entries = [...(findConsoleRoot()?.querySelectorAll('.luna-console-logs > *') ?? new Array<Element>())];
        return entries
          .filter((entry) => entry.getBoundingClientRect().height > 0)
          .map((entry) => entry.textContent)
          .join('\n');
      }

      clearConsole();
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      function hopThroughTimeout(): void {
        window.setTimeout(hopThroughMicrotask, 10);
      }

      function hopThroughMicrotask(): void {
        queueMicrotask(hopThroughAnimationFrame);
      }

      function hopThroughAnimationFrame(): void {
        window.requestAnimationFrame(() => {
          hopThroughPromise();
        });
      }

      function hopThroughPromise(): void {
        // A real promise boundary, and deliberately not `Promise.resolve()`:
        // This repo's lint rewrites that into `noopAsync()`, which a serialized
        // Closure cannot see — the rewritten chain dies with a bare
        // ReferenceError inside Obsidian.
        Promise.allSettled([])
          .then(hopThroughInterval)
          .catch(() => {
            // Ignored: the throw below is the subject.
          });
      }

      function hopThroughInterval(): void {
        const intervalId = window.setInterval(() => {
          window.clearInterval(intervalId);
          // Caught and logged rather than left uncaught: Obsidian Mobile's webview
          // Never handed the uncaught error to the console, so half the mobile set
          // Had nothing to photograph. The stack is the error's own either way —
          // Catching it in the frame that threw changes nothing about what the
          // Plugin kept.
          try {
            throwIt();
          } catch (error) {
            console.error(error);
          }
        }, 10);
      }

      function throwIt(): void {
        throw new Error(`Error from ${errorMarker}`);
      }

      hopThroughTimeout();

      await waitUntil({
        message: 'the error to reach the console',
        predicate: () => readConsoleText().includes(errorMarker),
        timeoutInMilliseconds: TRACE_TIMEOUT_IN_MILLISECONDS
      });

      expandErrorEntry(errorMarker);

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return readVisibleTraceText();
    },
    input: { marker },
    vaultPath: vaultPath()
  });
}

/**
 * Throws an error through a chain of `await`s and returns what the console shows.
 *
 * @param marker - A string put in the error message so the trace can be found.
 * @returns The console's text after the error lands.
 */
async function throwThroughAwaits(marker: string): Promise<string> {
  return await evalInObsidian({
    async callback({ lib: { waitUntil }, marker: errorMarker }) {
      const TRACE_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;
      const HOP_DELAY_IN_MILLISECONDS = 10;

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

      /**
       * The console renders an error COLLAPSED — one line, with the frames in the
       * DOM but not on screen. A shot captioned "the whole chain" has to open it,
       * and the text read back afterwards is the VISIBLE text, so the assertion
       * describes the picture rather than the document.
       */
      function expandErrorEntry(text: string): void {
        // eslint-disable-next-line unicorn/prefer-scoped-selector -- The root here is a ShadowRoot, against which `:scope` matches nothing.
        const entries = [...(findConsoleRoot()?.querySelectorAll('.luna-console-logs > *') ?? new Array<Element>())];
        for (const entry of entries) {
          if (entry.textContent.includes(text) && entry.instanceOf(HTMLElement)) {
            entry.click();
          }
        }
      }

      function readVisibleTraceText(): string {
        // eslint-disable-next-line unicorn/prefer-scoped-selector -- The root here is a ShadowRoot, against which `:scope` matches nothing.
        const entries = [...(findConsoleRoot()?.querySelectorAll('.luna-console-logs > *') ?? new Array<Element>())];
        return entries
          .filter((entry) => entry.getBoundingClientRect().height > 0)
          .map((entry) => entry.textContent)
          .join('\n');
      }

      clearConsole();
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      async function awaitFirst(): Promise<void> {
        await sleep(HOP_DELAY_IN_MILLISECONDS);
        await awaitSecond();
      }

      async function awaitSecond(): Promise<void> {
        await sleep(HOP_DELAY_IN_MILLISECONDS);
        await awaitThird();
      }

      async function awaitThird(): Promise<void> {
        await sleep(HOP_DELAY_IN_MILLISECONDS);
        throw new Error(`Error from ${errorMarker}`);
      }

      // Deliberately not awaited: an unhandled rejection is what reaches the
      // Console, which is the thing being photographed.
      awaitFirst().catch((error: unknown) => {
        console.error(error);
      });

      await waitUntil({
        message: 'the error to reach the console',
        predicate: () => readConsoleText().includes(errorMarker),
        timeoutInMilliseconds: TRACE_TIMEOUT_IN_MILLISECONDS
      });

      expandErrorEntry(errorMarker);

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return readVisibleTraceText();
    },
    input: { marker },
    vaultPath: vaultPath()
  });
}

function vaultPath(): string {
  return getTemporaryVault().path;
}

/**
 * The named hops of the thrown chain, in order.
 */
const HOP_NAMES = [
  'hopThroughTimeout',
  'hopThroughMicrotask',
  'hopThroughAnimationFrame',
  'hopThroughPromise',
  'hopThroughInterval',
  'throwIt'
];

/**
 * What the command palette is showing, as opposed to what it could show.
 */
interface PaletteState {
  /**
   * The text of the highlighted suggestion — the command the shot is about.
   */
  readonly selected: string;

  /**
   * The text of every suggestion with a height on screen.
   */
  readonly visible: string[];
}

/**
 * Parameters for {@link setFeatures}.
 */
interface SetFeaturesParams {
  readonly isAsyncEnabled: boolean;
  readonly isLongStackTracesEnabled: boolean;
}
