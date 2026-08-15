# Advanced Debug Mode

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/mnaoumov)
[![GitHub release](https://img.shields.io/github/v/release/mnaoumov/obsidian-advanced-debug-mode)](https://github.com/mnaoumov/obsidian-advanced-debug-mode/releases)
[![GitHub downloads](https://img.shields.io/github/downloads/mnaoumov/obsidian-advanced-debug-mode/total)](https://github.com/mnaoumov/obsidian-advanced-debug-mode/releases)
[![Coverage: 100%](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/mnaoumov/obsidian-advanced-debug-mode)

An error thrown inside a callback or an `await` arrives in the console with most of its stack already
gone: you get the frame that threw and almost nothing about who called it. Debugging a plugin in
[Obsidian](https://obsidian.md/) then means guessing, or littering the code with logging until the path
becomes obvious.

This plugin restores those frames. It keeps long stack traces across callback and `async` boundaries,
turns off the timeouts that fire while you sit on a breakpoint, brings DevTools to the mobile app, and
gives the `debug` namespaces a UI instead of hand-edited `localStorage`.

<!-- markdownlint-disable MD033 -->

<a href="images/screenshots/screenshot-desktop-1.png"><img src="images/screenshots/screenshot-desktop-1.png" alt="Without it: the throw, and no idea who called" width="600"></a>

<details>
<summary>More screenshots</summary>

<a href="images/screenshots/screenshot-desktop-2.png"><img src="images/screenshots/screenshot-desktop-2.png" alt="With it: the whole chain, hop by hop" width="600"></a>
<a href="images/screenshots/screenshot-desktop-3.png"><img src="images/screenshots/screenshot-desktop-3.png" alt="Across await too, when you opt in" width="600"></a>
<a href="images/screenshots/screenshot-desktop-4.png"><img src="images/screenshots/screenshot-desktop-4.png" alt="Real dev tools, inside the app itself" width="600"></a>
<a href="images/screenshots/screenshot-desktop-5.png"><img src="images/screenshots/screenshot-desktop-5.png" alt="Turn it on from the command palette" width="600"></a>
<a href="images/screenshots/screenshot-mobile-1.png"><img src="images/screenshots/screenshot-mobile-1.png" alt="A console on a phone, and the error in it" width="270"></a>
<a href="images/screenshots/screenshot-mobile-2.png"><img src="images/screenshots/screenshot-mobile-2.png" alt="Ask the running app a question, right here" width="270"></a>
<a href="images/screenshots/screenshot-mobile-3.png"><img src="images/screenshots/screenshot-mobile-3.png" alt="Elements, network and resources — on a phone" width="270"></a>
<a href="images/screenshots/screenshot-mobile-4.png"><img src="images/screenshots/screenshot-mobile-4.png" alt="Turn it on from the command palette" width="270"></a>

</details>

<!-- markdownlint-enable MD033 -->

## Demo vault

**The documentation is a demo vault.** Every feature has a note that explains what it does and why you
would want it, with buttons that throw real errors so you can watch the traces yourself.

**[Start reading here](<./demo-vault/00 Start.md>)** — it is plain markdown, so it works on GitHub with
nothing installed.

A copy of the vault ships with every release. You can access it via any of the following:

1. Running the **Advanced Debug Mode: Open demo vault** command.
2. Downloading `advanced-debug-mode-demo-vault-<version>.zip` (`<version>` is the release version) from the [Releases](https://github.com/mnaoumov/obsidian-advanced-debug-mode/releases).
3. Browsing its source in [`demo-vault/`](./demo-vault/README.md) in this repository.

## What it does

- **Obsidian's own debug mode**, toggled from a command instead of the console.
  [01 Debug mode](<./demo-vault/01 Debug mode.md>)
- **Long stack traces** — the frames behind a callback boundary, kept rather than discarded.
  [02 Long stack traces](<./demo-vault/02 Long stack traces.md>)
- **Async long stack traces** — the same across `await`, opt-in because it is desktop-only and costs
  DevTools console autocompletion while enabled.
  [03 Async long stack traces](<./demo-vault/03 Async long stack traces.md>)
- **Timeouts that do not fire while you are on a breakpoint**, so a slow debugging session does not
  trip Obsidian's own long-running-task limits.
  [04 Long running tasks](<./demo-vault/04 Long running tasks.md>)
- **DevTools on mobile**, where the app has none, plus a UI for the `debug` library's namespaces.
  [05 More debug tools](<./demo-vault/05 More debug tools.md>)
- **Every setting**, by the key it is stored under.
  [06 Settings](<./demo-vault/06 Settings.md>)

## Installation

The plugin is available in [the official Community Plugins repository](https://obsidian.md/plugins?id=advanced-debug-mode).

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://obsidian.md/plugins) or not), follow these steps:

1. Ensure you have the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat) installed and enabled.
2. Click [Install via BRAT](https://intradeus.github.io/http-protocol-redirector?r=obsidian://brat?plugin=https://github.com/mnaoumov/obsidian-advanced-debug-mode).
3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Debugging

Every other plugin documents a console command here. This one does not need to: **turning debug
namespaces on and off is what it does**. Open `Settings -> Community plugins -> Advanced Debug Mode`,
find the debug-namespaces section, and switch on `advanced-debug-mode` — or any other plugin's
namespace — without touching the console or `localStorage`. See
[05 More debug tools](<./demo-vault/05 More debug tools.md>).

The console form still works, and is the one to use if this plugin is not loaded yet, which is exactly
when you would need it:

```js
window.DEBUG.enable('advanced-debug-mode');
```

For more details, refer to the [documentation](https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/).

## Changelog

All notable changes to this project will be documented in the [CHANGELOG](./CHANGELOG.md).

## Contributing

Contributions are welcome — see [CONTRIBUTING](./CONTRIBUTING.md) to get set up.

## Support

<!-- markdownlint-disable MD033 -->

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="60" width="217"></a>

<!-- markdownlint-enable MD033 -->

## My other Obsidian resources

[See my other Obsidian resources](https://github.com/mnaoumov/obsidian-resources).

## License

© [Michael Naumov](https://github.com/mnaoumov/)
