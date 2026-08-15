import type { App } from 'obsidian';

import { Notice } from 'obsidian';
import { configureCommunityPlugin } from 'obsidian-dev-utils/obsidian/community-plugins';

const PLUGIN_ID = 'advanced-debug-mode';

interface DemoSettingsPatch {
  shouldIncludeAsyncLongStackTraces?: boolean;
  shouldIncludeInternalStackFrames?: boolean;
  shouldIncludeLongStackTraces?: boolean;
  shouldIncludeTimedOutTasksDetails?: boolean;
  shouldTimeoutLongRunningTasks?: boolean;
  stackTraceLimit?: number;
}

/**
 * Turns Obsidian's own debug mode on or off.
 *
 * This is not a plugin setting — it is `app.debugMode()`, backed by the `DebugMode` local-storage key,
 * which is why the plugin wraps it in the first place. Obsidian reloads its plugins afterwards so the
 * source maps take effect.
 *
 * Manual equivalent: toggle **Debug mode** in **Settings -> Community plugins -> Advanced Debug Mode**.
 */
export function setDebugMode(app: App, isEnabled: boolean): void {
  new Notice(isEnabled ? 'Turning debug mode on — plugins reload.' : 'Turning debug mode off — plugins reload.');
  app.debugMode(isEnabled);
}

/**
 * Reports whether Obsidian's debug mode is currently on, without changing it.
 *
 * Worth having its own button: everything in this vault reads differently depending on the answer, and
 * the toggle reloads plugins, so checking by flipping it is a destructive way to ask.
 *
 * Manual equivalent: look at the **Debug mode** toggle in the plugin's settings.
 */
export function reportDebugMode(app: App): void {
  const isEnabled = app.loadLocalStorage('DebugMode') === '1';
  new Notice(isEnabled ? 'Debug mode is ON — stack frames point at real source files.' : 'Debug mode is OFF — stack frames point at bundled main.js.');
}

/**
 * Applies a settings patch, live, through the plugin's own settings component.
 *
 * Manual equivalent: change the same option in **Settings -> Community plugins -> Advanced Debug Mode**.
 */
export async function changeSettings(app: App, patch: DemoSettingsPatch): Promise<void> {
  await configureCommunityPlugin({ app, pluginId: PLUGIN_ID, settings: patch });
  new Notice('Applied.');
}

/**
 * Shows or hides the floating DevTools button.
 *
 * Manual equivalent: **Advanced Debug Mode: Toggle DevTools button** in the Command Palette.
 */
export function toggleDevToolsButton(app: App): void {
  app.commands.executeCommandById(`${PLUGIN_ID}:toggle-dev-tools-button`);
}
