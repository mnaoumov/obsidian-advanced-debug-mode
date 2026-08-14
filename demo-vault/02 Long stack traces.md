# Long stack traces

This is the headline feature. When an error is thrown after it has passed through an async boundary - `setTimeout`, `setInterval`, `queueMicrotask`, `requestAnimationFrame`, `addEventListener`, or a `Promise` chain - the JavaScript engine throws away every frame that scheduled the work. The console then shows only the last few frames, which rarely tell you where the problem actually started.

Advanced Debug Mode stitches those boundaries back together, so the stack trace spans the whole call chain.

![A long stack trace, with the frames that would otherwise be lost](<./_assets/images/long-stack-traces.png>)

## Try it

1. Make sure DevTools is open (`Ctrl`/`Cmd` + `Shift` + `I`) and switch to the **Console** tab.
2. Click the **Run** button below. It deliberately throws `Error from alpha11` after routing through nine different async hops.
3. Read the stack trace that appears in the console.

```code-button
---
caption: Throw an error through async boundaries
---
function alpha1() {
  setTimeout(alpha2, 100);
}

function alpha2() {
  const intervalId = setInterval(alpha3, 100);
  setTimeout(() => {
    clearInterval(intervalId);
  }, 150);
}

function alpha3() {
  queueMicrotask(alpha4);
}

function alpha4() {
  requestAnimationFrame(alpha5);
}

function alpha5() {
  process.nextTick(alpha6);
}

function alpha6() {
  setImmediate(alpha7);
}

function alpha7() {
  Promise.resolve().then(alpha8);
}

function alpha8() {
  Promise.reject(new Error('Error from Promise')).catch(alpha9);
}

function alpha9() {
  Promise.resolve().finally(alpha10);
}

function alpha10() {
  const div = createDiv();
  div.addEventListener('click', alpha11);
  div.click();
}

function alpha11() {
  throw new Error('Error from alpha11');
}

alpha1();
```

## What to look for

**Without** the plugin the console shows only the tail of the trace:

```text
Uncaught Error: Error from alpha11
    at HTMLDivElement.alpha11 (<anonymous>)
    at alpha10 (<anonymous>)
```

**With** the plugin enabled, each async hop is labelled and the full chain back to `alpha1` is preserved:

```text
Uncaught Error: Error from alpha11
    at HTMLDivElement.alpha11 (<anonymous>)
    at alpha10 (<anonymous>)
    at --- addEventListener --- (0)
    ...
    at --- setTimeout --- (0)
    at alpha1 (<anonymous>)
```

## Related settings

- `shouldIncludeLongStackTraces` turns this feature on or off (on by default).
- `stackTraceLimit` caps how many frames are kept (100 by default) so very deep chains stay readable.
- `shouldIncludeInternalStackFrames` adds Obsidian/Electron-internal frames when you need the whole picture.

See [06 Settings](<./06 Settings.md>) for all of them, and [03 Async long stack traces](<./03 Async long stack traces.md>) for the `async`/`await` variant.

> [!NOTE]
> `process.nextTick` and `setImmediate` are Node globals, so the button above works on desktop. The rest of the chain works on mobile too.
