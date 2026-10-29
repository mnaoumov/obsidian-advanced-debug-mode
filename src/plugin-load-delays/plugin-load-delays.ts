import type { ValidationMessageHolder } from '@mnaoumov/obsidian-lib/validation';

import type { PluginSettings } from '../settings/plugin-settings.ts';

import { PluginLoadDelayMode } from '../settings/plugin-settings.ts';

interface GetPluginLoadDelayInMillisecondsParams {
  readonly pluginId: string;
  readonly random: () => number;
  readonly settings: PluginSettings;
}

/**
 * Blocks the renderer for the given time, the way a CPU-heavy plugin on a loaded machine does.
 *
 * @param milliseconds - How long to block.
 * @param now - The clock to read.
 */
export function busyWait(milliseconds: number, now: () => number): void {
  const end = now() + milliseconds;
  while (now() < end) {
    // Spin: blocking the thread is the point.
  }
}

/**
 * Waits for the given time in the given mode.
 *
 * @param mode - Whether to yield or to block.
 * @param milliseconds - How long to wait.
 * @returns A {@link Promise} that resolves after the wait.
 */
export async function delay(mode: PluginLoadDelayMode, milliseconds: number): Promise<void> {
  if (mode === PluginLoadDelayMode.Sync) {
    busyWait(milliseconds, () => performance.now());
    return;
  }

  await sleep(milliseconds);
}

/**
 * Formats the per-plugin delays as the settings text area shows them: one `<plugin-id>: <milliseconds>` line each.
 *
 * @param delays - The delays keyed by plugin id.
 * @returns The text.
 */
export function formatPluginLoadDelays(delays: Readonly<Record<string, number>>): string {
  return Object.entries(delays).map(([pluginId, milliseconds]) => `${pluginId}: ${String(milliseconds)}`).join('\n');
}

/**
 * Gets the delay to apply to one plugin's load: its own delay, else the default, plus a random jitter.
 *
 * @param params - The params.
 * @returns The delay, 0 for none.
 */
export function getPluginLoadDelayInMilliseconds(params: GetPluginLoadDelayInMillisecondsParams): number {
  const { pluginId, random, settings } = params;
  const baseDelay = Object.hasOwn(settings.pluginLoadDelaysInMilliseconds, pluginId)
    ? settings.pluginLoadDelaysInMilliseconds[pluginId] ?? 0
    : settings.defaultPluginLoadDelayInMilliseconds;
  // A plugin given 0 on purpose is left alone, jitter or not.
  return baseDelay <= 0 ? 0 : baseDelay + Math.round(random() * settings.pluginLoadDelayJitterInMilliseconds);
}

/**
 * Checks that a delay is a whole number of milliseconds, 0 or more.
 *
 * @param value - The value to check.
 * @returns Whether the value is a valid delay.
 */
export function isValidDelay(value: unknown): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Parses the settings text area of per-plugin delays.
 *
 * @param text - One `<plugin-id>: <milliseconds>` line per plugin; blank lines are skipped.
 * @returns The delays keyed by plugin id, or the message naming the first bad line.
 */
export function parsePluginLoadDelays(text: string): Record<string, number> | ValidationMessageHolder {
  const delays: Record<string, number> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '') {
      continue;
    }

    const match = /^(?<pluginId>[^:\s]+)\s*:\s*(?<milliseconds>\d+)$/u.exec(line);
    const pluginId = match?.groups?.['pluginId'];
    const milliseconds = Number(match?.groups?.['milliseconds']);
    if (pluginId === undefined || !isValidDelay(milliseconds)) {
      return { validationMessage: `Expected "<plugin-id>: <milliseconds>", got "${line}"` };
    }

    delays[pluginId] = milliseconds;
  }

  return delays;
}
