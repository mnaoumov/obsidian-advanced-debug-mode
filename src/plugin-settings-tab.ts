import type { SettingDefinitionItem } from 'obsidian';
import type { DebugController } from 'obsidian-dev-utils/debug-controller';
import type { PluginNoticeComponent } from 'obsidian-dev-utils/obsidian/components/plugin-notice-component';
import type { PluginSettingsTabBaseConstructorParams } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';

import { Platform } from 'obsidian';
import { getDebugger } from 'obsidian-dev-utils/debug';
import { appendCodeBlock } from 'obsidian-dev-utils/obsidian/html-element';
import { PluginSettingsTabBase } from 'obsidian-dev-utils/obsidian/plugin/plugin-settings-tab';

import type { DebugMode } from './debug-mode.ts';
import type { EmulateMobileMode } from './emulate-mobile-mode.ts';
import type { PluginSettings } from './plugin-settings.ts';

import { abortSharedOperation } from './abort-shared-operation.ts';

interface PluginSettingsTabConstructorParams extends PluginSettingsTabBaseConstructorParams<PluginSettings> {
  readonly debugController: DebugController;
  readonly debugMode: DebugMode;
  readonly emulateMobileMode: EmulateMobileMode;
  readonly pluginNoticeComponent: PluginNoticeComponent;
}

