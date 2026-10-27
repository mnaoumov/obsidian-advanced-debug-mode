import type { Mock } from 'vitest';

import { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import { getSharedAbortController } from '@mnaoumov/typescript-lib/abort-controller';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { AbortSharedOperationCommandHandler } from './abort-shared-operation-command.ts';

interface MockPluginNoticeComponent {
  readonly showNotice: Mock;
}

function createMockPluginNoticeComponent(): MockPluginNoticeComponent & PluginNoticeComponent {
  return strictProxy<MockPluginNoticeComponent & PluginNoticeComponent>({
    showNotice: vi.fn()
  });
}

describe('AbortSharedOperationCommandHandler', () => {
  it('should have correct command metadata', () => {
    const handler = new AbortSharedOperationCommandHandler(createMockPluginNoticeComponent());
    const command = handler.buildCommand();

    expect(command.id).toBe('abort-shared-operation');
    expect(command.name).toBe('Abort the running operation');
    expect(command.icon).toBe('ban');
  });

  it('should abort the shared abort controller when the command executes', () => {
    const pluginNoticeComponent = createMockPluginNoticeComponent();
    const handler = new AbortSharedOperationCommandHandler(pluginNoticeComponent);

    // Captured BEFORE the click: the controller replaces its inner signal on abort.
    const abortedSignal = getSharedAbortController().signal;

    const command = handler.buildCommand();
    const isChecking = false;
    command.checkCallback?.(isChecking);

    expect(abortedSignal.aborted).toBe(true);
    expect(pluginNoticeComponent.showNotice).toHaveBeenCalledOnce();
  });

  it('should return true when checking if command can execute', () => {
    const handler = new AbortSharedOperationCommandHandler(createMockPluginNoticeComponent());

    const command = handler.buildCommand();
    const isChecking = true;
    const result = command.checkCallback?.(isChecking);

    expect(result).toBe(true);
  });
});
