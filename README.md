# Advanced Debug Mode

This is a plugin for [Obsidian](https://obsidian.md/) that enhances Obsidian debug mode.

## Features

### Obsidian Debug mode

The plugin adds an easy way to switch Obsidian debug mode on/off. This helps with trimmed sourcemaps.

### Long stack traces

Error stack traces are usually very limited and stack frames for function like `setTimeout` or `addEventListener` are usually not included, so sometimes it's difficult to find the root cause of the error.

The plugin tries to preserve long stack traces as much as possible.

For example,

```js
function foo() {
  bar();
}

function bar() {
  setTimeout(baz, 100);
}

function baz() {
  qux();
}

function qux() {
  throw new Error('Error from qux');
}

foo();
```

Without the plugin you get the error in the console

```
Uncaught Error: Error from qux
    at qux (<anonymous>:14:9)
    at baz (<anonymous>:10:3)
```

With the plugin you get

```
Uncaught Error: Error from qux
    at qux (<anonymous>:14:9)
    at baz (<anonymous>:10:3)
    at --- setTimeout --- (0)
    at bar (<anonymous>:6:3)
    at foo (<anonymous>:2:3)
    at <anonymous>:1:1
```

> [!WARNING]
>
> The plugin does not provide long stack traces for `async/await` functions. It seems to be impossible to do accurately due to the JavaScript engine limitations.

### DevTools for mobile app

The plugin adds DevTools for the mobile app. This helps to debug the plugins without connecting mobile to the desktop.

![DevTools](images/devtools.jpg)

### Debug namespaces management

Some plugins use [debug](https://github.com/debug-js/debug) library to conditionally show/hide `console.debug` messages.

The plugin adds an ability to manage those debug namespaces from the UI.

For more details, refer to the [documentation](https://github.com/mnaoumov/obsidian-dev-utils?tab=readme-ov-file#debugging).

## Installation

The plugin is not available in [the official Community Plugins repository](https://obsidian.md/plugins) yet.

### Beta versions

To install the latest beta release of this plugin (regardless if it is available in [the official Community Plugins repository](https://obsidian.md/plugins) or not), follow these steps:

1. Make sure to have the [BRAT plugin](https://obsidian.md/plugins?id=obsidian42-brat) installed and enabled.
2. Paste the following link in your browser and press `Enter`:

   ```
   obsidian://brat?plugin=https://github.com/mnaoumov/obsidian-advanced-debug-mode
   ```

3. An Obsidian pop-up window should appear. In the window, click the `Add plugin` button once and wait a few seconds for the plugin to install.

## Support

<a href="https://www.buymeacoffee.com/mnaoumov" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;"></a>

## License

© [Michael Naumov](https://github.com/mnaoumov/)