const OBSIDIAN_DEV_UTILS_TIMEOUT_NAMESPACE = '*:obsidian-dev-utils:Async:runWithTimeout:timeout';

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  private readonly debugController: DebugController;
  private readonly debugMode: DebugMode;
  private readonly emulateMobileMode: EmulateMobileMode;
  private readonly pluginNoticeComponent: PluginNoticeComponent;

  public constructor(params: PluginSettingsTabConstructorParams) {
    super(params);
    this.debugController = params.debugController;
    this.debugMode = params.debugMode;
    this.emulateMobileMode = params.emulateMobileMode;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
  }

  protected override getSettingDefinitionItems(): SettingDefinitionItem[] {
    return [
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Enable/disable Obsidian debug mode.');
          f.createEl('br');
          f.appendText('When enabled, inline source maps will not be stripped from loaded plugins.');
          f.createEl('br');
          f.appendText('⚠️ This setting change will reload the app.');
        }),
        name: 'Obsidian debug mode',
        render: (setting) => {
          setting.addToggle((toggle) => {
            toggle
              .setValue(this.debugMode.isDebugMode())
              .onChange((value) => {
                this.debugMode.toggleDebugMode(value);
              });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Enable/disable emulating mobile mode ');

          f.createEl('strong', { text: '(Desktop only)' });
          f.appendText('.');
          f.createEl('br');
          f.appendText('⚠️ This setting change will reload the app.');
        }),
        /* v8 ignore next -- Platform.isMobile is always false in unit tests (jsdom). */
        disabled: () => Platform.isMobile && !this.emulateMobileMode.isEmulateMobileMode(),
        name: 'Desktop: Emulate mobile mode',
        render: (setting) => {
          setting.addToggle((toggle) => {
            toggle
              .setValue(this.emulateMobileMode.isEmulateMobileMode())
              .onChange((value) => {
                this.emulateMobileMode.toggleEmulateMobileMode(value);
              });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
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
            href: 'https://mnaoumov.dev/obsidian-dev-utils/guides/debugging/'
          }).appendText('documentation');
        }),
        name: 'Debug namespaces',
        render: (setting) => {
          setting.addTextArea((textArea) => {
            textArea
              .setValue(this.debugController.get().join('\n'))
              .onChange((value) => {
                const namespaces = value.split('\n');
                this.debugController.set(namespaces);
              });

            textArea.inputEl.addClass('debug-namespaces-setting-control');
          });
        }
      }),
      this.settingEx({
        desc: 'Whether to include long stack traces to the JavaScript Error objects.',
        name: 'Include long stack traces',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({
              onChanged: () => {
                // Two rows below only read this value through their `disabled` predicate, so Obsidian
                // Re-evaluates them in place instead of re-rendering the tab.
                this.refreshDomState();
              },
              propertyName: 'shouldIncludeLongStackTraces',
              valueComponent: toggle
            });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to include long stack traces to the JavaScript Error objects from the async operations ');

          f.createEl('strong', { text: '(Desktop only)' });
          f.appendText('.');
          f.createEl('br');
          f.appendText('⚠️ WARNING: If enabled, the autocomplete in the DevTools Console will stop working.');
        }),
        disabled: () => !this.pluginSettingsComponent.settings.shouldIncludeLongStackTraces || Platform.isMobile,
        name: 'Desktop: Include async long stack traces',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({
              propertyName: 'shouldIncludeAsyncLongStackTraces',
              valueComponent: toggle
            });
          });
        }
      }),
      this.settingEx({
        desc: 'Whether to include internal stack frames to the JavaScript Error objects.',
        disabled: () => !this.pluginSettingsComponent.settings.shouldIncludeLongStackTraces,
        name: 'Include internal stack frames',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({
              propertyName: 'shouldIncludeInternalStackFrames',
              valueComponent: toggle
            });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('The maximum number of stack frames to include in the error stack trace.');
          f.createEl('br');
          f.appendText('The higher the value, the more memory intensive the plugin will be.');
          f.createEl('br');
          f.appendText('Use 0 to disable the limit ');
          f.createEl('strong', { text: '(Not recommended)' });
          f.appendText('.');
        }),
        name: 'Stack trace limit',
        render: (setting) => {
          setting.addNumber((numberComponent) => {
            this.bind({
              propertyName: 'stackTraceLimit',
              valueComponent: numberComponent
            });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to timeout long running tasks ');

          f.createEl('strong', { text: '(Desktop only)' });
          f.appendText('.');
          f.createEl('br');
          f.appendText('If enabled, long running tasks will be killed after 60 seconds (default Obsidian behavior).');
          f.createEl('br');
          f.appendText(
            'If disabled, long running tasks will not be killed. It is useful when some tasks fail due to timeout while you are staying on the breakpoint.'
          );
        }),
        disabled: () => Platform.isMobile,
        name: 'Desktop: Timeout long running tasks',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({
              onChanged: () => {
                // Only the row below reads this value, through its `disabled` predicate.
                this.refreshDomState();
              },
              propertyName: 'shouldTimeoutLongRunningTasks',
              valueComponent: toggle
            });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to include the details of timed out tasks in the console ');

          f.createEl('strong', { text: '(Desktop only)' });
          f.appendText('.');
        }),
        disabled: () => !this.pluginSettingsComponent.settings.shouldTimeoutLongRunningTasks || Platform.isMobile,
        name: 'Desktop: Include timed out tasks details',
        render: (setting) => {
          setting.addToggle((toggle) => {
            this.bind({
              propertyName: 'shouldIncludeTimedOutTasksDetails',
              valueComponent: toggle
            });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Whether to timeout long running tasks within ');
          f.createEl('a', {
            href: 'https://github.com/mnaoumov/obsidian-dev-utils',
            text: createFragment((f2) => {
              appendCodeBlock(f2, 'Obsidian Dev Utils');
            })
          });
          f.appendText(' library.');
          f.createEl('br');
          f.appendText('Some plugins use functionality from that library that have some default timeouts.');
          f.createEl('br');
          f.appendText('If enabled, long running tasks will be killed after predefined timeouts (default ');
          appendCodeBlock(f, 'Obsidian Dev Utils');
          f.appendText('library behavior).');
          f.createEl('br');
          f.appendText(
            'If disabled, long running tasks will not be killed. It is useful when some tasks fail due to timeout while you are staying on the breakpoint.'
          );
        }),
        name: 'Obsidian Dev Utils: Timeout long running tasks',
        render: (setting) => {
          setting.addToggle((toggle) => {
            const timeoutDebugger = getDebugger(OBSIDIAN_DEV_UTILS_TIMEOUT_NAMESPACE);
            toggle
              .setValue(!timeoutDebugger.enabled)
              .onChange((value) => {
                if (value) {
                  this.debugController.disable(OBSIDIAN_DEV_UTILS_TIMEOUT_NAMESPACE);
                } else {
                  this.debugController.enable(OBSIDIAN_DEV_UTILS_TIMEOUT_NAMESPACE);
                }

                // The row's value is derived from the debugger state rather than from the plugin settings,
                // So the tab has to be re-rendered for it to pick the new value up.
                this.refresh();
              });
          });
        }
      }),
      this.settingEx({
        desc: createFragment((f) => {
          f.appendText('Cancels the long-running operation that is currently in flight.');
          f.createEl('br');
          f.appendText('⚠️ The abort is app-wide: it stops whichever plugin started the operation, not only this one.');
          f.createEl('br');
          f.appendText('Nothing reports back whether anything was listening — the shared signal keeps no registry of its observers.');
          f.createEl('br');
          f.appendText('The same is available as the ');
          appendCodeBlock(f, 'Advanced Debug Mode: Abort the running operation');
          f.appendText(' command, which can be bound to a hotkey.');
        }),
        name: 'Abort the running operation',
        render: (setting) => {
          setting.addButton((button) => {
            button
              .setButtonText('Abort')
              .setDestructive()
              .onClick(() => {
                abortSharedOperation(this.pluginNoticeComponent);
              });
          });
        }
      })
    ];
  }
}
