# Memory troubleshooting

When Obsidian's window suddenly goes blank, white or grey, while DevTools says it was disconnected from the page, the renderer has usually run out of JavaScript heap. V8 has a fixed heap limit, and once a full garbage collection frees nothing below it, the renderer dies. Everything in memory dies with it, the console included, so there is nothing left to read afterwards.

`Advanced Debug Mode` keeps the evidence outside the renderer. Everything here is desktop only, because it needs Node.js, and everything is off until you turn it on.

## What it does

- **A status bar readout** of the used heap against its limit, such as `Heap 1.20 GB / 4.00 GB (30%)`. It turns yellow at the warning threshold and red at the critical one. Click it for the history.
- **A trail that survives a crash.** Every sample is appended to `memory-trail.jsonl`, one JSON object per line, together with the last command that ran and how long ago it started. The line is written synchronously, so the minutes before a crash are on disk when the window goes blank. Past its size limit the file is renamed to `memory-trail.jsonl.1` and started again.
- **A warning** at the warning threshold (70% by default): a notice, and a console message with the heap spaces by size, the heap growth per minute and the last command.
- **A heap snapshot at the critical threshold** (90% by default), when you turn that on: written once per session, and only when the disk has room for twice the used heap plus 512 MB.
- **Commands**: `Take heap snapshot now`, `Show memory history` and `Force garbage collection`. The last one is offered only when garbage collection is exposed (see below).

The trail and the snapshots go to the **Diagnostics folder** setting. Left empty, that is `obsidian-advanced-debug-mode/<vault name>` under the system temp folder, which keeps a snapshot of several gigabytes out of the vault and out of whatever syncs it.

## Try it

1. Turn the monitor on, sampling every 2 seconds:

   ```code-button
   ---
   caption: Turn the memory monitor on
   ---
   await require('/demoSetup.ts').changeSettings(app, { memorySampleIntervalInSeconds: 2, shouldMonitorMemory: true });
   ```

   Manual equivalent: open **Settings -> Community plugins -> `Advanced Debug Mode`**, and turn **Desktop: Monitor memory** on.

2. Watch the readout in the status bar, and click it to see the history.

3. Run **`Advanced Debug Mode: Take heap snapshot now`** from the command palette. Obsidian stops responding while the snapshot is written; a notice then names the file.

4. Turn the monitor off again:

   ```code-button
   ---
   caption: Turn the memory monitor off
   ---
   await require('/demoSetup.ts').changeSettings(app, { memorySampleIntervalInSeconds: 10, shouldMonitorMemory: false });
   ```

## Reading a heap snapshot

1. Open DevTools (`Ctrl`/`Cmd` + `Shift` + `I`), and go to the **Memory** tab.
2. Click **Load**, and pick the `.heapsnapshot` file.
3. In the **Summary** view, sort by **Retained Size**. The constructors at the top hold the memory. Expand one, and select an object to see its **Retainers**: the chain of references that keeps it alive, which usually ends in the plugin or the cache that leaks.
4. To see what grew, take two snapshots some minutes apart, load both, and pick **Comparison** in the second one.

A snapshot of a heap near its limit takes long to load, and DevTools needs memory of its own to do it. Load it in a fresh window, or in the DevTools of a Chromium browser, rather than in the Obsidian that is about to crash.

## Raising the limit for a diagnosis run

A crash at the limit leaves no time to look around. To get that time, start Obsidian with a bigger limit, so the heap can grow past the point where it used to crash while the monitor records it:

```text
Obsidian.exe --js-flags=--max-old-space-size=8192
```

The value is in megabytes. Electron passes Chromium's `--js-flags` switch on to V8 in the renderer, and the status bar readout shows the limit that is actually in effect, so you can check that the flag was taken. Add `--expose-gc` to the same switch, as in `--js-flags="--max-old-space-size=8192 --expose-gc"`, to enable the `Force garbage collection` command: if the heap stays high right after it, the memory is really held, not merely waiting to be collected.

The settings keys are listed in [06 Settings](<./06 Settings.md>).
