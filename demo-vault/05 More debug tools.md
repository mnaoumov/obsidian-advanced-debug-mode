# More debug tools

A few smaller features round out the plugin. None has its own setting - they are surfaced through a command and the settings tab.

## DevTools on mobile

Obsidian's desktop app has DevTools built in; the mobile app does not, which makes debugging a plugin on a phone or tablet painful. `Advanced Debug Mode` adds a floating **DevTools** button to the mobile app so you can inspect the console and elements without tethering the device to a desktop.

- Run **`Advanced Debug Mode`: Toggle DevTools button** from the command palette to show or hide the button.
- On desktop this is unnecessary (`Ctrl` + `Shift` + `I` already opens DevTools), so the button is aimed at mobile. On desktop the in-page DevTools does not even start until you first show its button, because its console wraps every `console.*` method (see [Console messages keep their real source](#console-messages-keep-their-real-source)).
- On mobile it starts with the plugin, so its console already holds what was logged before you open it.

```code-button
---
caption: Toggle the DevTools button
---
require('/demoSetup.ts').toggleDevToolsButton(app);
```

Manual equivalent: run **`Advanced Debug Mode`: Toggle DevTools button** from the command palette. Press it twice to put things back.

![The DevTools button floating over the mobile app](<./_assets/images/devtools.jpg>)

## Console messages keep their real source

DevTools links each console message to the place it came from: the `file:line` on the right of the message. Code that sits between a caller and the browser - a wrapper around `console.debug`, `addEventListener`, `setTimeout` or `Promise.then` - takes that place, and DevTools then names the wrapper instead of the code that logged. `Advanced Debug Mode` has such wrappers: the in-page DevTools console wraps every `console.*` method, and long stack traces wrap the timers, event listeners and promise callbacks. Left alone, DevTools would name `plugin:advanced-debug-mode` as the source of messages logged by any plugin.

It does not, for two reasons:

- On desktop the in-page DevTools only starts when you first show its button, and disabling the plugin puts the native `console` methods back.
- The plugin ships a small source map that marks its wrappers as third-party code. DevTools skips such frames when it picks a message's source, so the link goes to the real caller. This relies on **DevTools -> Settings -> Ignore list -> Known third-party scripts from source maps**, which is on by default. To see the skipped frames in a stack trace, use **Show ignore-listed frames** under the stack.

The plugin's own messages still link to `plugin:advanced-debug-mode`.

## Debug namespaces

Many plugins - and `@mnaoumov/obsidian-lib` itself - use the [`debug`](https://github.com/debug-js/debug) library to emit `console.debug` messages that are hidden unless their namespace is enabled. `Advanced Debug Mode` adds a UI for managing those namespaces so you can switch specific channels of debug output on and off without editing `localStorage` by hand.

Plugins built on `@mnaoumov/obsidian-lib` log under their own id: the plugin's messages under `<plugin-id>`, its submodules under `<plugin-id>:*`. Their READMEs tell you to type `window.DEBUG.enable('<plugin-id>');` into the console. You do not have to:

- Run **`Advanced Debug Mode`: Open plugin debug messages** from the command palette, or click the bug icon in the ribbon. A view opens in the right sidebar with every installed plugin and a checkbox each. It stays open, and every checkbox applies at once, so you can turn several plugins on or off in one sitting:
  - the filter box narrows the list by name or id;
  - **Only enabled plugins** and **Only checked** narrow it further (disabled plugins are listed, dimmed);
  - **All on** and **All off** apply to the plugins the list shows right now;
  - the **Library messages** row turns on the shared library's messages inside every plugin (`*:obsidian-lib:*`).

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

For the full explanation of debug namespaces, see the [`@mnaoumov/obsidian-lib` debugging guide](https://mnaoumov.dev/obsidian-lib/guides/debugging/).

## Abort the running operation

`@mnaoumov/obsidian-lib` gives every plugin built on it one shared abort signal. A plugin that hands that signal to a long-running job - a vault-wide rename, an attachment sweep, a link rewrite across thousands of notes - can be stopped mid-flight. Until now the only way to fire it was a line typed into the DevTools console, which is unavailable on mobile, impossible to bind to a hotkey, and awkward to reach at the one moment you want it: while the operation is running.

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
globalThis[Symbol.for('@mnaoumov/typescript-lib/state')].values.sharedAbortController.value.abort();
```

Head to [06 Settings](<./06 Settings.md>) for the settings-backed features.
