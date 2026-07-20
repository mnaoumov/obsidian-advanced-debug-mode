[Docs](https://github.com/mnaoumov/obsidian-advanced-debug-mode/)

# Settings

Open **Settings -> Community plugins -> Advanced Debug Mode** to configure the plugin. Each option below lists the setting key stored in the plugin's `data.json`.

## Long stack traces

- `shouldIncludeLongStackTraces` - master switch for the [[02 Long stack traces]] feature (on by default). Turn it off to fall back to the engine's native short traces.
- `stackTraceLimit` - the maximum number of frames kept in a stitched trace (100 by default). Raise it for very deep async chains, lower it to keep the console tidy.
- `shouldIncludeInternalStackFrames` - include Obsidian/Electron-internal frames in the trace. Off keeps traces focused on your code; on shows the complete picture.
- `shouldIncludeAsyncLongStackTraces` - also stitch `async`/`await` boundaries, as described in [[03 Async long stack traces]]. Off by default because it is desktop-only and disables console autocompletion while active.

## Long running tasks

- `shouldTimeoutLongRunningTasks` - keep Obsidian's safety timeouts on for normal use, or turn it off before a debugging session so tasks are not aborted while you sit on a breakpoint. See [[04 Long running tasks]].
- `shouldIncludeTimedOutTasksDetails` - when a task does time out, print extra diagnostic details about it to the console.

Change any of these and reproduce the matching scenario to watch the behavior update.
