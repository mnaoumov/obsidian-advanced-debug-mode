import { Setting } from 'obsidian';
import {
  getDebugController,
  getDebugger
} from 'obsidian-dev-utils/Debug';
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
      .setName('Obsidian debug mode')
      .setDesc(createFragment((f) => {
        f.appendText('Enable/disable Obsidian debug mode.');
        f.createEl('br');
        f.appendText('When enabled, inline source maps will not be stripped from loaded plugins.');
        f.createEl('br');
        f.appendText('⚠️ This setting change will reload the app.');
      }))
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.isDebugMode());

        toggle.onChange((value) => {
          this.plugin.toggleDebugMode(value);
        });
      });

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
      .setName('Include long stack traces')
      .setDesc('Whether to include long stack traces to the JavaScript Error objects.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldIncludeLongStackTraces', {
          onChanged: () => {
            this.display();
            this.plugin.reloadLongStackTracesHandler();
          }
        });
      });

    new Setting(this.containerEl)
      .setName('Desktop: Include async long stack traces')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to include long stack traces to the JavaScript Error objects from the async operations ');
        f.createEl('strong', { text: '(Desktop only)' });
        f.appendText('.');
        f.createEl('br');
        f.appendText('⚠️ If enabled, the autocomplete in the DevTools Console will stop working.');
      }))
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldIncludeAsyncLongStackTraces', {
          onChanged: () => {
            this.plugin.reloadLongStackTracesHandler();
          }
        })
          .setDisabled(!this.plugin.settings.shouldIncludeLongStackTraces);
      });

    new Setting(this.containerEl)
      .setName('Include internal stack frames')
      .setDesc('Whether to include internal stack frames to the JavaScript Error objects.')
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldIncludeInternalStackFrames')
          .setDisabled(!this.plugin.settings.shouldIncludeLongStackTraces);
      });

    new Setting(this.containerEl)
      .setName('Desktop: Timeout long running tasks')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to timeout long running tasks ');
        f.createEl('strong', { text: '(Desktop only)' });
        f.appendText('.');
        f.createEl('br');
        f.appendText('If enabled, long running tasks will be killed after 60 seconds (default Obsidian behavior).');
        f.createEl('br');
        f.appendText(
          'If disabled, long running tasks will not be killed. It is useful when some tasks fail due to timeout while you are staying on the breakpoint.'
        );
      }))
      .addToggle((toggle) => {
        this.bind(toggle, 'shouldTimeoutLongRunningTasks', {
          onChanged: () => {
            this.plugin.reloadLongRunningTasksComponent();
          }
        });
      });

    new Setting(this.containerEl)
      .setName('Obsidian Dev Utils: Timeout long running tasks')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to timeout long running tasks within Obsidian Dev Utils library.');
        f.createEl('br');
        f.appendText('Some plugins use functionality from that library that have some default timeouts.');
        f.createEl('br');
        f.appendText('If enabled, long running tasks will be killed after predefined timeouts (default Obsidian Dev Utils library behavior).');
        f.createEl('br');
        f.appendText(
          'If disabled, long running tasks will not be killed. It is useful when some tasks fail due to timeout while you are staying on the breakpoint.'
        );
      }))
      .addToggle((toggle) => {
        const NAMESPACE = '*:obsidian-dev-utils:Async:runWithTimeout:timeout';
        const timeoutDebugger = getDebugger(NAMESPACE);
        toggle.setValue(timeoutDebugger.enabled);
        toggle.onChange((value) => {
          if (value) {
            debugController.enable(NAMESPACE);
          } else {
            debugController.disable(NAMESPACE);
          }
          this.display();
        });
      });
  }
}
