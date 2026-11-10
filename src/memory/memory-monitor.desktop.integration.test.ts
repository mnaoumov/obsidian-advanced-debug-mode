import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  evalInObsidian,
  pollInObsidian
} from 'obsidian-integration-testing';
import {
  describe,
  expect,
  it
} from 'vitest';

interface TrailRecord {
  readonly event?: string;
  readonly heapLimitBytes: number;
}

const SAMPLES_TIMEOUT_IN_MILLISECONDS = 20_000;
const SNAPSHOT_TIMEOUT_IN_MILLISECONDS = 100_000;
const TEST_TIMEOUT_IN_MILLISECONDS = 180_000;
const MINIMUM_SAMPLE_COUNT = 3;

// What only the real renderer can show: that `v8.getHeapStatistics()` and `v8.writeHeapSnapshot()` reached through the
// facade's guarded `require()` work in Obsidian, that the status bar shows the heap, and that the trail and the snapshot
// land in the diagnostics folder. The harness's Obsidian runs on this machine, so the folder is read from Node.
describe('Memory monitor', () => {
  it('should show the heap, write the trail and take a heap snapshot on command', { timeout: TEST_TIMEOUT_IN_MILLISECONDS }, async () => {
    const folder = mkdtempSync(join(tmpdir(), 'adm-memory-it-'));
    const trailPath = join(folder, 'memory-trail.jsonl');

    function readTrail(): TrailRecord[] {
      return existsSync(trailPath) ? readFileSync(trailPath, 'utf-8').trim().split('\n').map((line) => JSON.parse(line) as TrailRecord) : [];
    }

    try {
      await evalInObsidian({
        async callback({ app, folder: diagnosticsFolder }): Promise<void> {
          await app.plugins.getPlugin('advanced-debug-mode')?.saveData({
            memoryDiagnosticsFolder: diagnosticsFolder,
            memorySampleIntervalInSeconds: 1,
            shouldMonitorMemory: true
          });
          await app.plugins.disablePlugin('advanced-debug-mode');
          await app.plugins.enablePlugin('advanced-debug-mode');
        },
        input: { folder }
      });

      const statusBarText = await pollInObsidian({
        poll: () => document.querySelector('.advanced-debug-mode-memory-status')?.textContent ?? '',
        timeoutInMilliseconds: SAMPLES_TIMEOUT_IN_MILLISECONDS,
        until: (text) => text !== '' && readTrail().length >= MINIMUM_SAMPLE_COUNT
      });

      await pollInObsidian({
        poll: () => true,
        start: ({ app }) => {
          app.commands.executeCommandById('advanced-debug-mode:take-heap-snapshot');
        },
        timeoutInMilliseconds: SNAPSHOT_TIMEOUT_IN_MILLISECONDS,
        // The trail names the snapshot only after `writeHeapSnapshot` has returned, so the file is complete by then.
        until: () => readTrail().some((record) => record.event?.startsWith('snapshot ') === true)
      });

      const trailRecords = readTrail();
      const snapshotName = readdirSync(folder).find((name) => name.endsWith('.heapsnapshot')) ?? '';

      expect(statusBarText).toMatch(/^Heap \d+ MB \/ \d+\.\d{2} GB \(\d+%\)$/);
      expect(trailRecords[0]?.event).toBe('start');
      expect(trailRecords.some((record) => record.event === undefined)).toBe(true);
      expect(trailRecords.every((record) => record.heapLimitBytes > 0)).toBe(true);
      expect(snapshotName).toMatch(/^heap-.*-manual\.heapsnapshot$/);
      expect(readFileSync(join(folder, snapshotName), 'utf-8').slice(0, 20)).toMatch(/^\{"snapshot":/);
    } finally {
      await evalInObsidian({
        async callback({ app }): Promise<void> {
          await app.plugins.getPlugin('advanced-debug-mode')?.saveData({});
          await app.plugins.disablePlugin('advanced-debug-mode');
          await app.plugins.enablePlugin('advanced-debug-mode');
        }
      });
      rmSync(folder, { force: true, recursive: true });
    }
  });
});
