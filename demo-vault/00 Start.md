# Start here

Welcome to the [Advanced Debug Mode](https://github.com/mnaoumov/obsidian-advanced-debug-mode/) demo vault. This is a plugin for developers: it enriches Obsidian's built-in **debug mode** and the **DevTools console** so that plugin bugs are easier to track down. Nothing here changes how your notes look - the payoff shows up in DevTools, so keep it open (`Ctrl`/`Cmd` + `Shift` + `I` on desktop) as you work through the notes.

**The headline feature** is _long stack traces_. Normally a JavaScript error dropped through `setTimeout`, `addEventListener`, or a `Promise` chain loses every frame that led up to it, so the console shows a stump of a stack. With this plugin enabled, those async boundaries are stitched back together and you get the full call chain. [02 Long stack traces](<./02 Long stack traces.md>) has a **Run** button that throws such an error so you can see the difference yourself.

> [!TIP] Interactive buttons
>
> Every note has buttons, powered by [`CodeScript Toolkit`](https://github.com/mnaoumov/obsidian-codescript-toolkit/), and each one says what it does by hand. They come in two kinds: some **throw an error on purpose** so you can read the resulting stack trace in DevTools, and the rest **flip the setting** a walkthrough needs - always with a counterpart that puts it back, because several of these settings are meant to be on only while you are debugging.

## Features

- [01 Debug mode](<./01 Debug mode.md>)
- [02 Long stack traces](<./02 Long stack traces.md>)
- [03 Async long stack traces](<./03 Async long stack traces.md>)
- [04 Long running tasks](<./04 Long running tasks.md>)
- [05 More debug tools](<./05 More debug tools.md>)
- [06 Settings](<./06 Settings.md>)
