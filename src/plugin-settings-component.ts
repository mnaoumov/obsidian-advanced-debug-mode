import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { MaybeReturn } from '@mnaoumov/typescript-lib/type';

import { PluginSettingsComponentBase } from '@mnaoumov/obsidian-lib/components/plugin-settings-component';

import { PluginSettings } from './plugin-settings.ts';

interface PluginSettingsComponentConstructorParams {
  readonly dataHandler: DataHandler;
  readonly pluginEventSource: PluginEventSource;
}

export class PluginSettingsComponent extends PluginSettingsComponentBase<PluginSettings> {
  public constructor(params: PluginSettingsComponentConstructorParams) {
    super({
      ...params,
      pluginSettingsClass: PluginSettings
    });
  }

  protected override registerValidators(): void {
    super.registerValidators();
    // A failed check makes the effective value the default, which also repairs a negative limit saved by versions whose
    // patched `Error.stackTraceLimit` setter persisted every runtime write.
    this.registerValidator('stackTraceLimit', (value): MaybeReturn<string> => {
      if (!Number.isSafeInteger(value) || value < 0) {
        return 'The stack trace limit must be a whole number, 0 or greater';
      }
    });
  }
}
