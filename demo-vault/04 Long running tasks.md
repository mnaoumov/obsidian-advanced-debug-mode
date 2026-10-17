# Long running tasks

Obsidian guards some internal operations with timeouts: if a task takes too long, Obsidian assumes it has hung and aborts it. That is sensible in normal use, but it fights you while debugging - the moment you pause on a breakpoint and inspect state for a few seconds, the timeout fires and the task you were tracing is torn down before you can finish.

`Advanced Debug Mode` lets you relax those timeouts while you debug.

## The settings involved

- `shouldTimeoutLongRunningTasks`
  - leave this **on** for normal use, and turn it **off** before a debugging session so tasks are allowed to run (or pause) indefinitely.
- `shouldIncludeTimedOutTasksDetails`
  - when a task does time out, include extra details about it in the console so you can see which task was aborted and why.

Both live in **Settings -> Community plugins -> Advanced Debug Mode** and are documented in [06 Settings](<./06 Settings.md>).

## Typical workflow

1. Turn the timeouts off:

   ```code-button
   ---
   caption: Let long running tasks run (start debugging)
   ---
   await require('/demoSetup.ts').changeSettings(app, { shouldTimeoutLongRunningTasks: false });
   ```

   Manual equivalent: open **Settings -> Community plugins -> Advanced Debug Mode** and turn **Timeout long running tasks** off.

2. Set your breakpoints in DevTools and reproduce the slow operation - it will now wait on your breakpoints instead of being aborted.
3. When you are done, turn the setting back on so Obsidian's normal safety timeouts are restored:

   ```code-button
   ---
   caption: Restore the timeouts (stop debugging)
   ---
   await require('/demoSetup.ts').changeSettings(app, { shouldTimeoutLongRunningTasks: true });
   ```

   Manual equivalent: turn **Timeout long running tasks** back on.

This is the one pair worth binding to muscle memory - the warning below is about forgetting step 3.

Leaving timeouts disabled outside a debugging session is not recommended - a genuinely stuck task would then hang instead of recovering.

## Timeouts inside other plugins: debug switches

Obsidian's own timeouts are not the only ones. Plugins built on the `@mnaoumov/typescript-lib` library run some of their operations through its `runWithTimeout`, which terminates an operation that takes too long - the same trap while you sit on a breakpoint.

That library keeps an app-wide registry of **debug switches**: named on/off values that change how code behaves while you debug. Any library or plugin can register one, and the **Debug switches** section at the bottom of the settings tab lists every registered switch, with its name, description and id, as a toggle. A switch registered after `Advanced Debug Mode` loaded appears the next time you open the tab.

The timeout one is **Terminate operations on timeout** (`typescript-lib:terminate-on-timeout`):

- **On** (the default): a timed out operation is terminated.
- **Off**: the timeout is only logged, and the operation keeps running, so you can step through it.

Turn it off before debugging a plugin built on that library:

```code-button
---
caption: Keep timed out operations running (start debugging)
---
await require('/demoSetup.ts').changeSettings(app, { debugSwitches: { 'typescript-lib:terminate-on-timeout': false } });
```

Manual equivalent: open **Settings -> Community plugins -> Advanced Debug Mode** and turn **Terminate operations on timeout** off under **Debug switches**.

And back on when you are done:

```code-button
---
caption: Terminate timed out operations again (stop debugging)
---
await require('/demoSetup.ts').changeSettings(app, { debugSwitches: {} });
```

Manual equivalent: turn **Terminate operations on timeout** back on.

Three things to know:

- The values are saved in `data.json` under `debugSwitches`, so a switch you turned off stays off across reloads. Each time the plugin loads with a switch away from its default, a notice names it, so you cannot forget one.
- Disabling `Advanced Debug Mode` puts every switch back to its default. Enabling it again re-applies the saved values.
- A switch only reaches plugins built against a version of the library that has it. **Terminate operations on timeout** reaches plugins built against `@mnaoumov/typescript-lib` 1.2.0 or later; a plugin that bundles an older copy keeps terminating its operations.
