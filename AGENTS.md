# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Advanced Debug Mode is an Obsidian plugin that enhances the debugging experience: it toggles Obsidian's built-in debug mode (keeping inline source maps), preserves long (and async) stack traces, manages `debug`-library namespaces from the UI, surfaces DevTools (via `eruda`) on mobile, and lets you temporarily disable Obsidian's long-running-task timeouts. It is built on `obsidian-dev-utils`.

## Commands

| Task                        | Command                                 |
|-----------------------------|-----------------------------------------|
| TypeScript check            | `npm run build:compile`                 |
| Build                       | `npm run build`                         |
| Dev (watch)                 | `npm run dev`                           |
| Lint                        | `npm run lint`                          |
| Lint (fix)                  | `npm run lint:fix`                      |
| Format                      | `npm run format`                        |
| Format (check)              | `npm run format:check`                  |
| Spellcheck                  | `npm run spellcheck`                    |
| Markdown lint               | `npm run lint:md`                       |
| Markdown lint fix           | `npm run lint:md:fix`                   |
| Unit tests                  | `npm test`                              |
| Coverage                    | `npm run test:coverage`                 |
| Integration tests           | `npm run test:integration`              |
| Store screenshots           | `npm run capture:screenshots`           |
| Store screenshots (desktop) | `npm run capture:screenshots:desktop`   |
| Store screenshots (Android) | `npm run capture:screenshots:android`   |
| Branch gate                 | `npm run gate`                          |
| Commit (wizard)             | `npm run commit`                        |

## Architecture

- **Root config files** are thin re-exports — actual logic lives in `scripts/` (`eslint.config.mts` → `scripts/eslint-config.ts`, etc.).
- **`src/`** — plugin source:
  - `main.ts` — Obsidian entry point (imports the stylesheet, default-exports `Plugin`)
  - `plugin.ts` — `Plugin extends PluginBase`; `onloadImpl` wires up all child components (settings, settings tab, DevTools, command handler, long-running tasks, error stack-trace limit, long stack traces)
  - `plugin-settings.ts` — `PluginSettings` data class with the plugin's setting defaults
  - `plugin-settings-component.ts` — `PluginSettingsComponentBase` subclass that loads/saves settings
  - `plugin-settings-tab.ts` — settings UI tab (declarative `getSettingDefinitionItems()`, per G101) for debug mode, mobile emulation, debug namespaces, long/async stack traces, stack-trace limit, task timeouts, and the shared-abort button
  - `abort-shared-operation.ts` — `abortSharedOperation`: fires `obsidian-dev-utils`' app-wide `ResettableAbortController` with a `SilentError` reason and reports that the abort was signalled
  - `debug-mode.ts` — `DebugMode`: read/toggle Obsidian's debug mode via `app.debugMode`
  - `emulate-mobile-mode.ts` — `EmulateMobileMode`: read/toggle desktop mobile-emulation via `app.emulateMobile`
  - `dev-tools-component.ts` — `DevToolsComponent`: initializes `eruda` DevTools (mobile) and toggles its entry button
  - `error-stack-trace-limit-component.ts` — saves and restores `Error.stackTraceLimit` across load/unload
  - `long-running-tasks-component.ts` — coordinates the two `FileSystemAdapter` patches and reloads them on settings change
  - `multi-weak-map.ts` — `MultiWeakMap`: multi-key map mixing `Map`/`WeakMap` storage per key type
  - `types.ts` — shared generic-function types (`GenericFunctionWithOriginalFn`, etc.)
  - `command-handlers/toggle-dev-tools-button-command.ts` — `GlobalCommandHandler` to toggle the DevTools button
  - `command-handlers/abort-shared-operation-command.ts` — `GlobalCommandHandler` firing the app-wide shared abort; the hotkey-bindable form of the console's `__obsidianDevUtils.sharedAbortController.value.abort()`
  - `long-stack-traces/long-stack-traces-component.ts` — cross-platform entry; lazy-loads the desktop component and reloads on settings change
  - `long-stack-traces/long-stack-traces-desktop-component.ts` — desktop core: patches `Error` (and child error classes), timers, microtasks, and `Promise` methods to inject long stack-trace frames
  - `long-stack-traces/async-long-stack-traces-desktop-component.ts` — `async_hooks`-based async stack-trace capture (desktop only)
  - `long-stack-traces/event-listener.ts` — `isEventListenerObject` type guard
  - `long-stack-traces/event-handlers-map.ts` — `MultiWeakMap` mapping `(target, type, handler)` to wrapped handlers
  - `patches/add-long-stack-traces-patch-component.ts` — `MonkeyAroundComponent` that wraps handler args so each invocation records a stack frame
  - `patches/event-target-remove-event-listener-patch-component.ts` — patches `removeEventListener` to remove the wrapped handler
  - `patches/file-system-adapter-queue-patch-component.ts` — patches `FileSystemAdapter.queue` to log timed-out task details
  - `patches/file-system-adapter-things-happening-patch-component.ts` — patches `thingsHappening` to disable the long-running-task timeout
  - `styles/` — `main.scss` (plugin styles) and `scss.d.ts` (SCSS module type declaration)
