[Docs](https://github.com/mnaoumov/obsidian-advanced-debug-mode/)

# Long stack traces

This is the headline feature. When an error is thrown after it has passed through an async boundary - `setTimeout`, `setInterval`, `queueMicrotask`, `requestAnimationFrame`, `addEventListener`, or a `Promise` chain - the JavaScript engine throws away every frame that scheduled the work. The console then shows only the last few frames, which rarely tell you where the problem actually started.

Advanced Debug Mode stitches those boundaries back together, so the stack trace spans the whole call chain.

## Try it

1. Make sure DevTools is open (`Ctrl`/`Cmd` + `Shift` + `I`) and switch to the **Console** tab.
2. Click the **Run** button below. It deliberately throws `Error from foo11` after routing through nine different async hops.
3. Read the stack trace that appears in the console.

```code-button
---
caption: Throw an error through async boundaries
---
function foo1() {
  setTimeout(foo2, 100);
}

function foo2() {
  const intervalId = setInterval(foo3, 100);
  setTimeout(() => {
    clearInterval(intervalId);
  }, 150);
}

function foo3() {
  queueMicrotask(foo4);
}

function foo4() {
  requestAnimationFrame(foo5);
}

function foo5() {
  process.nextTick(foo6);
}

function foo6() {
  setImmediate(foo7);
}

function foo7() {
  Promise.resolve().then(foo8);
}

function foo8() {
  Promise.reject(new Error('Error from Promise')).catch(foo9);
}

function foo9() {
  Promise.resolve().finally(foo10);
}

function foo10() {
  const div = createDiv();
  div.addEventListener('click', foo11);
  div.click();
}

function foo11() {
  throw new Error('Error from foo11');
}

foo1();
```

## What to look for

**Without** the plugin the console shows only the tail of the trace:

```text
Uncaught Error: Error from foo11
    at HTMLDivElement.foo11 (<anonymous>)
    at foo10 (<anonymous>)
```

**With** the plugin enabled, each async hop is labelled and the full chain back to `foo1` is preserved:

```text
Uncaught Error: Error from foo11
    at HTMLDivElement.foo11 (<anonymous>)
    at foo10 (<anonymous>)
    at --- addEventListener --- (0)
    ...
    at --- setTimeout --- (0)
    at foo1 (<anonymous>)
```

## Related settings

- `shouldIncludeLongStackTraces` turns this feature on or off (on by default).
- `stackTraceLimit` caps how many frames are kept (100 by default) so very deep chains stay readable.
- `shouldIncludeInternalStackFrames` adds Obsidian/Electron-internal frames when you need the whole picture.

See [[06 Settings]] for all of them, and [[03 Async long stack traces]] for the `async`/`await` variant.

> [!NOTE]
> `process.nextTick` and `setImmediate` are Node globals, so the button above works on desktop. The rest of the chain works on mobile too.
