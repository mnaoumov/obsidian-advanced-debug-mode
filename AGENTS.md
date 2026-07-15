# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Advanced Debug Mode is an Obsidian plugin that enhances the debugging experience: it toggles Obsidian's built-in debug mode (keeping inline source maps), preserves long (and async) stack traces, manages `debug`-library namespaces from the UI, surfaces DevTools (via `eruda`) on mobile, and lets you temporarily disable Obsidian's long-running-task timeouts. It is built on `obsidian-dev-utils`.

## Commands

| Task              | Command                    |
|-------------------|----------------------------|
| TypeScript check  | `npm run build:compile`    |
| Build             | `npm run build`            |
| Dev (watch)       | `npm run dev`              |
| Lint              | `npm run lint`             |
| Lint (fix)        | `npm run lint:fix`         |
| Format            | `npm run format`           |
| Format (check)    | `npm run format:check`     |
| Spellcheck        | `npm run spellcheck`       |
| Markdown lint     | `npm run lint:md`          |
| Markdown lint fix | `npm run lint:md:fix`      |
| Unit tests        | `npm test`                 |
| Coverage          | `npm run test:coverage`    |
| Integration tests | `npm run test:integration` |
| Commit (wizard)   | `npm run commit`           |

## Architecture

- **Root config files** are thin re-exports — actual logic lives in `scripts/` (`eslint.config.mts` → `scripts/eslint-config.ts`, etc.).
- **`src/`** — plugin source:
  - `main.ts` — Obsidian entry point (imports the stylesheet, default-exports `Plugin`)
  - `plugin.ts` — `Plugin extends PluginBase`; `onloadImpl` wires up all child components (settings, settings tab, DevTools, command handler, long-running tasks, error stack-trace limit, long stack traces)
  - `plugin-settings.ts` — `PluginSettings` data class with the plugin's setting defaults
  - `plugin-settings-component.ts` — `PluginSettingsComponentBase` subclass that loads/saves settings
  - `plugin-settings-tab.ts` — settings UI tab (`displayLegacy`) for debug mode, mobile emulation, debug namespaces, long/async stack traces, stack-trace limit, and task timeouts
  - `debug-mode.ts` — `DebugMode`: read/toggle Obsidian's debug mode via `app.debugMode`
  - `emulate-mobile-mode.ts` — `EmulateMobileMode`: read/toggle desktop mobile-emulation via `app.emulateMobile`
  - `dev-tools-component.ts` — `DevToolsComponent`: initializes `eruda` DevTools (mobile) and toggles its entry button
  - `error-stack-trace-limit-component.ts` — saves and restores `Error.stackTraceLimit` across load/unload
  - `long-running-tasks-component.ts` — coordinates the two `FileSystemAdapter` patches and reloads them on settings change
  - `multi-weak-map.ts` — `MultiWeakMap`: multi-key map mixing `Map`/`WeakMap` storage per key type
  - `types.ts` — shared generic-function types (`GenericFunctionWithOriginalFn`, etc.)
  - `command-handlers/toggle-dev-tools-button-command.ts` — `GlobalCommandHandler` to toggle the DevTools button
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
