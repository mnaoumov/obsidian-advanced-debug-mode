# Settings

Open **Settings -> Community plugins -> Advanced Debug Mode** to configure the plugin. Each option below lists the setting key stored in the plugin's `data.json`.

## Long stack traces

- `shouldIncludeLongStackTraces`
  - master switch for the [02 Long stack traces](<./02 Long stack traces.md>) feature (on by default). Turn it off to fall back to the engine's native short traces.
- `stackTraceLimit`
  - the maximum number of frames kept in a stitched trace (100 by default). Raise it for very deep async chains, lower it to keep the console tidy.
- `shouldIncludeInternalStackFrames`
  - include Obsidian/Electron-internal frames in the trace. Off keeps traces focused on your code; on shows the complete picture.
- `shouldIncludeAsyncLongStackTraces`
  - also stitch `async`/`await` boundaries, as described in [03 Async long stack traces](<./03 Async long stack traces.md>). Off by default because it is desktop-only and disables console autocompletion while active.

## Long running tasks

- `shouldTimeoutLongRunningTasks`
  - keep Obsidian's safety timeouts on for normal use, or turn it off before a debugging session so tasks are not aborted while you sit on a breakpoint. See [04 Long running tasks](<./04 Long running tasks.md>).
- `shouldIncludeTimedOutTasksDetails`
  - when a task does time out, print extra diagnostic details about it to the console.

Change any of these and reproduce the matching scenario to watch the behavior update.

## Try the trace settings against the Run button

The quickest loop is: press a button here, then re-run the thrower in [02 Long stack traces](<./02 Long stack traces.md>) and read the console.

```code-button
---
caption: Short native traces (long stack traces off)
---
await require('/demoSetup.ts').changeSettings(app, { shouldIncludeLongStackTraces: false });
```

```code-button
---
caption: Long stack traces on (the default)
---
await require('/demoSetup.ts').changeSettings(app, { shouldIncludeLongStackTraces: true });
```

```code-button
---
caption: Show Obsidian and Electron internal frames too
---
await require('/demoSetup.ts').changeSettings(app, { shouldIncludeInternalStackFrames: true });
```

```code-button
---
caption: Cap traces at 20 frames
---
await require('/demoSetup.ts').changeSettings(app, { stackTraceLimit: 20 });
```

```code-button
---
caption: Restore every default on this page
---
await require('/demoSetup.ts').changeSettings(app, { shouldIncludeAsyncLongStackTraces: false, shouldIncludeInternalStackFrames: false, shouldIncludeLongStackTraces: true, shouldIncludeTimedOutTasksDetails: true, shouldTimeoutLongRunningTasks: true, stackTraceLimit: 100 });
```

Manual equivalent for all of them: change the matching control in **Settings -> Community plugins -> Advanced Debug Mode**.
