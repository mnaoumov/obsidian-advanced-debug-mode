import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type { PluginSettingsTabBaseConstructorParams } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';
import type { DebugController } from '@mnaoumov/typescript-lib/debug-controller';
import type {
  SettingDefinitionGroup,
  SettingDefinitionItem,
  TextAreaComponent,
  ToggleComponent
} from 'obsidian';

import { appendCodeBlock } from '@mnaoumov/obsidian-lib/html-element';
import { PluginSettingsTabBase } from '@mnaoumov/obsidian-lib/plugin/plugin-settings-tab';
import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import { getDebugSwitches } from '@mnaoumov/typescript-lib/debug-switches';
import { Platform } from 'obsidian';

import type { DebugMode } from '../debug-controls/debug-mode.ts';
import type { EmulateMobileMode } from '../debug-controls/emulate-mobile-mode.ts';
import type { PluginDebugMessages } from '../plugin-debug-messages/plugin-debug-messages.ts';
import type { PluginSettings } from './plugin-settings.ts';

import { abortSharedOperation } from '../operations/abort-shared-operation.ts';
import {
  formatPluginLoadDelays,
  parsePluginLoadDelays
} from '../plugin-load-delays/plugin-load-delays.ts';
import {
  PluginLoadDelayMode,
  PluginLoadDelayPosition
} from './plugin-settings.ts';

interface PluginSettingsTabConstructorParams extends PluginSettingsTabBaseConstructorParams<PluginSettings> {
  readonly debugController: DebugController;
  readonly debugMode: DebugMode;
  readonly emulateMobileMode: EmulateMobileMode;
  readonly openPluginDebugMessagesView: () => Promise<void>;
  readonly pluginDebugMessages: PluginDebugMessages;
  readonly pluginNoticeComponent: PluginNoticeComponent;
}

export class PluginSettingsTab extends PluginSettingsTabBase<PluginSettings> {
  private readonly debugController: DebugController;
  private readonly debugMode: DebugMode;
  private debugNamespacesTextArea: null | TextAreaComponent = null;
  private readonly emulateMobileMode: EmulateMobileMode;
  private isRefreshScheduled = false;
  private isSyncingPluginDebugMessageToggles = false;
  private readonly openPluginDebugMessagesView: () => Promise<void>;
  private readonly pluginDebugMessages: PluginDebugMessages;
  private readonly pluginDebugMessageToggles = new Map<string, ToggleComponent>();
  private readonly pluginNoticeComponent: PluginNoticeComponent;