- **`main` field** points to `src/main.ts` (Obsidian plugin source entry; built artifact is `dist/build/main.js`, not published to npm).

## Testing notes

### The mobile screenshot capture suite

The four mobile frames are captured by **two different routes**, and which route a frame takes is a
decision about that frame rather than a style choice:

- **Frames 1, 2 and 3 capture the PAGE** (`captureObsidianScreenshot`), which is byte-reproducible apart
  from frame 1's stack-trace content: no status bar and no clock, so re-capturing an unchanged frame
  leaves no diff.
- **Frame 4 captures the DEVICE** (`captureDeviceScreenshot`) with the soft keyboard raised first,
  because the command palette is a focused field over nothing. A page capture cannot show a keyboard: it
  drives Appium in the WebView context, so it photographs the page, and the IME is a system window that
  is not part of the page. **The cost is that frame 4 is no longer byte-reproducible**, since the
  status-bar clock and the battery indicator are in it. Do not "fix" that churn by putting it back on the
  page capture.
- **Frame 2 ends on a focused field and still keeps the page capture. That is measured, not an
  oversight.** Raising the keyboard over the console was implemented and run: the keyboard came up and
  covered the console's output panel, the eval field and the Execute button — everything the caption
  promises — leaving a tab strip above an empty white panel. The console is an overlay Obsidian does not
  lift for the IME the way it lifts its own modals, so the answer has nowhere to go. A keyboard makes this
  frame strictly worse, so it does not get one.
  - Worth knowing if it is ever revisited: the console's field lives in the dev-tools **shadow root**, and
    `raiseSoftKeyboard` resolves its selector with `document.querySelector`, which does not reach inside
    one. The recipe is still reachable without a harness change — `resolveSoftKeyboardTapPoints`,
    `tapDevice` and `checkIsSoftKeyboardUp` are all published, so only the geometry read has to be local
    and shadow-piercing. It was built that way, and the frame it produced is what settled the question.
- **Raising the keyboard takes TWO things**, which is why both belong to `obsidian-integration-testing`
  rather than being copied in here. The AVD is built with a hardware keyboard attached, so Android
  suppresses the on-screen one entirely — `withSoftKeyboardEnabled` lifts that for the duration of a shot
  and restores the device exactly, including restoring a setting that had never been written, which takes
  a delete rather than a write. And a WebView will not ask for an IME on programmatic focus alone:
  a real touch has to land on the field, and then the lift has to be proved geometrically, because
  nothing in the page reports the keyboard — `innerHeight`, `visualViewport` and the modal container all
  keep their full height with it shown.
- **A passing lift check is not the same as a good frame**, which is what frame 2 cost to learn. The check
  asks whether the FIELD moved clear of the bottom; it cannot tell you the keyboard covered the thing the
  shot is evidence for. So a switched frame is looked at, every time, and not merely measured.
