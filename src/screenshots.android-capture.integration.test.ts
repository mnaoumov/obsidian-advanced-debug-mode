/**
 * @file
 *
 * Produces the mobile screenshots the community-store listing needs,
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
 * the first three frames show — every one of them a panel that would not
 * otherwise exist on the device. The fourth is the command that summons them,
 * and is the reason this set is four frames where the desktop one is five: the
 * desktop set spends three on the before/after of a stack trace, which is a
 * story a phone has no part in.
 */

import {
  mkdirSync,
  writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  captureDeviceScreenshot,
  captureObsidianScreenshot,
  evalInObsidian,
  labelScreenshot,
  raiseSoftKeyboard,
  readPngDimensions,
  resolveEmulatorDeviceId,
  withSoftKeyboardEnabled
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
 * The console's own tab, lower-cased as the tab strip renders it.
 *
 * Named because every shot that drives the console has to select it first — see shot 2.
 */
const CONSOLE_TAB_NAME = 'console';

/**
 * The command the last shot is about: the one that turns the dev tools on.
 * Typed into the palette verbatim, so the row the picture highlights is the row
 * the caption means.
 */
const TOGGLE_COMMAND_NAME = 'Toggle dev tools button';

/**
 * Base font size for the mobile shots. A stack frame is a long line, and at
 * Obsidian's own 16px the console wraps every one of them on a 450dp screen.
 */
const MOBILE_FONT_SIZE_IN_PIXELS = 11;

const IMAGES_DIRECTORY = join(process.cwd(), 'images', 'screenshots');

/**
 * The AVD the frames are taken on, matched by name.
 *
 * Never the first device `adb devices` lists: a physical phone is routinely plugged into the same
 * machine, and the shared AVD the cross-platform suites drive is a different size.
 */
const AVD_NAME = 'obsidian_screenshots';

/**
 * Obsidian's command palette input, as {@link openCommandPalette} finds it.
 *
 * `.prompt input`, which is not the `.prompt-input` a suggester renders — read off the suite rather than
 * assumed.
 */
const PALETTE_INPUT_SELECTOR = '.prompt input';

let deviceId = '';

beforeAll(async () => {
  deviceId = await resolveEmulatorDeviceId({ avdName: AVD_NAME });

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
    await openConsoleTab(CONSOLE_TAB_NAME);
    const trace = await logErrorToConsole('somethingWentWrong');
    expect(trace).toContain('somethingWentWrong');
    await shoot(1, 'A console on a phone, and the error in it');
  });

  it('2 - evaluate against the running app', async () => {
    // The console tab is SELECTED per shot rather than assumed. eruda remembers its last-active tool
    // And the device's app data outlives the run, so shot 3's switch to Elements is still in effect
    // When the next run starts here — which left these shots photographing the wrong panel while
    // Driving buttons that were laid out at zero size.
    //
    // This shot keeps the PAGE capture even though it ends on a focused field, which is the one place in
    // This suite where that is a deliberate decision rather than the default. Raising the soft keyboard
    // Here was tried and measured: the keyboard came up and covered the console's output panel, the eval
    // Field and the Execute button — that is, everything the caption promises — leaving a frame of a tab
    // Strip above an empty white panel. The console is an overlay Obsidian does not lift for the IME the
    // Way it lifts its own modals, so there is nowhere for the answer to go. Do not switch this one.
    await openConsoleTab(CONSOLE_TAB_NAME);
    const result = await evaluateInConsole('app.vault.getMarkdownFiles().length');
    expect(result).toMatch(/\d/);
    await shoot(2, 'Ask the running app a question, right here');
  });

  it('3 - the panels a phone never had', async () => {
    const selectedTab = await openConsoleTab('elements');
    expect(selectedTab).toBe('elements');
    await shoot(3, 'Elements, network and resources — on a phone');
  });

  it('4 - the command that turns it on', async () => {
    // The console from shot 3 fills most of the screen, and a palette
    // Photographed through it is two half-rows of which the highlighted one is
    // Not the command the caption means. The subject here is Obsidian itself.
    await closeConsole();
    const palette = await openCommandPalette(TOGGLE_COMMAND_NAME);
    expect(palette.visible.join('\n')).toContain(TOGGLE_COMMAND_NAME);
    expect(palette.selected).toContain(TOGGLE_COMMAND_NAME);
    await shootWithSoftKeyboard(4, 'Turn it on from the command palette', PALETTE_INPUT_SELECTOR);
  });
});

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
 * Closes the in-page console and takes its floating button away with it.
 *
 * The panel is toggled off through the same entry button that opened it — a real
 * tap again, for the same reason — and the button is then hidden through the
 * plugin's own command, which leaves the screen in the state a reader is in
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

      // The Elements shot leaves a DOM highlighter behind: a full-screen canvas
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
 * Types an expression into the console and runs it.
 *
 * @param expression - The expression to evaluate.
 * @returns The console's text afterwards.
 */
