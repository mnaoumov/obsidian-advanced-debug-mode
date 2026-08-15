# Long running tasks

Obsidian guards some internal operations with timeouts: if a task takes too long, Obsidian assumes it has hung and aborts it. That is sensible in normal use, but it fights you while debugging - the moment you pause on a breakpoint and inspect state for a few seconds, the timeout fires and the task you were tracing is torn down before you can finish.

Advanced Debug Mode lets you relax those timeouts while you debug.

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
