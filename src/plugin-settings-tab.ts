import type { DebugController } from 'obsidian-dev-utils/debug-controller';
import type { PluginSettingsTabBaseConstructorParams } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';

import {
  Platform,
  Setting
} from 'obsidian';
import { getDebugger } from 'obsidian-dev-utils/debug';
import { appendCodeBlock } from 'obsidian-dev-utils/html-element';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';
import { SettingEx } from 'obsidian-dev-utils/obsidian/setting-ex';

import type { DebugMode } from './debug-mode.ts';
import type { EmulateMobileMode } from './emulate-mobile-mode.ts';
import type { PluginSettings } from './plugin-settings.ts';

interface PluginSettingsTabConstructorParams extends PluginSettingsTabBaseConstructorParams<PluginSettings> {
  readonly debugController: DebugController;
  readonly debugMode: DebugMode;
  readonly emulateMobileMode: EmulateMobileMode;
}

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  private readonly debugController: DebugController;
  private readonly debugMode: DebugMode;
  private readonly emulateMobileMode: EmulateMobileMode;

  public constructor(params: PluginSettingsTabConstructorParams) {
    super(params);
    this.debugController = params.debugController;
    this.debugMode = params.debugMode;
    this.emulateMobileMode = params.emulateMobileMode;
  }

  public override display(): void {
    super.display();
    this.containerEl.empty();

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
        toggle
          .setValue(this.debugMode.isDebugMode())
          .onChange((value) => {
            this.debugMode.toggleDebugMode(value);
          });
      });

    new Setting(this.containerEl)
      .setName('Desktop: Emulate mobile mode')
      .setDesc(createFragment((f) => {
        f.appendText('Enable/disable emulating mobile mode ');

        f.createEl('strong', { text: '(Desktop only)' });
        f.appendText('.');
        f.createEl('br');
        f.appendText('⚠️ This setting change will reload the app.');
      }))
      .addToggle((toggle) => {
        toggle
          .setValue(this.emulateMobileMode.isEmulateMobileMode())
          .onChange((value) => {
            this.emulateMobileMode.toggleEmulateMobileMode(value);
          })
          .setDisabled(Platform.isMobile && !this.emulateMobileMode.isEmulateMobileMode());
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
          href: 'https://github.com/mnaoumov/obsidian-dev-utils/blob/main/docs/debugging.md',
          // eslint-disable-next-line obsidianmd/ui/sentence-case -- OK
          text: 'documentation'
        });
      }))
      .addTextArea((textArea) => {
        textArea
          .setValue(this.debugController.get().join('\n'))
          .onChange((value) => {
            const namespaces = value.split('\n');
            this.debugController.set(namespaces);
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
        f.appendText('⚠️ WARNING: If enabled, the autocomplete in the DevTools Console will stop working.');
      }))
      .addToggle((toggle) => {
        this
          .bind(toggle, 'shouldIncludeAsyncLongStackTraces')
          .setDisabled(!this.pluginSettingsComponent.settings.shouldIncludeLongStackTraces || Platform.isMobile);
      });

    new Setting(this.containerEl)
      .setName('Include internal stack frames')
      .setDesc('Whether to include internal stack frames to the JavaScript Error objects.')
      .addToggle((toggle) => {
        this
          .bind(toggle, 'shouldIncludeInternalStackFrames')
          .setDisabled(!this.pluginSettingsComponent.settings.shouldIncludeLongStackTraces);
      });

    new SettingEx(this.containerEl)
      .setName('Stack trace limit')
      .setDesc(createFragment((f) => {
        f.appendText('The maximum number of stack frames to include in the error stack trace.');
        f.createEl('br');
        f.appendText('The higher the value, the more memory intensive the plugin will be.');
        f.createEl('br');
        f.appendText('Use 0 to disable the limit ');
        f.createEl('strong', { text: '(Not recommended)' });
        f.appendText('.');
      }))
      .addNumber((numberComponent) => {
        this.bind(numberComponent, 'stackTraceLimit');
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
        this
          .bind(toggle, 'shouldTimeoutLongRunningTasks', {
            onChanged: () => {
              this.display();
            }
          })
          .setDisabled(Platform.isMobile);
      });

    new Setting(this.containerEl)
      .setName('Desktop: Include timed out tasks details')
      .setDesc(createFragment((f) => {
        f.appendText('Whether to include the details of timed out tasks in the console ');

        f.createEl('strong', { text: '(Desktop only)' });
        f.appendText('.');
      }))
      .addToggle((toggle) => {
        this
          .bind(toggle, 'shouldIncludeTimedOutTasksDetails')
          .setDisabled(!this.pluginSettingsComponent.settings.shouldTimeoutLongRunningTasks || Platform.isMobile);
      });

    new Setting(this.containerEl)
      // eslint-disable-next-line obsidianmd/ui/sentence-case -- wrong rule.
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
        toggle
          .setValue(!timeoutDebugger.enabled)
          .onChange((value) => {
            if (value) {
              this.debugController.disable(NAMESPACE);
            } else {
              this.debugController.enable(NAMESPACE);
            }
            this.display();
          });
      });
  }
}