async function evaluateInConsole(expression: string): Promise<string> {
  return await evalInObsidian({
    async callback({ expression: text, lib: { clickElement, waitUntil } }) {
      /*
       * Under the transport's ~30s per-closure cap, not at it.
       * Two waits and three render settles share this one budget, so at 15_000 apiece it declared 34.5s.
       * The eval is killed at the cap first and reported as a bare transport timeout.
       * That names the harness rather than the wait that overran.
       * What is waited on here lands in well under a second, so the smaller ceiling costs nothing.
       */
      const RESULT_TIMEOUT_IN_MILLISECONDS = 8000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      // Cleared first: the previous shot left an EXPANDED error entry, and the
      // Console's virtualized list drew it straight over its own toolbar in the
      // Frame — a broken-looking panel that had nothing to do with the plugin.
      await clearConsole();
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      const shadowRoot = findConsoleRoot();
      // eslint-disable-next-line unicorn/prefer-scoped-selector -- The root here is a ShadowRoot, against which `:scope` matches nothing.
      const input = shadowRoot?.querySelector('.eruda-js-input textarea');
      if (!(input instanceof HTMLTextAreaElement)) {
        throw new TypeError('The console has no input.');
      }

      // The JS-input bar is COLLAPSED to a single line until it is focused, and Cancel/Execute are laid
      // Out at ZERO SIZE the whole time it is. A real tap is what expands it — setting `.value` never
      // Does — and a trusted tap on a zero-size button is hit-tested to whatever is actually at that
      // Point, which here is the editor behind the console. The untrusted `click()` this replaced fired
      // On the invisible button regardless, which is why the collapse never mattered before.
      await clickElement({ element: input });
      await waitUntil({
        message: 'the console input to expand, giving Execute a size',
        predicate: () => (findConsoleRoot()?.querySelector('.eruda-execute')?.getBoundingClientRect().height ?? 0) > 0,
        timeoutInMilliseconds: RESULT_TIMEOUT_IN_MILLISECONDS
      });

      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      const executeButton = shadowRoot?.querySelector('.eruda-execute');
      if (!(executeButton instanceof HTMLElement)) {
        throw new TypeError('The console has no execute button.');
      }

      await clickElement({ element: executeButton });

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
        // The CONSOLE's own panel, not `.eruda-tools` — that is the container of EVERY tool, so its
        // `textContent` includes panels that are not on screen. Reading it let an assertion about what
        // The console shows be satisfied by text inside a hidden console while a different tool was
        // Displayed, so the shot passed and photographed the wrong panel.
        return findConsoleRoot()?.querySelector('.eruda-console')?.textContent ?? '';
      }

      /**
       * Clears the console by clicking its own clear button. The `console.clear()`
       * API would be the obvious way and is not available here: this repo allows
       * only `warn` and `error` console calls and bans disabling that rule.
       * Clicking the button is what a reader would do anyway.
       */
      async function clearConsole(): Promise<void> {
        const clearButton = findConsoleRoot()?.querySelector('.eruda-clear-console');
        if (clearButton instanceof HTMLElement) {
          await clickElement({ element: clearButton });
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
    async callback({ lib: { clickElement, waitUntil }, marker: errorMarker }) {
      const TRACE_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      function findConsoleRoot(): null | ShadowRoot {
        const host = [...document.body.children].find((child) => Boolean(child.shadowRoot));
        return host?.shadowRoot ?? null;
      }

      function readConsoleText(): string {
        // The CONSOLE's own panel, not `.eruda-tools` — that is the container of EVERY tool, so its
        // `textContent` includes panels that are not on screen. Reading it let an assertion about what
        // The console shows be satisfied by text inside a hidden console while a different tool was
        // Displayed, so the shot passed and photographed the wrong panel.
        return findConsoleRoot()?.querySelector('.eruda-console')?.textContent ?? '';
      }

      /**
       * Clears the console by clicking its own clear button. The `console.clear()`
       * API would be the obvious way and is not available here: this repo allows
       * only `warn` and `error` console calls and bans disabling that rule.
       * Clicking the button is what a reader would do anyway.
       */
      async function clearConsole(): Promise<void> {
        const clearButton = findConsoleRoot()?.querySelector('.eruda-clear-console');
        if (clearButton instanceof HTMLElement) {
          await clickElement({ element: clearButton });
        }
      }

      await clearConsole();
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
 * Opens the command palette, filters it, and reads back what is ON SCREEN.
 *
 * Deliberately the rendered rows rather than `app.commands.commands`: the
 * registry answers the same whether the palette is on screen, empty, or buried
 * under the console — which is how this shot once shipped with a highlighted
 * "Open settings" under a caption about turning the dev tools on.
 *
 * @param query - What to type into the palette.
 * @returns The suggestions the palette is showing, and the one it has selected.
 */
async function openCommandPalette(query: string): Promise<PaletteState> {
  return await evalInObsidian({
    async callback({ app, lib: { waitUntil }, query: text }) {
      /*
       * Under the transport's ~30s per-closure cap, not at it.
       * Two waits and a settle share this one budget, so at 15_000 apiece the closure declared 31.2s.
       * The eval is killed at the cap first and reported as a bare transport timeout.
       * That names the harness rather than the wait that overran.
       * A palette opening and filtering lands in well under a second, so the smaller ceiling costs nothing.
       */
      const PALETTE_TIMEOUT_IN_MILLISECONDS = 11_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1200;

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
 * The entry button needs a real tap rather than a synthesized `click()`: the
 * console's own button listens for `pointerdown`/`pointerup`, which an element's
 * `click()` never produces. A trusted tap does, which is why `clickElement` drives
 * it here exactly as it drives the same button on desktop.
 */
async function openConsole(): Promise<void> {
  await evalInObsidian({
    async callback({ app, lib: { clickElement, waitUntil }, pluginId }) {
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
 * Switches the in-page console to one of its tabs, and does not return until that tab is the SELECTED
 * one.
 *
 * The wait is the point of this helper. It used to return the tab INVENTORY, so the only thing a
 * caller could assert was that the inventory contains the name it just asked for — true whether or not
 * the tap ever landed. A tab that silently failed to switch therefore read as a pass, which is exactly
 * how these shots came to photograph the wrong panel.
 *
 * A missing tab now throws rather than quietly doing nothing, for the same reason.
 *
 * @param tabName - The tab to switch to, lower-cased.
 * @returns The name of the tab that is selected afterwards.
 */
async function openConsoleTab(tabName: string): Promise<string> {
  return await evalInObsidian({
    async callback({ lib: { clickElement, waitUntil }, tabName: wantedTab }) {
      const SELECT_TIMEOUT_IN_MILLISECONDS = 15_000;
      const SETTLE_DELAY_IN_MILLISECONDS = 1500;

      const tabs = [...(findConsoleRoot()?.querySelectorAll('.luna-tab-item') ?? new Array<Element>())];
      const wanted = tabs.find((tab) => tab.textContent.trim().toLowerCase() === wantedTab);
      if (!(wanted instanceof HTMLElement)) {
        throw new TypeError(`The console has no ${wantedTab} tab.`);
      }

      await clickElement({ element: wanted });

      await waitUntil({
        message: `the ${wantedTab} tab to be selected`,
        predicate: () => selectedTabName() === wantedTab,
        timeoutInMilliseconds: SELECT_TIMEOUT_IN_MILLISECONDS
      });

      await sleep(SETTLE_DELAY_IN_MILLISECONDS);

      return selectedTabName();

      function findConsoleRoot(): null | ShadowRoot {
        const host = [...document.body.children].find((child) => Boolean(child.shadowRoot));
        return host?.shadowRoot ?? null;
      }

      function selectedTabName(): string {
        // `luna-tab-selected`, NOT `luna-tab-item-selected`: the strip is a luna component and the
        // Modifier sits on the luna block rather than on the item. The wrong guess matches nothing and
        // Reads as "no tab is selected", which is indistinguishable from a tab that failed to switch.
        return findConsoleRoot()?.querySelector('.luna-tab-item.luna-tab-selected')?.textContent.trim().toLowerCase() ?? '';
      }
    },
    input: { tabName },
    vaultPath: vaultPath()
  });
}

/**
 * Captures the PAGE, captions it, and writes it as
 * `images/screenshots/screenshot-mobile-<index>.png`.
 *
 * The page capture is byte-reproducible — no status bar, no clock — so a re-capture of an unchanged frame
 * leaves no diff. Every shot but the palette one keeps it; see shot 2 for why a focused field is not on
 * its own a reason to switch.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 */
async function shoot(index: number, caption: string): Promise<void> {
  const captured = await captureObsidianScreenshot({ vaultPath: vaultPath() });

  await writeFrame(index, caption, captured);
}

/**
 * Raises the soft keyboard over a field the page itself exposes, captures the DEVICE, and writes the frame.
 *
 * For a shot whose subject is a focused field. `captureObsidianScreenshot` cannot show a keyboard: it
 * drives Appium in the WebView context, so it photographs the page, and the IME is a system window that
 * is not part of the page — which left such a frame as a field over a large empty band.
 *
 * Two things are needed and both belong to the harness rather than here: the AVD is built with a hardware
 * keyboard attached, so Android suppresses the on-screen one until `withSoftKeyboardEnabled` lifts that
 * and puts the setting back exactly; and a WebView will not ask for an IME on programmatic focus alone,
 * so `raiseSoftKeyboard` lands a real touch on the field and proves geometrically that it lifted.
 *
 * The trade, which applies only to the shots that switch: a device capture is **not** byte-reproducible,
 * because the status-bar clock and the battery indicator are in it.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 * @param inputSelector - The field to touch, as a selector `document.querySelector` can resolve.
 */
async function shootWithSoftKeyboard(index: number, caption: string, inputSelector: string): Promise<void> {
  const captured = await withSoftKeyboardEnabled({
    async callback() {
      await raiseSoftKeyboard({
        deviceId,
        inputSelector,
        vaultPath: vaultPath()
      });

      return await captureDeviceScreenshot({ deviceId });
    },
    deviceId
  });

  await writeFrame(index, caption, captured);
}

function vaultPath(): string {
  return getTemporaryVault().path;
}

/**
 * Asserts the frame is the store size, captions it, and writes it out.
 *
 * @param index - The 1-based listing position.
 * @param caption - The caption drawn across the bottom of the frame.
 * @param captured - The raw PNG, from either capture route.
 */
async function writeFrame(index: number, caption: string, captured: Uint8Array): Promise<void> {
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
