import { Setting } from 'obsidian';
import { getDebugController } from 'obsidian-dev-utils/Debug';
import { appendCodeBlock } from 'obsidian-dev-utils/HTMLElement';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/Plugin/PluginSettingsTabBase';

import type { AdvancedDebugModePlugin } from './AdvancedDebugModePlugin.ts';

export class AdvancedDebugModePluginSettingsTab extends PluginSettingsTabBase<AdvancedDebugModePlugin> {
  public constructor(plugin: AdvancedDebugModePlugin) {
    super(plugin);
  }

  public override display(): void {
    this.containerEl.empty();

    const debugController = getDebugController();

    new Setting(this.containerEl)
      .setName('Debug namespaces')
      .setDesc(createFragment((f) => {
        f.appendText('Configure the debug namespaces.');
        f.createEl('br');
        f.appendText('Add each namespace on a new line.');
        f.createEl('br');
        f.appendText('To disable a namespace, prefix it with a dash: ');
        appendCodeBlock(f, '-foo:bar:*');
        f.createEl('br');
        f.appendText('Usually the setting is applied immediately, but for some plugins it works only after reloading the app.');
        f.createEl('br');
        f.appendText('For more information, see the ');
        f.createEl('a', {
          href: 'https://github.com/mnaoumov/obsidian-dev-utils?tab=readme-ov-file#debugging',
          text: 'documentation'
        });
      }))
      .addTextArea((textArea) => {
        textArea.setValue(debugController.get().join('\n'));
        textArea.onChange((value) => {
          const namespaces = value.split('\n');
          debugController.set(namespaces);
        });

        textArea.inputEl.addClass('debug-namespaces-setting-control');
      });

    new Setting(this.containerEl)
      .setName('Show internal stack frames')
      .setDesc('Show internal stack frames in the debug output.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldShowInternalStackFrames');
      });
  }
}
