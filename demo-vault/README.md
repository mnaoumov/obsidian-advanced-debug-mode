# Advanced Debug Mode demo vault

A small Obsidian vault that demonstrates the [Advanced Debug Mode](https://github.com/mnaoumov/obsidian-advanced-debug-mode) plugin - a developer tool that enriches Obsidian's debug mode and the DevTools console so plugin bugs are easier to track down.

Open [00 Start](<./00 Start.md>) and keep DevTools open (`Ctrl`/`Cmd` + `Shift` + `I`). The star of the vault is [02 Long stack traces](<./02 Long stack traces.md>): its **Run** button throws an error through nine async boundaries so you can watch the plugin stitch the whole call chain back together in the console.

## First open

The first time you open this vault, Obsidian treats it as **untrusted**, so the bundled plugins are listed but not loaded until you **Trust author and enable plugins** and reload. After that, the Demo Vault Helper installs [CodeScript Toolkit](https://github.com/mnaoumov/obsidian-codescript-toolkit) (which powers the **Run** buttons in the notes) and opens the start note for you.
