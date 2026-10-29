# Plugin load delays

A plugin that works on your fast machine can break on a slow one. Another plugin takes a second longer to load, the metadata cache finishes its first pass later, the layout becomes ready at a different moment, and code that quietly relied on the old order fails. `Advanced Debug Mode` can slow those steps down on purpose, so you can see how your plugin behaves when its neighbors are slow.

## How Obsidian loads plugins

Obsidian loads the enabled plugins one at a time, in the order of `.obsidian/community-plugins.json`, and waits for each plugin's `onload` to finish before it starts the next one. Only after the last plugin has loaded does it load the vault, start the metadata cache and load the layout.

So the delays can only cover the plugins that load after `Advanced Debug Mode`. While the delays are on, it keeps itself first in that file, and at startup a notice names any plugin that still loaded before it, with a button to reload.

## What you can delay

- **Each plugin's load**, by a default delay for every plugin, a delay of its own for a single plugin, and an optional random jitter on top.
  - **Before onload** waits before the plugin starts loading, as if the plugins before it were slow.
  - **After onload** waits after it has loaded, as if it were slow itself, so whatever it started already runs.
- **At startup, the metadata cache's first resolve**, after every plugin has loaded.
- **At startup, the layout load**, which is the moment `onLayoutReady` callbacks run.

Each delay waits in one of two ways:

- **Async** yields, like a slow plugin that awaits something. The load order stays the same, but timers and other work that earlier plugins started keep running while it waits.
- **Sync** blocks the app completely, like a plugin that does heavy work on a busy machine. Nothing else runs.

Every delay that ran is reported: one notice after startup with the total, and one per plugin enabled later. A plugin that loaded before `Advanced Debug Mode` is never reported as delayed.

## Try it

1. Turn the delays on, with every plugin enabled from now on loading one second later:

   ```code-button
   ---
   caption: Delay every plugin by 1 second
   ---
   await require('/demoSetup.ts').changeSettings(app, { defaultPluginLoadDelayInMilliseconds: 1000, shouldDelayPluginLoading: true });
   ```

   Manual equivalent: open **Settings -> Community plugins -> `Advanced Debug Mode`**, turn **Delay plugin loading** on and set **Default delay** to `1000`.

2. Enable any other plugin in **Settings -> Community plugins**, and watch the notice name the delay. Reload the app to delay the whole startup.

3. Turn the delays off again:

   ```code-button
   ---
   caption: Stop delaying plugins
   ---
   await require('/demoSetup.ts').changeSettings(app, { defaultPluginLoadDelayInMilliseconds: 0, shouldDelayPluginLoading: false });
   ```

   Manual equivalent: turn **Delay plugin loading** off in the plugin's settings.

The settings keys are listed in [06 Settings](<./06 Settings.md>).
