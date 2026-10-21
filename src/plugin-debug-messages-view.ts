import type {
  App,
  PluginManifest,
  WorkspaceLeaf
} from 'obsidian';

import {
  ButtonComponent,
  ItemView,
  SearchComponent
} from 'obsidian';

import type { PluginDebugMessages } from './plugin-debug-messages.ts';

export const PLUGIN_DEBUG_MESSAGES_VIEW_TYPE = 'advanced-debug-mode-plugin-debug-messages';

// Neither the `debug` library nor Obsidian announces a namespace change typed in the console or a plugin being
// installed or enabled, so the open view compares a cheap snapshot this often instead.
const SYNC_INTERVAL_IN_MILLISECONDS = 500;

interface PluginDebugMessagesViewConstructorParams {
  readonly leaf: WorkspaceLeaf;
  readonly pluginDebugMessages: PluginDebugMessages;
}

interface RenderRowParams {
  readonly cls: string;
  readonly containerEl: HTMLElement;
  readonly describe: (rowEl: HTMLElement) => void;
  readonly isChecked: boolean;
  readonly onChange: (isChecked: boolean) => void;
  readonly title: string;
}

interface RenderToolbarCheckboxParams {
  readonly containerEl: HTMLElement;
  readonly label: string;
  readonly onChange: (isChecked: boolean) => void;
}

// Every installed plugin with a checkbox, so several plugins' debug messages can be turned on or off in one sitting:
// the view stays open and every checkbox applies at once.
export class PluginDebugMessagesView extends ItemView {
  private filterText = '';
  private listEl: HTMLElement | null = null;
  private readonly pluginDebugMessages: PluginDebugMessages;
  private renderedSnapshot = '';
  private shouldShowOnlyChecked = false;
  private shouldShowOnlyEnabledPlugins = false;

  public constructor(params: PluginDebugMessagesViewConstructorParams) {
    super(params.leaf);
    this.pluginDebugMessages = params.pluginDebugMessages;
    this.icon = 'bug';
  }

  public override getDisplayText(): string {
    return 'Plugin debug messages';
  }

  public override getViewType(): string {
    return PLUGIN_DEBUG_MESSAGES_VIEW_TYPE;
  }

  public override async onOpen(): Promise<void> {
    await super.onOpen();
    this.contentEl.empty();
    this.contentEl.addClass('advanced-debug-mode-plugin-debug-messages-view');
    this.renderToolbar();
    this.listEl = this.contentEl.createDiv({ cls: 'advanced-debug-mode-plugin-debug-messages-list' });
    this.renderList();
    this.registerInterval(window.setInterval(() => {
      this.syncIfChanged();
    }, SYNC_INTERVAL_IN_MILLISECONDS));
  }

  private getVisibleManifests(): PluginManifest[] {
    const filterText = this.filterText.trim().toLowerCase();
    return this.pluginDebugMessages.getPluginManifests().filter((manifest) => {
      const isMatchingFilter = !filterText || manifest.name.toLowerCase().includes(filterText) || manifest.id.toLowerCase().includes(filterText);
      const isMatchingEnabledFilter = !this.shouldShowOnlyEnabledPlugins || this.pluginDebugMessages.isPluginEnabled(manifest.id);
      const isMatchingCheckedFilter = !this.shouldShowOnlyChecked || this.pluginDebugMessages.isEnabled(manifest.id);
      return isMatchingFilter && isMatchingEnabledFilter && isMatchingCheckedFilter;
    });
  }

