import type { App } from 'obsidian';

import { appendCodeBlock } from '@mnaoumov/obsidian-lib/html-element';
import { Modal } from 'obsidian';

import type { DesktopMemoryMonitorComponent } from './desktop-memory-monitor-component.ts';

import {
  formatBytes,
  getHeapGrowthPerMinute,
  getHeapUsageInPercent
} from './memory-monitor.ts';

interface MemoryHistoryModalConstructorParams {
  readonly app: App;
  readonly desktopComponent: DesktopMemoryMonitorComponent;
}

// The newest samples are the ones that matter before a crash, and a longer table stops being readable.
const SHOWN_SAMPLE_COUNT = 60;

export class MemoryHistoryModal extends Modal {
  private readonly desktopComponent: DesktopMemoryMonitorComponent;

  public constructor(params: MemoryHistoryModalConstructorParams) {
    super(params.app);
    this.desktopComponent = params.desktopComponent;
  }

  public override onOpen(): void {
    this.setTitle('Memory history');
    this.modalEl.addClass('advanced-debug-mode-memory-history');
    const { contentEl } = this;
    contentEl.empty();

    const samples = this.desktopComponent.getHistory();
    const trailParagraph = contentEl.createEl('p');
    trailParagraph.appendText('The trail that survives a crash: ');
    appendCodeBlock(trailParagraph, this.desktopComponent.getTrailFilePath());

    if (samples.length === 0) {
      contentEl.createEl('p', { text: 'No samples yet. Turn on the memory monitor in the settings.' });
      return;
    }

    const growthPerMinute = getHeapGrowthPerMinute(samples);
    if (growthPerMinute !== null) {
      contentEl.createEl('p', { text: `Heap growth over the history: ${formatBytes(Math.abs(growthPerMinute))}/min ${growthPerMinute < 0 ? 'down' : 'up'}.` });
    }

    const table = contentEl.createEl('table');
    const headerRow = table.createEl('thead').createEl('tr');
    for (const header of ['Time', 'Used heap', 'Of limit', 'Total heap', 'RSS', 'Activity']) {
      headerRow.createEl('th', { text: header });
    }

    const body = table.createEl('tbody');
    for (const sample of samples.slice(-SHOWN_SAMPLE_COUNT).reverse()) {
      const row = body.createEl('tr');
      row.createEl('td', { text: new Date(sample.timestamp).toLocaleTimeString() });
      row.createEl('td', { text: formatBytes(sample.usedHeapBytes) });
      row.createEl('td', { text: `${getHeapUsageInPercent(sample).toFixed(0)}%` });
      row.createEl('td', { text: formatBytes(sample.totalHeapBytes) });
      row.createEl('td', { text: formatBytes(sample.residentSetSizeBytes) });
      row.createEl('td', { text: sample.activity });
    }
  }
}
