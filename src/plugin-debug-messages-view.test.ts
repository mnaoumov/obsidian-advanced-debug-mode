import type { DebugController } from '@mnaoumov/typescript-lib/debug-controller';
import type {
  App as AppOriginal,
  PluginManifest
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  App,
  WorkspaceLeaf
} from 'obsidian-test-mocks/obsidian';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  openPluginDebugMessagesView,
  PLUGIN_DEBUG_MESSAGES_VIEW_TYPE,
  PluginDebugMessagesView
} from './plugin-debug-messages-view.ts';
import { PluginDebugMessages } from './plugin-debug-messages.ts';

interface CreateViewResult {
  readonly debugController: DebugController;
  readonly enabledPlugins: Set<string>;
  readonly manifests: Record<string, PluginManifest>;
  readonly view: PluginDebugMessagesView;
}

function clickButton(view: PluginDebugMessagesView, text: string): void {
  const button = [...view.contentEl.querySelectorAll('button')].find((buttonEl) => buttonEl.textContent === text);
  button?.click();
}

function createManifest(id: string, name: string): PluginManifest {
  return { author: 'test', description: '', id, minAppVersion: '0.0.0', name, version: '1.0.0' };
}

async function createView(initialNamespaces: string[] = []): Promise<CreateViewResult> {
  let namespaces = initialNamespaces;
  const debugController = strictProxy<DebugController>({
    get: vi.fn(() => [...namespaces]),
    set: vi.fn((value: string | string[]) => {
      namespaces = Array.isArray(value) ? [...value] : value.split(',');
    })
  });
  const manifests: Record<string, PluginManifest> = {
    'plugin-a': createManifest('plugin-a', 'Alpha'),
    'plugin-b': createManifest('plugin-b', 'Beta'),
    'plugin-c': createManifest('plugin-c', 'Gamma')
  };
  const enabledPlugins = new Set(['plugin-a', 'plugin-b']);
  const pluginDebugMessages = new PluginDebugMessages({
    app: strictProxy<AppOriginal>({ plugins: castTo<AppOriginal['plugins']>({ enabledPlugins, manifests }) }),
    debugController
  });

  const app = App.createConfigured__();
  const leaf = WorkspaceLeaf.create2__(app);
  const view = new PluginDebugMessagesView({ leaf: leaf.asOriginalType3__(), pluginDebugMessages });
  await view.onOpen();
  return { debugController, enabledPlugins, manifests, view };
}

function getCheckbox(view: PluginDebugMessagesView, text: string): HTMLInputElement {
  const row = getRows(view).find((rowEl) => rowEl.textContent.includes(text));
  const checkbox = row?.querySelector('input');
  if (!checkbox) {
    throw new Error(`No row for ${text}`);
  }

  return checkbox;
}

function getRows(view: PluginDebugMessagesView): HTMLElement[] {
  return [...view.contentEl.querySelectorAll<HTMLElement>('.advanced-debug-mode-plugin-debug-messages-row')];
}

function getRowTexts(view: PluginDebugMessagesView): string[] {
  return getRows(view).slice(1).map((rowEl) => rowEl.querySelector('code')?.textContent ?? '');
}

function getToolbarCheckbox(view: PluginDebugMessagesView, label: string): HTMLInputElement {
  const labelEl = [...view.contentEl.querySelectorAll(':scope .advanced-debug-mode-plugin-debug-messages-filters label')].find((el) => el.textContent === label);
  return castTo<HTMLInputElement>(labelEl?.querySelector('input'));
}

function setChecked(checkbox: HTMLInputElement, isChecked: boolean): void {
  checkbox.checked = isChecked;
  checkbox.dispatchEvent(new Event('change'));
}