  private renderList(): void {
    const listEl = this.listEl;
    /* v8 ignore next 3 -- the list exists from onOpen on, and nothing renders before it. */
    if (!listEl) {
      return;
    }

    this.renderedSnapshot = this.pluginDebugMessages.getStateSnapshot();
    listEl.empty();

    renderRow({
      cls: 'advanced-debug-mode-plugin-debug-messages-library-row',
      containerEl: listEl,
      describe: (rowEl) => {
        rowEl.createSpan({ text: 'Library messages' });
        rowEl.createEl('code', { cls: 'advanced-debug-mode-plugin-debug-messages-id', text: '*:obsidian-lib:*' });
      },
      isChecked: this.pluginDebugMessages.isLibraryEnabled(),
      onChange: (isChecked) => {
        this.pluginDebugMessages.setLibraryEnabled(isChecked);
        this.renderList();
      },
      title: 'Debug messages of the shared library inside every plugin, including its legacy obsidian-dev-utils name'
    });

    const manifests = this.getVisibleManifests();
    if (manifests.length === 0) {
      listEl.createDiv({ cls: 'advanced-debug-mode-plugin-debug-messages-empty', text: 'No plugins match.' });
      return;
    }

    for (const manifest of manifests) {
      const isPluginEnabled = this.pluginDebugMessages.isPluginEnabled(manifest.id);
      renderRow({
        cls: isPluginEnabled ? '' : 'advanced-debug-mode-plugin-debug-messages-disabled-plugin',
        containerEl: listEl,
        describe: (rowEl) => {
          rowEl.createEl('code', { text: manifest.name });
          rowEl.createSpan({ cls: 'advanced-debug-mode-plugin-debug-messages-id', text: manifest.id });
          if (!isPluginEnabled) {
            rowEl.createSpan({ cls: 'advanced-debug-mode-plugin-debug-messages-badge', text: 'disabled' });
          }
        },
        isChecked: this.pluginDebugMessages.isEnabled(manifest.id),
        onChange: (isChecked) => {
          this.pluginDebugMessages.setEnabled(manifest.id, isChecked);
          this.renderList();
        },
        title: `Turns on the ${manifest.id} and ${manifest.id}:* debug namespaces`
      });
    }
  }

  private renderToolbar(): void {
    const toolbarEl = this.contentEl.createDiv({ cls: 'advanced-debug-mode-plugin-debug-messages-toolbar' });

    new SearchComponent(toolbarEl)
      .setPlaceholder('Filter plugins')
      .onChange((value) => {
        this.filterText = value;
        this.renderList();
      });

    const filtersEl = toolbarEl.createDiv({ cls: 'advanced-debug-mode-plugin-debug-messages-filters' });
    renderToolbarCheckbox({
      containerEl: filtersEl,
      label: 'Only enabled plugins',
      onChange: (isChecked) => {
        this.shouldShowOnlyEnabledPlugins = isChecked;
        this.renderList();
      }
    });
    renderToolbarCheckbox({
      containerEl: filtersEl,
      label: 'Only checked',
      onChange: (isChecked) => {
        this.shouldShowOnlyChecked = isChecked;
        this.renderList();
      }
    });

    const buttonsEl = toolbarEl.createDiv({ cls: 'advanced-debug-mode-plugin-debug-messages-buttons' });
    new ButtonComponent(buttonsEl)
      .setButtonText('All on')
      .setTooltip('Turn on the debug messages of every plugin listed below')
      .onClick(() => {
        this.setVisibleEnabled(true);
      });
    new ButtonComponent(buttonsEl)
      .setButtonText('All off')
      .setTooltip('Turn off the debug messages of every plugin listed below')
      .onClick(() => {
        this.setVisibleEnabled(false);
      });
  }

  private setVisibleEnabled(isEnabled: boolean): void {
    this.pluginDebugMessages.setManyEnabled(this.getVisibleManifests().map((manifest) => manifest.id), isEnabled);
    this.renderList();
  }

  private syncIfChanged(): void {
    if (this.pluginDebugMessages.getStateSnapshot() !== this.renderedSnapshot) {
      this.renderList();
    }
  }
}

export async function openPluginDebugMessagesView(app: App): Promise<void> {
  const { workspace } = app;
  let leaf = workspace.getLeavesOfType(PLUGIN_DEBUG_MESSAGES_VIEW_TYPE)[0];
  if (!leaf) {
    // The right sidebar on every platform: on mobile it is a drawer, which suits a list consulted next to a note.
    leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf('tab');
    await leaf.setViewState({ active: true, type: PLUGIN_DEBUG_MESSAGES_VIEW_TYPE });
  }

  await workspace.revealLeaf(leaf);
}

function renderRow(params: RenderRowParams): void {
  const rowEl = params.containerEl.createEl('label', { cls: ['advanced-debug-mode-plugin-debug-messages-row', params.cls].filter(Boolean) });
  rowEl.title = params.title;
  const checkboxEl = rowEl.createEl('input', { type: 'checkbox' });
  checkboxEl.checked = params.isChecked;
  checkboxEl.addEventListener('change', () => {
    params.onChange(checkboxEl.checked);
  });
  params.describe(rowEl);
}

function renderToolbarCheckbox(params: RenderToolbarCheckboxParams): void {
  const labelEl = params.containerEl.createEl('label');
  const checkboxEl = labelEl.createEl('input', { type: 'checkbox' });
  checkboxEl.addEventListener('change', () => {
    params.onChange(checkboxEl.checked);
  });
  labelEl.appendText(params.label);
}
