[Docs](https://github.com/mnaoumov/obsidian-advanced-debug-mode/)

# More debug tools

Two smaller features round out the plugin. Neither has its own setting - they are surfaced through a command and the settings tab.

## DevTools on mobile

Obsidian's desktop app has DevTools built in; the mobile app does not, which makes debugging a plugin on a phone or tablet painful. Advanced Debug Mode adds a floating **DevTools** button to the mobile app so you can inspect the console and elements without tethering the device to a desktop.

- Run **Advanced Debug Mode: Toggle DevTools button** from the command palette to show or hide the button.
- On desktop this is unnecessary (`Ctrl` + `Shift` + `I` already opens DevTools), so the button is aimed at mobile.

## Debug namespaces

Many plugins - and `obsidian-dev-utils` itself - use the [`debug`](https://github.com/debug-js/debug) library to emit `console.debug` messages that are hidden unless their namespace is enabled. Advanced Debug Mode adds a UI for managing those namespaces so you can switch specific channels of debug output on and off without editing `localStorage` by hand.

- Open **Settings -> Community plugins -> Advanced Debug Mode** and find the debug-namespaces section.
- Enable a namespace, reproduce the behavior, and watch the matching `console.debug` output appear in DevTools.

For the full explanation of debug namespaces, see the [obsidian-dev-utils debugging guide](https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/).

Head to [[06 Settings]] for the settings-backed features.
