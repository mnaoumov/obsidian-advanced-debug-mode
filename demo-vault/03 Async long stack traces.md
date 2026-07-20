[Docs](https://github.com/mnaoumov/obsidian-advanced-debug-mode/)

# Async long stack traces

[[02 Long stack traces]] covers errors routed through callback-style async boundaries. Real code also uses `async`/`await`, and an error thrown inside an awaited function loses the callers that awaited it just the same:

```js
async function foo() {
  await bar();
}
```

Advanced Debug Mode can preserve those `async` frames too, but it is a separate, **opt-in** setting because of the trade-offs below.

## Turn it on

1. Open **Settings -> Community plugins -> Advanced Debug Mode**.
2. Toggle **Include async long stack traces** on. This flips the `shouldIncludeAsyncLongStackTraces` setting.

## Try it

With DevTools open on the **Console** tab, click the button. It awaits two async hops and then throws.

```code-button
---
caption: Throw an error through async/await
---
async function barAsync1() {
  await sleep(50);
  await barAsync2();
}

async function barAsync2() {
  await sleep(50);
  throw new Error('Error from barAsync2');
}

void barAsync1();
```

With the setting on, the trace keeps the `--- async ---` hops back through `barAsync1`; with it off you see only `barAsync2`.

> [!WARNING]
> This is the reason it is opt-in:
>
> - Async long stack traces are added **only on desktop** - the mobile JavaScript engine cannot support them.
> - The trace may contain some duplicate frames.
> - While the setting is on, autocompletion in the DevTools console stops working (an Electron bug).

Turn it off again when you are done to get console autocompletion back.
