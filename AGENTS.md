# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`Advanced Debug Mode` is an Obsidian plugin that enhances the debugging experience: it toggles Obsidian's built-in debug mode (keeping inline source maps), preserves long (and async) stack traces, manages `debug`-library namespaces from the UI, surfaces DevTools (via `eruda`) on mobile, and lets you temporarily disable Obsidian's long-running-task timeouts. It is built on `@mnaoumov/obsidian-lib` and `@mnaoumov/typescript-lib`.

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
  - `plugin-settings-tab.ts` — settings UI tab (declarative `getSettingDefinitionItems()`) for debug mode, mobile emulation, debug namespaces, long/async stack traces, stack-trace limit, task timeouts, the shared-abort button, and a "Debug switches" group with one toggle per switch in `@mnaoumov/typescript-lib`'s registry (`getDebugSwitches()`)
  - `debug-switches-component.ts` — `DebugSwitchesComponent`: persists the debug switches in `debugSwitches` (only values away from their default), applies them on load, names them in a notice, and puts them back to their defaults on unload
  - `abort-shared-operation.ts` — `abortSharedOperation`: fires `@mnaoumov/typescript-lib`'s app-wide `ResettableAbortController` with a `SilentError` reason and reports that the abort was signalled
  - `debug-mode.ts` — `DebugMode`: read/toggle Obsidian's debug mode via `app.debugMode`
  - `emulate-mobile-mode.ts` — `EmulateMobileMode`: read/toggle desktop mobile-emulation via `app.emulateMobile`
  - `dev-tools-component.ts` — `DevToolsComponent`: initializes `eruda` DevTools (mobile) and toggles its entry button
  - `error-stack-trace-limit-component.ts` — saves and restores `Error.stackTraceLimit` across load/unload
  - `long-running-tasks-component.ts` — coordinates the two `FileSystemAdapter` patches and reloads them on settings change
  - `multi-weak-map.ts` — `MultiWeakMap`: multi-key map mixing `Map`/`WeakMap` storage per key type
  - `types.ts` — shared generic-function types (`GenericFunctionWithOriginalFn`, etc.)
  - `command-handlers/toggle-dev-tools-button-command.ts` — `GlobalCommandHandler` to toggle the DevTools button
  - `command-handlers/abort-shared-operation-command.ts` — `GlobalCommandHandler` firing the app-wide shared abort; the hotkey-bindable form of the console's `__obsidianDevUtils.sharedAbortController.value.abort()`
  - `long-stack-traces/long-stack-traces-component.ts` — cross-platform entry; behind `Platform.isDesktop`, lazy-loads the desktop component, `require()`s `node:process` and `node:v8`, injects `process` and `v8.promiseHooks`, and reloads on settings change
  - `long-stack-traces/desktop-long-stack-traces-component.ts` — desktop core: patches `Error` (and child error classes), timers, microtasks, and `Promise` methods to inject long stack-trace frames
  - `long-stack-traces/desktop-async-long-stack-traces-component.ts` — `v8.promiseHooks`-based async stack-trace capture (desktop only); see below for why not `async_hooks`
  - `long-stack-traces/event-listener.ts` — `isEventListenerObject` type guard
  - `long-stack-traces/event-handlers-map.ts` — `MultiWeakMap` mapping `(target, type, handler)` to wrapped handlers
  - `patches/add-long-stack-traces-patch-component.ts` — `MonkeyAroundComponent` that wraps handler args so each invocation records a stack frame
  - `patches/event-target-remove-event-listener-patch-component.ts` — patches `removeEventListener` to remove the wrapped handler
  - `patches/file-system-adapter-queue-patch-component.ts` — patches `FileSystemAdapter.queue` to log timed-out task details
  - `patches/file-system-adapter-things-happening-patch-component.ts` — patches `thingsHappening` to disable the long-running-task timeout
  - `styles/` — `main.scss` (plugin styles) and `scss.d.ts` (SCSS module type declaration)
- **`main` field** points to `src/main.ts` (Obsidian plugin source entry; built artifact is `dist/build/main.js`, not published to npm).

### Node.js built-ins are loaded only in the facade, behind `Platform.isDesktop`

No module in `src/` statically imports a `node:` built-in. `long-stack-traces-component.ts` loads `node:process` and `node:v8` with `require()` inside its `if (Platform.isDesktop)` block, next to the dynamic import of the desktop component. It then passes them down as the `nodeProcess` and `promiseHooks` constructor params. The two `desktop-` components only receive them.

