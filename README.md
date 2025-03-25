# Advanced Debug Mode

This is a plugin for [Obsidian](https://obsidian.md/) that enhances Obsidian debug mode.

## Features

### Obsidian Debug mode

The plugin adds an easy way to switch Obsidian debug mode on/off. This helps with trimmed sourcemaps.

### Long stack traces

Error stack traces are usually very limited and stack frames for function like `setTimeout` or `addEventListener` are usually not included, so sometimes it's difficult to find the root cause of the error.

The plugin tries to preserve long stack traces as much as possible.

For example

![Long stack traces](images/long-stack-traces.png)

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

#### Async long stack traces

Async long stack traces are the traces for async functions.

```js
async function foo() {
  await bar();
}
```

> [!WARNING]
>
> The plugin adds async long stack traces only on desktop. Adding it to mobile is impossible due to the current JavaScript Engine limitations.
>
> Async long stack traces might contain some duplicates.

For example

![Async long stack traces](images/async-long-stack-traces.png)

```js
function foo1() {
  foo2();
}

function foo2() {
  setTimeout(foo3, 100);
}

function foo3() {
  // calling async from sync
  barAsync1();
}

async function barAsync1() {
  await sleep(100);
  await barAsync2();
}

async function barAsync2() {
  await sleep(100);
  await barAsync3();
}

async function barAsync3() {
  await sleep(100);
  // calling sync from async
  foo4();
}

function foo4() {
  foo5();
}

function foo5() {
  throw new Error('Error from foo5');
}

foo1();
```

Without the plugin you get the error in the console

```
Uncaught (in promise) Error: Error from foo5
    at foo5 (<anonymous>:35:9)
    at foo4 (<anonymous>:31:3)
    at barAsync3 (<anonymous>:27:3)
    at async barAsync2 (<anonymous>:21:3)
    at async barAsync1 (<anonymous>:16:3)
```

With the plugin you get

```
Uncaught (in promise) Error: Error from foo5
    at foo5 (<anonymous>:35:9)
    at foo4 (<anonymous>:31:3)
    at barAsync3 (<anonymous>:27:3)
    at async barAsync2 (<anonymous>:21:3)
    at async barAsync1 (<anonymous>:16:3)
    at --- async --- (0)
    at barAsync3 (<anonymous>:25:9)
    at barAsync2 (<anonymous>:21:9)
    at async barAsync1 (<anonymous>:16:3)
    at --- async --- (0)
    at barAsync2 (<anonymous>:20:9)
    at barAsync1 (<anonymous>:16:9)
    at --- async --- (0)
    at barAsync1 (<anonymous>:15:9)
    at foo3 (<anonymous>:11:3)
    at --- setTimeout --- (0)
    at foo2 (<anonymous>:6:3)
    at foo1 (<anonymous>:2:3)
    at <anonymous>:38:1
```

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