  public constructor(params: PluginSettingsTabConstructorParams) {
    super(params);
    this.debugController = params.debugController;
    this.debugMode = params.debugMode;
    this.emulateMobileMode = params.emulateMobileMode;
    this.openPluginDebugMessagesView = params.openPluginDebugMessagesView;
    this.pluginDebugMessages = params.pluginDebugMessages;
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
            href: 'https://mnaoumov.dev/obsidian-lib/guides/debugging/'
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
                this.syncPluginDebugMessageToggles();
              });

            textArea.inputEl.addClass('debug-namespaces-setting-control');
            this.debugNamespacesTextArea = textArea;
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
                // re-evaluates them in place instead of re-rendering the tab.
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
      }),
      this.getPluginLoadDelaysGroup(),
      this.getPluginDebugMessagesGroup(),
      this.getDebugSwitchesGroup()
    ];
  }

  private getDebugSwitchesGroup(): SettingDefinitionGroup {
    const debugSwitches = getDebugSwitches();
    const debugSwitchIds = getDebugSwitchIds();
    return this.settingGroupEx({
      heading: 'Debug switches',
      items: debugSwitches.map((debugSwitch) =>
        this.settingEx({
          desc: createFragment((f) => {
            f.appendText(debugSwitch.description);
            f.createEl('br');
            f.appendText('Id: ');
            appendCodeBlock(f, debugSwitch.id);
            f.appendText(`, ${debugSwitch.isEnabledByDefault ? 'on' : 'off'} by default.`);
          }),
          name: debugSwitch.name,
          render: (setting) => {
            this.refreshIfChanged(debugSwitchIds, getDebugSwitchIds());
            setting.addToggle((toggle) => {
              toggle
                .setValue(debugSwitch.isEnabled())
                .onChange((value) => {
                  debugSwitch.setEnabled(value);
                });
            });
          }
        })
      )
    });
  }

  private getPluginDebugMessagesGroup(): SettingDefinitionGroup {
    const manifests = this.pluginDebugMessages.getPluginManifests();
    const pluginIds = this.getPluginIds();
    this.pluginDebugMessageToggles.clear();
    return this.settingGroupEx({
      heading: 'Plugin debug messages',
      items: [
        this.settingEx({
          desc: 'Every installed plugin with a checkbox, a filter, and all on / all off, in a pane that stays open while you change several of them.',
          name: 'Plugin debug messages view',
          render: (setting) => {
            setting.addButton((button) => {
              button
                .setButtonText('Open as a view')
                .onClick(() => {
                  invokeAsyncSafely(() => this.openPluginDebugMessagesView());
                });
            });
          }
        }),
        ...manifests.map((manifest) =>
          this.settingEx({
            desc: createFragment((f) => {
              f.appendText('Show the debug messages of ');
              appendCodeBlock(f, manifest.name);
              f.appendText(': turns on the ');
              appendCodeBlock(f, manifest.id);
              f.appendText(' and ');
              appendCodeBlock(f, `${manifest.id}:*`);
              f.appendText(' debug namespaces.');
            }),
            name: manifest.name,
            render: (setting) => {
              this.refreshIfChanged(pluginIds, this.getPluginIds());
              setting.addToggle((toggle) => {
                toggle
                  .setValue(this.pluginDebugMessages.isEnabled(manifest.id))
                  .onChange((value) => {
                    if (this.isSyncingPluginDebugMessageToggles) {
                      return;
                    }

                    this.pluginDebugMessages.setEnabled(manifest.id, value);
                    this.debugNamespacesTextArea?.setValue(this.debugController.get().join('\n'));
                  });
                this.pluginDebugMessageToggles.set(manifest.id, toggle);
              });
            }
          })
        )
      ]
    });
  }

  private getPluginIds(): string {
    return this.pluginDebugMessages.getPluginManifests().map((manifest) => manifest.id).join('\n');
  }

  private getPluginLoadDelaysGroup(): SettingDefinitionGroup {
    const isOff = (): boolean => !this.pluginSettingsComponent.settings.shouldDelayPluginLoading;
    return this.settingGroupEx({
      heading: 'Plugin load delays',
      items: [
        this.settingEx({
          desc: createFragment((f) => {
            f.appendText('Slow down the loading of the other plugins, to see how they behave on a slow or busy machine.');
            f.createEl('br');
            f.appendText(
              'Obsidian loads plugins one at a time, so this plugin keeps itself first in the load order while this is on, and names any plugin that still loaded before it.'
            );
            f.createEl('br');
            f.appendText('⚠️ The startup delays need a reload of the app.');
          }),
          name: 'Delay plugin loading',
          render: (setting) => {
            setting.addToggle((toggle) => {
              this.bind({
                onChanged: () => {
                  // The rows below only read this value through their `disabled` predicate.
                  this.refreshDomState();
                },
                propertyName: 'shouldDelayPluginLoading',
                valueComponent: toggle
              });
            });
          }
        }),
        this.settingEx({
          desc: createFragment((f) => {
            f.appendText('How each delay waits.');
            f.createEl('br');
            appendCodeBlock(f, 'Async');
            f.appendText(' - yields, like a slow plugin that awaits: timers and work that earlier plugins started keep running.');
            f.createEl('br');
            appendCodeBlock(f, 'Sync');
            f.appendText(' - blocks the app completely, like a CPU-heavy plugin.');
          }),
          disabled: isOff,
          name: 'Delay mode',
          render: (setting) => {
            setting.addDropdown((dropdown) => {
              dropdown.addOptions({
                [PluginLoadDelayMode.Async]: 'Async',
                [PluginLoadDelayMode.Sync]: 'Sync'
              });
              this.bind({ propertyName: 'pluginLoadDelayMode', valueComponent: dropdown });
            });
          }
        }),
        this.settingEx({
          desc: createFragment((f) => {
            f.appendText('When each plugin\'s delay runs.');
            f.createEl('br');
            appendCodeBlock(f, 'Before onload');
            f.appendText(' - before the plugin starts loading, as if the plugins before it were slow.');
            f.createEl('br');
            appendCodeBlock(f, 'After onload');
            f.appendText(' - after the plugin has loaded, as if it were slow itself: what it started already runs.');
          }),
          disabled: isOff,
          name: 'Delay position',
          render: (setting) => {
            setting.addDropdown((dropdown) => {
              dropdown.addOptions({
                /* eslint-disable perfectionist/sort-objects -- Need to keep order. */
                [PluginLoadDelayPosition.BeforeOnload]: 'Before onload',
                [PluginLoadDelayPosition.AfterOnload]: 'After onload'
                /* eslint-enable perfectionist/sort-objects -- Need to keep order. */
              });
              this.bind({ propertyName: 'pluginLoadDelayPosition', valueComponent: dropdown });
            });
          }
        }),
        this.settingEx({
          desc: 'The delay, in milliseconds, for every plugin not listed below. 0 delays none of them.',
          disabled: isOff,
          name: 'Default delay',
          render: (setting) => {
            setting.addNumber((numberComponent) => {
              this.bind({ propertyName: 'defaultPluginLoadDelayInMilliseconds', valueComponent: numberComponent });
            });
          }
        }),
        this.settingEx({
          desc: createFragment((f) => {
            f.appendText('Delays for single plugins, in milliseconds, one per line: ');
            appendCodeBlock(f, '<plugin-id>: <milliseconds>');
            f.appendText('.');
            f.createEl('br');
            f.appendText('Use 0 to leave a plugin out of the default delay.');
          }),
          disabled: isOff,
          name: 'Delays per plugin',
          render: (setting) => {
            setting.addTextArea((textArea) => {
              this.bind({
                componentToPluginSettingsValueConverter: parsePluginLoadDelays,
                pluginSettingsToComponentValueConverter: formatPluginLoadDelays,
                propertyName: 'pluginLoadDelaysInMilliseconds',
                valueComponent: textArea
              });
              textArea.inputEl.addClass('plugin-load-delays-setting-control');
            });
          }
        }),
        this.settingEx({
          desc: 'Up to this many milliseconds, picked at random, added to each plugin\'s delay, so the timing differs from one start to the next.',
          disabled: isOff,
          name: 'Random jitter',
          render: (setting) => {
            setting.addNumber((numberComponent) => {
              this.bind({ propertyName: 'pluginLoadDelayJitterInMilliseconds', valueComponent: numberComponent });
            });
          }
        }),
        this.settingEx({
          desc: 'At startup, the delay, in milliseconds, before the metadata cache starts its first resolve, after every plugin has loaded.',
          disabled: isOff,
          name: 'Metadata cache delay',
          render: (setting) => {
            setting.addNumber((numberComponent) => {
              this.bind({ propertyName: 'metadataCacheInitializeDelayInMilliseconds', valueComponent: numberComponent });
            });
          }
        }),
        this.settingEx({
          desc: 'At startup, the delay, in milliseconds, before the workspace layout loads, which is when the layout becomes ready.',
          disabled: isOff,
          name: 'Layout delay',
          render: (setting) => {
            setting.addNumber((numberComponent) => {
              this.bind({ propertyName: 'layoutLoadDelayInMilliseconds', valueComponent: numberComponent });
            });
          }
        })
      ]
    });
  }

  private refreshIfChanged(renderedIds: string, currentIds: string): void {
    if (this.isRefreshScheduled || currentIds === renderedIds) {
      return;
    }

    // Obsidian renders the definitions it stored when the tab was added, so a debug switch registered or a plugin
    // installed since then has no row yet. Rebuilding them from inside a render would re-enter it, so the rebuild runs
    // right after.
    this.isRefreshScheduled = true;
    window.setTimeout(() => {
      this.isRefreshScheduled = false;
      this.refresh();
    }, 0);
  }

  private syncPluginDebugMessageToggles(): void {
    // A toggle's `setValue` fires its own change handler, which must not write the namespaces the user is typing back.
    this.isSyncingPluginDebugMessageToggles = true;
    try {
      for (const [pluginId, toggle] of this.pluginDebugMessageToggles) {
        toggle.setValue(this.pluginDebugMessages.isEnabled(pluginId));
      }
    } finally {
      this.isSyncingPluginDebugMessageToggles = false;
    }
  }
}

function getDebugSwitchIds(): string {
  return getDebugSwitches().map((debugSwitch) => debugSwitch.id).join('\n');
}