**It is `require()`, not `import()`, because a dynamic `import()` of a `node:` module does not load in the real app.** esbuild leaves a dynamic `import()` of an external module as a native `import()`. The renderer then fails with `Failed to fetch dynamically imported module: node:async_hooks` (the module the facade loaded before it moved to `node:v8`), and the plugin does not load. The unit tests pass either way, because vitest resolves `node:` URLs. Only the desktop integration suite catches it. A `require()` stays `require("node:…")` in `main.js`, which is how the static imports were bundled before.

**The community directory's review does NOT honour the `desktop-` filename exemption.** `@mnaoumov/obsidian-dev-toolkit`'s shared ESLint config turns `import-x/no-nodejs-modules` and `obsidianmd/no-nodejs-modules` off for `src/**/desktop-*.ts`. The directory's runner has no such carve-out. Until 1.11.1 these two files kept their static `node:` imports under that exemption. The listing reported each one as a medium Security finding, and each cost 5 points. `obsidianmd/no-nodejs-modules` accepts a `require()` or a dynamic `import()` only when it sits lexically inside a `Platform.isDesktop` guard: an `if`, a ternary, a `&&`, or an early `return`/`throw` at the start of the function. It must be exactly `Platform.isDesktop`; `isDesktopApp` does not count. So:

- A new Node.js dependency is `require()`d in the facade's guarded block and injected, never imported where it is used.
- The facade's `import-x/no-nodejs-modules` and `@typescript-eslint/no-require-imports` disables are deliberate. `import-x` cannot see the guard, but the `obsidianmd` rule can, and the `obsidianmd` rule is the one the directory runs. The `obsidianmd` half cannot be waived at all, because the runner sets `eslint-comments/no-restricted-disable` over `obsidianmd/*`.
- The type comes from a type query (`typeof import('node:v8')`, `NodeJS.Process`), never from an `import type` declaration. The rule reports a type-only `ImportDeclaration` too.
- Tests may import `node:` modules statically to build the injected values. The directory did not flag the test files' static `node:` imports, so they are evidently outside its scan.

### The patched `Error` forwards `prepareStackTrace` to the original class

With long stack traces on, `window.Error` is a `Proxy` over the patched `Error` function. The proxy sends every read, write, `defineProperty` and `delete` of `prepareStackTrace` to the original `Error`. Every other property stays on the patched class.

- **V8 consults `prepareStackTrace` on the realm's original `Error` only.** Before 1.11.3, a caller's `Error.prepareStackTrace = fn` landed on the patched class, and V8 never called it. `new Error().stack` and `Error.captureStackTrace()` returned the default string instead of what the formatter returned. `depd`'s `callSiteLocation` asks for the `CallSite` array, so `Local REST API` failed to load with `callSite.getFileName is not a function` (#4).
- **It is a proxy, not an accessor on the patched class.** A caller's `delete Error.prepareStackTrace` would remove an accessor and leave the formatter installed on the original `Error` for good. Reads cannot fall through the prototype chain either, because `assignWithNonEnumerableProperties` replaces the patched class's prototype with a merged copy.
- **The `stack` getter returns a non-string result unchanged.** Long stack traces only add frames to a formatted string, so a formatter that returns anything else gets its own result back.
- **Node and the Electron renderer differ here, so the unit tests cannot catch the `captureStackTrace` half.** Node's `prepareStackTrace` callback reads `globalThis.Error.prepareStackTrace`, so the old bug only showed in unit tests for `new Error().stack`. The desktop integration test runs the reporter's probe in the real renderer, and it failed on both APIs before the fix.

### Async long stack traces use `v8.promiseHooks`, and the hooks skip console evaluations

Until 1.11.3 the async capture used `async_hooks.createHook`, and while it was on, DevTools Console autocomplete came back empty.

