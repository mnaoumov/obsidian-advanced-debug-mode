import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { App } from 'obsidian';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { openPluginDebugMessagesView } from '../plugin-debug-messages-view.ts';

vi.mock('../plugin-debug-messages-view.ts', () => ({
  openPluginDebugMessagesView: vi.fn().mockResolvedValue(undefined)
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { OpenPluginDebugMessagesViewCommandHandler } from './open-plugin-debug-messages-view-command.ts';

describe('OpenPluginDebugMessagesViewCommandHandler', () => {
  it('should register under its id and name, and open the view', async () => {
    const app = strictProxy<App>({});
    const handler = new OpenPluginDebugMessagesViewCommandHandler(app);
    const command = handler.buildCommand();

    expect(command.id).toBe('open-plugin-debug-messages-view');
    expect(command.name).toBe('Open plugin debug messages');

    const isChecking = false;
    command.checkCallback?.(isChecking);
    await waitForAllAsyncOperations();

    expect(openPluginDebugMessagesView).toHaveBeenCalledWith(app);
  });
});
