import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type { PluginManifest } from 'obsidian';
import type { Mock } from 'vitest';

import { selectItem } from '@mnaoumov/obsidian-lib/modals/select-item';
import { waitForAllAsyncOperations } from '@mnaoumov/typescript-test-toolkit/async-operation-tracking';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { App } from 'obsidian';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginDebugMessages } from './plugin-debug-messages.ts';

vi.mock('@mnaoumov/obsidian-lib/modals/select-item', () => ({
  selectItem: vi.fn()
}));

// eslint-disable-next-line import-x/first, import-x/imports-first -- vi.mock must precede imports.
import { TogglePluginDebugMessagesCommandHandler } from './toggle-plugin-debug-messages-command.ts';

interface MockPluginNoticeComponent {
  readonly showNotice: Mock;
}

interface SetUpResult {
  readonly enabledPluginIds: Set<string>;
  readonly handler: TogglePluginDebugMessagesCommandHandler;
  readonly pluginNoticeComponent: MockPluginNoticeComponent & PluginNoticeComponent;
}

const MANIFESTS: PluginManifest[] = [
  { author: 'test', description: '', id: 'plugin-a', minAppVersion: '0.0.0', name: 'Alpha', version: '1.0.0' },
  { author: 'test', description: '', id: 'plugin-b', minAppVersion: '0.0.0', name: 'Beta', version: '1.0.0' }
];

async function runCommand(handler: TogglePluginDebugMessagesCommandHandler): Promise<void> {
  const isChecking = false;
  handler.buildCommand().checkCallback?.(isChecking);
  // The command runs fire-and-forget; drain the tracked operation.
  await waitForAllAsyncOperations();
}

function setUp(initiallyEnabledPluginIds: string[] = []): SetUpResult {
  const enabledPluginIds = new Set(initiallyEnabledPluginIds);
  const pluginDebugMessages = strictProxy<PluginDebugMessages>({
    getPluginManifests: () => MANIFESTS,
    isEnabled: (pluginId: string) => enabledPluginIds.has(pluginId),
    setEnabled: (pluginId: string, isEnabled: boolean) => {
      if (isEnabled) {
        enabledPluginIds.add(pluginId);
      } else {
        enabledPluginIds.delete(pluginId);
      }
    }
  });
  const pluginNoticeComponent = strictProxy<MockPluginNoticeComponent & PluginNoticeComponent>({
    showNotice: vi.fn()
  });
  const handler = new TogglePluginDebugMessagesCommandHandler({
    app: new App(),
    pluginDebugMessages,
    pluginNoticeComponent
  });
  return { enabledPluginIds, handler, pluginNoticeComponent };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TogglePluginDebugMessagesCommandHandler', () => {
  it('should have correct command metadata', () => {
    const { handler } = setUp();
    const command = handler.buildCommand();

    expect(command.id).toBe('toggle-plugin-debug-messages');
    expect(command.name).toBe('Toggle debug messages for a plugin...');
    expect(command.icon).toBe('bug');
  });

  it('should offer every installed plugin marked on or off, and toggle the chosen one', async () => {
    let itemTexts: string[] = [];
    vi.mocked(selectItem).mockImplementation((params) => {
      // Read while the picker is open: the labels are computed then, before the toggle.
      itemTexts = params.items.map((item) => params.itemTextFunction(item));
      return Promise.resolve(MANIFESTS[1]);
    });
    const { enabledPluginIds, handler, pluginNoticeComponent } = setUp(['plugin-a']);

    await runCommand(handler);

    expect(vi.mocked(selectItem).mock.calls[0]?.[0].items).toEqual(MANIFESTS);
    expect(itemTexts).toEqual(['On: Alpha (plugin-a)', 'Off: Beta (plugin-b)']);
    expect([...enabledPluginIds]).toEqual(['plugin-a', 'plugin-b']);
    const notice = pluginNoticeComponent.showNotice.mock.calls[0]?.[0] as DocumentFragment | undefined;
    expect(notice?.textContent).toBe('Debug messages for Beta are on. Some plugins pick the change up only after the app reloads.');
    // The plugin name renders as inline code: a bare <code> gets no code chip in the app UI.
    const noticeEl = createDiv();
    noticeEl.append(notice ?? '');
    expect(noticeEl.querySelector(':scope .markdown-rendered.code > code')?.textContent).toBe('Beta');
  });

  it('should turn an enabled plugin off', async () => {
    vi.mocked(selectItem).mockResolvedValue(MANIFESTS[0]);
    const { enabledPluginIds, handler, pluginNoticeComponent } = setUp(['plugin-a']);

    await runCommand(handler);

    expect(enabledPluginIds.size).toBe(0);
    const notice = pluginNoticeComponent.showNotice.mock.calls[0]?.[0] as DocumentFragment | undefined;
    expect(notice?.textContent).toBe('Debug messages for Alpha are off. Some plugins pick the change up only after the app reloads.');
  });

  it('should change nothing when the picker is dismissed', async () => {
    vi.mocked(selectItem).mockResolvedValue(null);
    const { enabledPluginIds, handler, pluginNoticeComponent } = setUp(['plugin-a']);

    await runCommand(handler);

    expect([...enabledPluginIds]).toEqual(['plugin-a']);
    expect(pluginNoticeComponent.showNotice).not.toHaveBeenCalled();
  });
});