- **The cause is V8's side-effect check, not a patched global.** DevTools asks for completions with `Runtime.evaluate` and `replMode: true` plus `throwOnSideEffect: true`. REPL mode wraps the expression in an async function, so the evaluation creates a promise, and every installed promise hook runs. V8 aborts the whole evaluation with `EvalError: Possible side-effect in debug-evaluate` on the hook's first write to any object that existed before the evaluation, and the completion list is empty. The abort cannot be caught inside the hook.
- **`async_hooks` cannot avoid that.** Node's own promise hook always writes its bookkeeping, whatever our callback does. So the component registers its own `init` / `before` / `after` through `v8.promiseHooks.createHook`. It keeps a `WeakMap` from promise to stack frame and a stack of executing promises. The parent of a promise with no V8 parent is the executing one, which is what Node's `triggerAsyncId` did.
- **The hooks return before writing while `$_` is in `globalThis`.** V8 installs the console's command-line API on the global for the duration of each console evaluation, the side-effect-free ones included, and removes it afterwards. The cost is that the promises created by the synchronous part of a typed-in console command get no async frame.
- **The unit tests cannot exercise the real hooks.** The unit suite runs in the `vmThreads` pool, and `v8.promiseHooks` see only the main context's promises, so the unit tests drive captured callbacks by hand. The desktop integration test sends DevTools' exact completion request over CDP to the real renderer, with the setting on. Without the guard it fails with the `EvalError`.

### The "Debug switches" group rebuilds itself when the registry grows

- **Obsidian renders the definitions it stored at `addSettingTab`.** `openTab` calls `renderTab()`, which renders the cached `settingItems`. `getSettingDefinitions()` runs again only on `update()`. So a switch a plugin registers after this plugin loaded would never get a row.
- **typescript-lib has no registration event**, only `onDebugSwitchChanged`. So each switch row's `render` compares the registry's ids with the ids the definitions were built from, and on a mismatch schedules one `refresh()` (= `update()`) right after the render. The desktop integration test registers a switch through the shared state slot, as another plugin's copy of the library does, and failed before this.
- **The component skips its own saves by context.** `DebugSwitchesComponent` saves with its own `editAndSave` context and ignores `saveSettings` events carrying it. A save from anywhere else, such as the demo vault's `configureCommunityPlugin`, applies only the entries it changed. Re-applying on its own saves would race its async listener and could flip a switch back.

## Testing notes

### The mobile screenshot capture suite

The four mobile frames are captured by **two different routes**, and which route a frame takes is a decision about that frame rather than a style choice:

- **Frames 1, 2 and 3 capture the PAGE** (`captureObsidianScreenshot`), which is byte-reproducible apart from frame 1's stack-trace content: no status bar and no clock, so re-capturing an unchanged frame leaves no diff.
- **Frame 4 captures the DEVICE** (`captureDeviceScreenshot`) with the soft keyboard raised first, because the command palette is a focused field over nothing. A page capture cannot show a keyboard: it drives Appium in the WebView context, so it photographs the page, and the IME is a system window that is not part of the page. **The cost is that frame 4 is no longer byte-reproducible**, since the status-bar clock and the battery indicator are in it. Do not "fix" that churn by putting it back on the page capture.
- **Frame 2 ends on a focused field and still keeps the page capture. That is measured, not an oversight.** Raising the keyboard over the console was implemented and run: the keyboard came up and covered the console's output panel, the eval field and the Execute button — everything the caption promises — leaving a tab strip above an empty white panel. The console is an overlay Obsidian does not lift for the IME the way it lifts its own modals, so the answer has nowhere to go. A keyboard makes this frame strictly worse, so it does not get one.
  - Worth knowing if it is ever revisited: the console's field lives in the dev-tools **shadow root**, and `raiseSoftKeyboard` resolves its selector with `document.querySelector`, which does not reach inside one. The recipe is still reachable without a harness change — `resolveSoftKeyboardTapPoints`, `tapDevice` and `checkIsSoftKeyboardUp` are all published, so only the geometry read has to be local and shadow-piercing. It was built that way, and the frame it produced is what settled the question.
- **Raising the keyboard takes TWO things**, which is why both belong to `obsidian-integration-testing` rather than being copied in here. The AVD is built with a hardware keyboard attached, so Android suppresses the on-screen one entirely — `withSoftKeyboardEnabled` lifts that for the duration of a shot and restores the device exactly, including restoring a setting that had never been written, which takes a delete rather than a write. And a WebView will not ask for an IME on programmatic focus alone: a real touch has to land on the field, and then the lift has to be proved geometrically, because nothing in the page reports the keyboard — `innerHeight`, `visualViewport` and the modal container all keep their full height with it shown.
- **A passing lift check is not the same as a good frame**, which is what frame 2 cost to learn. The check asks whether the FIELD moved clear of the bottom; it cannot tell you the keyboard covered the thing the shot is evidence for. So a switched frame is looked at, every time, and not merely measured.
