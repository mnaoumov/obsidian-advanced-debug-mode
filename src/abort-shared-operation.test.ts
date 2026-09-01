import type { Mock } from 'vitest';

import { getSharedAbortController } from 'obsidian-dev-utils/abort-controller';
import { SilentError } from 'obsidian-dev-utils/error';
import { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import { strictProxy } from 'obsidian-dev-utils/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { abortSharedOperation } from './abort-shared-operation.ts';

interface MockPluginNoticeComponent {
  showNotice: Mock;
}

function createMockPluginNoticeComponent(): MockPluginNoticeComponent & PluginNoticeComponent {
  return strictProxy<MockPluginNoticeComponent & PluginNoticeComponent>({
    showNotice: vi.fn()
  });
}

describe('abortSharedOperation', () => {
  it('should abort the shared abort controller', () => {
    // Captured BEFORE the abort: `ResettableAbortController` replaces its inner controller, so reading the
    // Signal afterwards yields the fresh one and would never look aborted.
    const abortedSignal = getSharedAbortController().signal;
    expect(abortedSignal.aborted).toBe(false);

    abortSharedOperation(createMockPluginNoticeComponent());

    expect(abortedSignal.aborted).toBe(true);
  });

  it('should abort with a SilentError, so a deliberate cancel is not printed as a failure', () => {
    const abortedSignal = getSharedAbortController().signal;

    abortSharedOperation(createMockPluginNoticeComponent());

    expect(abortedSignal.reason).toBeInstanceOf(SilentError);
    expect((abortedSignal.reason as Error).message).toBe('Aborted by Advanced Debug Mode.');
  });

  it('should leave a fresh non-aborted signal behind, so the next operation is not born cancelled', () => {
    abortSharedOperation(createMockPluginNoticeComponent());

    expect(getSharedAbortController().signal.aborted).toBe(false);
  });

  it('should report that the abort was signalled', () => {
    const pluginNoticeComponent = createMockPluginNoticeComponent();

    abortSharedOperation(pluginNoticeComponent);

    expect(pluginNoticeComponent.showNotice).toHaveBeenCalledOnce();
    // The wording must claim only that the signal was sent: nothing can know whether anything listened.
    expect(pluginNoticeComponent.showNotice).toHaveBeenCalledWith(expect.stringContaining('Abort signalled.'));
  });
});
