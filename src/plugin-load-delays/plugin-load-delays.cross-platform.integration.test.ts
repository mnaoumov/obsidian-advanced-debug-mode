import { evalInObsidian } from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface LoadDelayResult {
  readonly elapsedWithDelayInMilliseconds: number;
  readonly elapsedWithoutDelayInMilliseconds: number;
  readonly firstEnabledPluginId: string | undefined;
  readonly isProbeLoaded: boolean;
  readonly noticeTexts: string[];
}

const PROBE_DELAY_IN_MILLISECONDS = 600;

// What only the real app can show: that a patch on `app.plugins.loadPlugin` really sits on the path Obsidian takes to
// enable a plugin, so a real plugin's load takes the configured time longer, and that the plugin moves itself first in
// the load order Obsidian saves.
describe('Plugin load delays', () => {
  it('should delay the loading of a plugin enabled while the delays are on', async () => {
    const result = await evalInObsidian({
      async callback({ app }): Promise<LoadDelayResult> {
        const pluginId = 'advanced-debug-mode';
        const probeId = 'advanced-debug-mode-load-delay-probe';
        const probeDirectory = `${app.vault.configDir}/plugins/${probeId}`;
        const probeLoadedKey = '__advancedDebugModeLoadDelayProbeLoaded';
        const probeDelayInMilliseconds = 600;

        await app.vault.adapter.mkdir(probeDirectory);
        await app.vault.adapter.write(
          `${probeDirectory}/manifest.json`,
          JSON.stringify({
            author: 'test',
            description: 'Probe for the plugin load delays integration test.',
            id: probeId,
            minAppVersion: '0.0.0',
            name: 'Load delay probe',
            version: '1.0.0'
          })
        );
        await app.vault.adapter.write(
          `${probeDirectory}/main.js`,
          `const { Plugin } = require('obsidian');
module.exports = class extends Plugin { onload() { window['${probeLoadedKey}'] = true; } };`
        );
        await app.plugins.loadManifests();

        try {
          const elapsedWithoutDelayInMilliseconds = await measureProbeLoad();

          await app.plugins.getPlugin(pluginId)?.saveData({
            pluginLoadDelaysInMilliseconds: { [probeId]: probeDelayInMilliseconds },
            shouldDelayPluginLoading: true
          });
          await app.plugins.disablePlugin(pluginId);
          await app.plugins.enablePlugin(pluginId);

          const elapsedWithDelayInMilliseconds = await measureProbeLoad();
          const noticeTexts = Array.from(document.querySelectorAll('.notice'), (el) => el.textContent);

          return {
            elapsedWithDelayInMilliseconds,
            elapsedWithoutDelayInMilliseconds,
            firstEnabledPluginId: app.plugins.enabledPlugins.values().next().value,
            isProbeLoaded: Reflect.get(window, probeLoadedKey) === true,
            noticeTexts
          };
        } finally {
          await app.plugins.disablePlugin(probeId);
          await app.vault.adapter.rmdir(probeDirectory, true);
          await app.plugins.loadManifests();
          Reflect.deleteProperty(window, probeLoadedKey);
          await app.plugins.getPlugin(pluginId)?.saveData({});
          await app.plugins.disablePlugin(pluginId);
          await app.plugins.enablePlugin(pluginId);
        }

        async function measureProbeLoad(): Promise<number> {
          await app.plugins.disablePlugin(probeId);
          Reflect.deleteProperty(window, probeLoadedKey);
          const start = performance.now();
          await app.plugins.enablePlugin(probeId);
          const elapsed = performance.now() - start;
          // Leave Obsidian's notices of the previous step behind before the next one.
          await sleep(0);
          return elapsed;
        }
      }
    });

    expect(result.isProbeLoaded).toBe(true);
    expect(result.elapsedWithoutDelayInMilliseconds).toBeLessThan(PROBE_DELAY_IN_MILLISECONDS);
    expect(result.elapsedWithDelayInMilliseconds).toBeGreaterThanOrEqual(PROBE_DELAY_IN_MILLISECONDS);
    expect(result.firstEnabledPluginId).toBe('advanced-debug-mode');
    expect(result.noticeTexts.some((text) => text.includes(`Delayed the loading of Load delay probe (${String(PROBE_DELAY_IN_MILLISECONDS)} ms).`))).toBe(true);
  });
});
