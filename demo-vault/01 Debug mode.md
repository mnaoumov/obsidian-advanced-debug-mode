# Debug mode

Obsidian has a built-in **debug mode**. When it is off (the default), Obsidian strips the inline source maps from the plugins it loads, so any error you see in DevTools points at minified, bundled code that is almost impossible to read. Turning debug mode on keeps those source maps, so stack traces point back at the plugin's real source files.

Advanced Debug Mode gives you a one-click switch for it.

## How to turn it on

```code-button
---
caption: Turn debug mode on
---
require('/demoSetup.ts').setDebugMode(app, true);
```

Manual equivalent: run **Advanced Debug Mode: Open settings** (or open **Settings -> Community plugins -> Advanced Debug Mode**) and toggle **Debug mode** on.

Obsidian reloads the plugins so the source maps take effect.

Everything in this vault reads differently depending on whether debug mode is on, and the toggle
reloads plugins - so check rather than flip:

```code-button
---
caption: Is debug mode on?
---
require('/demoSetup.ts').reportDebugMode(app);
```

```code-button
---
caption: Turn debug mode off
---
require('/demoSetup.ts').setDebugMode(app, false);
```

## How to see the difference

1. Open DevTools (`Ctrl`/`Cmd` + `Shift` + `I`).
2. With debug mode **off**, trigger an error from any plugin (the **Run** button in [02 Long stack traces](<./02 Long stack traces.md>) is a good one) and note that the stack frames point at bundled `main.js` lines.
3. Turn debug mode **on**, trigger the same error, and note that the frames now point at the original `.ts` source files.

Once debug mode is on, move on to [02 Long stack traces](<./02 Long stack traces.md>) to see the plugin's headline feature.
