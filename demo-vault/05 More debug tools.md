# More debug tools

Three smaller features round out the plugin. None has its own setting - they are surfaced through a command and the settings tab.

## DevTools on mobile

Obsidian's desktop app has DevTools built in; the mobile app does not, which makes debugging a plugin on a phone or tablet painful. `Advanced Debug Mode` adds a floating **DevTools** button to the mobile app so you can inspect the console and elements without tethering the device to a desktop.

- Run **`Advanced Debug Mode`: Toggle DevTools button** from the command palette to show or hide the button.
- On desktop this is unnecessary (`Ctrl` + `Shift` + `I` already opens DevTools), so the button is aimed at mobile.

```code-button
---
caption: Toggle the DevTools button
---
require('/demoSetup.ts').toggleDevToolsButton(app);
```

Manual equivalent: run **`Advanced Debug Mode`: Toggle DevTools button** from the command palette. Press it twice to put things back.

![The DevTools button floating over the mobile app](<./_assets/images/devtools.jpg>)

## Debug namespaces

Many plugins - and `obsidian-dev-utils` itself - use the [`debug`](https://github.com/debug-js/debug) library to emit `console.debug` messages that are hidden unless their namespace is enabled. `Advanced Debug Mode` adds a UI for managing those namespaces so you can switch specific channels of debug output on and off without editing `localStorage` by hand.

Plugins built on `@mnaoumov/obsidian-lib` or `obsidian-dev-utils` log under their own id: the plugin's messages under `<plugin-id>`, its submodules under `<plugin-id>:*`. Their READMEs tell you to type `window.DEBUG.enable('<plugin-id>');` into the console. You do not have to:

- Run **`Advanced Debug Mode`: Open plugin debug messages** from the command palette, or click the bug icon in the ribbon. A view opens in the right sidebar with every installed plugin and a checkbox each. It stays open, and every checkbox applies at once, so you can turn several plugins on or off in one sitting:
  - the filter box narrows the list by name or id;
  - **Only enabled plugins** and **Only checked** narrow it further (disabled plugins are listed, dimmed);
  - **All on** and **All off** apply to the plugins the list shows right now;
  - the **Library messages** row turns on the shared library's messages inside every plugin (`*:obsidian-lib:*`, and the legacy `*:obsidian-dev-utils:*`).

  The view follows changes made anywhere else - the console, the settings tab, a plugin installed or enabled - while it is open.
- Run **`Advanced Debug Mode`: Toggle debug messages for a plugin...** to flip a single plugin from a picker that lists every installed plugin, marked `On` or `Off`.
- Or open **Settings -> Community plugins -> `Advanced Debug Mode`** and use the **Plugin debug messages** group, which has a toggle per installed plugin and an **Open as a view** button.

```code-button
---
caption: Open the plugin debug messages view
---
require('/demoSetup.ts').openPluginDebugMessagesView(app);
```

Manual equivalent: run **`Advanced Debug Mode`: Open plugin debug messages** from the command palette.

Whichever you use, turning a plugin on adds `<plugin-id>` and `<plugin-id>:*` to the namespaces, and turning it off removes them. When a wildcard such as `*` would still show its messages, turning it off adds `-<plugin-id>` and `-<plugin-id>:*` instead, so off really is off. Some plugins read the namespaces only once, at load, and need the app reloaded to pick a change up.

For anything finer, the **Debug namespaces** box in the same settings tab takes one namespace per line, and a leading `-` disables one. Enable a namespace, reproduce the behavior, and watch the matching `console.debug` output appear in DevTools.

For the full explanation of debug namespaces, see the [obsidian-dev-utils debugging guide](https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/).

## Abort the running operation

`obsidian-dev-utils` gives every plugin built on it one shared abort signal. A plugin that hands that signal to a long-running job - a vault-wide rename, an attachment sweep, a link rewrite across thousands of notes - can be stopped mid-flight. Until now the only way to fire it was a line typed into the DevTools console, which is unavailable on mobile, impossible to bind to a hotkey, and awkward to reach at the one moment you want it: while the operation is running.

`Advanced Debug Mode` surfaces it as a command and a settings button.

- Run **`Advanced Debug Mode`: Abort the running operation** from the command palette, or press **Abort** in **Settings -> Community plugins -> `Advanced Debug Mode`**.
- Bind the command to a hotkey and you have a panic button for any plugin's runaway job.

**The abort is app-wide, and that is the point.** It cancels whichever plugin started the operation, not just this one. Nothing reports back whether anything was listening, either - the shared signal keeps no registry of its observers, so the notice can only tell you the abort was signalled.

Pressing it with nothing running is harmless. The signal is aborted and immediately replaced with a fresh one, so the next operation does not start out already cancelled - which is exactly what a plain `AbortController` gets wrong, and why the library wraps it.

```code-button
---
caption: Abort the running operation
---
require('/demoSetup.ts').abortSharedOperation(app);
```

Manual equivalent: run **`Advanced Debug Mode`: Abort the running operation** from the command palette.

The console form still works, and is the one to reach for when this plugin is not loaded:

```javascript
__obsidianDevUtils.sharedAbortController.value.abort();
```

Head to [06 Settings](<./06 Settings.md>) for the settings-backed features.