function typeFilter(view: PluginDebugMessagesView, text: string): void {
  const input = castTo<HTMLInputElement>(view.contentEl.querySelector('input[type="search"]'));
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('PluginDebugMessagesView', () => {
  it('should identify itself', async () => {
    const { view } = await createView();

    expect(view.getViewType()).toBe(PLUGIN_DEBUG_MESSAGES_VIEW_TYPE);
    expect(view.getDisplayText()).toBe('Plugin debug messages');
    expect(view.getIcon()).toBe('bug');
  });

  it('should list the library row, then every installed plugin sorted by name with its state', async () => {
    const { view } = await createView(['plugin-b']);

    expect(getRows(view)[0]?.textContent).toContain('Library messages');
    expect(getRowTexts(view)).toEqual(['Alpha', 'Beta', 'Gamma']);
    expect(getCheckbox(view, 'Alpha').checked).toBe(false);
    expect(getCheckbox(view, 'Beta').checked).toBe(true);
    // A disabled plugin is still listed, marked as such.
    const gammaRow = getRows(view).find((rowEl) => rowEl.textContent.includes('Gamma'));
    expect(gammaRow?.hasClass('advanced-debug-mode-plugin-debug-messages-disabled-plugin')).toBe(true);
    expect(gammaRow?.textContent).toContain('disabled');
  });

  it('should write the namespaces at once when a box is ticked or cleared', async () => {
    const { debugController, view } = await createView(['other']);

    setChecked(getCheckbox(view, 'Alpha'), true);
    expect(debugController.get()).toEqual(['other', 'plugin-a', 'plugin-a:*']);
    setChecked(getCheckbox(view, 'Gamma'), true);
    expect(debugController.get()).toEqual(['other', 'plugin-a', 'plugin-a:*', 'plugin-c', 'plugin-c:*']);
    setChecked(getCheckbox(view, 'Alpha'), false);
    expect(debugController.get()).toEqual(['other', 'plugin-c', 'plugin-c:*']);
  });

  it('should turn the library messages on and off', async () => {
    const { debugController, view } = await createView();

    setChecked(getCheckbox(view, 'Library messages'), true);

    expect(debugController.get()).toEqual(['*:obsidian-lib:*', '*:obsidian-dev-utils:*']);
    expect(getCheckbox(view, 'Library messages').checked).toBe(true);
  });

  it('should filter by name or id, case-insensitively, and say when nothing matches', async () => {
    const { view } = await createView();

    typeFilter(view, 'BET');
    expect(getRowTexts(view)).toEqual(['Beta']);
    typeFilter(view, 'plugin-c');
    expect(getRowTexts(view)).toEqual(['Gamma']);
    typeFilter(view, 'nothing');
    expect(getRowTexts(view)).toEqual([]);
    expect(view.contentEl.textContent).toContain('No plugins match.');
  });

  it('should show only enabled plugins, or only checked ones, when asked', async () => {
    const { view } = await createView(['plugin-c']);

    setChecked(getToolbarCheckbox(view, 'Only enabled plugins'), true);
    expect(getRowTexts(view)).toEqual(['Alpha', 'Beta']);
    setChecked(getToolbarCheckbox(view, 'Only enabled plugins'), false);
    setChecked(getToolbarCheckbox(view, 'Only checked'), true);
    expect(getRowTexts(view)).toEqual(['Gamma']);
  });

  it('should turn every filtered plugin on or off with All on and All off', async () => {
    const { debugController, view } = await createView(['*']);

    typeFilter(view, 'a');
    setChecked(getToolbarCheckbox(view, 'Only enabled plugins'), true);
    clickButton(view, 'All off');
    expect(debugController.get()).toEqual(['*', '-plugin-a', '-plugin-a:*', '-plugin-b', '-plugin-b:*']);
    expect(debugController.set).toHaveBeenCalledOnce();

    clickButton(view, 'All on');
    expect(debugController.get()).toEqual(['*']);
  });

  it('should pick up a change made elsewhere: the console, or a plugin installed or enabled', async () => {
    vi.useFakeTimers();
    const { debugController, enabledPlugins, manifests, view } = await createView();

    debugController.set(['plugin-a']);
    manifests['plugin-d'] = createManifest('plugin-d', 'Delta');
    enabledPlugins.add('plugin-c');
    vi.advanceTimersByTime(500);

    expect(getCheckbox(view, 'Alpha').checked).toBe(true);
    expect(getRowTexts(view)).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
    const gammaRow = getRows(view).find((rowEl) => rowEl.textContent.includes('Gamma'));
    expect(gammaRow?.hasClass('advanced-debug-mode-plugin-debug-messages-disabled-plugin')).toBe(false);
  });

  it('should not rebuild the rows when nothing changed', async () => {
    vi.useFakeTimers();
    const { view } = await createView();
    const rowBefore = getRows(view)[1];

    vi.advanceTimersByTime(500);

    expect(getRows(view)[1]).toBe(rowBefore);
  });
});

describe('openPluginDebugMessagesView', () => {
  it('should open the view in the right sidebar, and reveal the open one on the next call', async () => {
    const app = App.createConfigured__().asOriginalType__();
    const rightLeaf = strictProxy<AppOriginal['workspace']['activeLeaf'] & object>({ setViewState: vi.fn().mockResolvedValue(undefined) });
    const getLeavesOfType = vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([]);
    vi.spyOn(app.workspace, 'getRightLeaf').mockReturnValue(rightLeaf);
    const revealLeaf = vi.spyOn(app.workspace, 'revealLeaf').mockResolvedValue(undefined);

    await openPluginDebugMessagesView(app);

    expect(rightLeaf.setViewState).toHaveBeenCalledWith({ active: true, type: PLUGIN_DEBUG_MESSAGES_VIEW_TYPE });
    expect(revealLeaf).toHaveBeenCalledWith(rightLeaf);

    getLeavesOfType.mockReturnValue([rightLeaf]);
    vi.mocked(rightLeaf.setViewState).mockClear();
    await openPluginDebugMessagesView(app);

    expect(rightLeaf.setViewState).not.toHaveBeenCalled();
    expect(revealLeaf).toHaveBeenCalledTimes(2);
  });

  it('should fall back to a new tab when there is no right sidebar', async () => {
    const app = App.createConfigured__().asOriginalType__();
    const tabLeaf = strictProxy<AppOriginal['workspace']['activeLeaf'] & object>({ setViewState: vi.fn().mockResolvedValue(undefined) });
    vi.spyOn(app.workspace, 'getLeavesOfType').mockReturnValue([]);
    vi.spyOn(app.workspace, 'getRightLeaf').mockReturnValue(null);
    const getLeaf = vi.spyOn(app.workspace, 'getLeaf').mockReturnValue(tabLeaf);
    vi.spyOn(app.workspace, 'revealLeaf').mockResolvedValue(undefined);

    await openPluginDebugMessagesView(app);

    expect(getLeaf).toHaveBeenCalledWith('tab');
    expect(tabLeaf.setViewState).toHaveBeenCalledOnce();
  });
});
