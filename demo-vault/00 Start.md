Welcome to the [Advanced Debug Mode](https://github.com/mnaoumov/obsidian-advanced-debug-mode/) demo vault. This is a plugin for developers: it enriches Obsidian's built-in **debug mode** and the **DevTools console** so that plugin bugs are easier to track down. Nothing here changes how your notes look - the payoff shows up in DevTools, so keep it open (`Ctrl`/`Cmd` + `Shift` + `I` on desktop) as you work through the notes.

**The headline feature** is _long stack traces_. Normally a JavaScript error dropped through `setTimeout`, `addEventListener`, or a `Promise` chain loses every frame that led up to it, so the console shows a stump of a stack. With this plugin enabled, those async boundaries are stitched back together and you get the full call chain. [[02 Long stack traces]] has a **Run** button that throws such an error so you can see the difference yourself.

> [!TIP] Interactive buttons
>
> Some notes have **Run** buttons, powered by [`CodeScript Toolkit`](https://github.com/mnaoumov/obsidian-codescript-toolkit/), which this vault installs for you automatically on first open (see [[CodeScript Toolkit prerequisite]]). Every button here is honest about what it does - most just throw an error on purpose so you can read the resulting stack trace in DevTools.

## Features

- [[01 Debug mode]]
- [[02 Long stack traces]]
- [[03 Async long stack traces]]
- [[04 Long running tasks]]
- [[05 More debug tools]]
- [[06 Settings]]

## Setup

- [[Code buttons check]]
- [[CodeScript Toolkit prerequisite]]
